import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {freshRun,freshTrial,resumeTrial,advanceTrial,TRIAL_MS,coinUnlocked,needsCoinUnlockNotice,acknowledgeCoinUnlock,spin,work,configure,readSave,type Run} from "./game/engine";
import {presentationReducer,presentedRun} from "./presentation";
import {nextDockPanel} from "./CoinFlip";
import {chartPulse,ChartBackdrop} from "./ChartBackdrop";
import {CASH_RAIN_SETTINGS,soundPackSettings} from "./soundPresets";
import {resultTones} from "./audioPalette";
const ready=():Run=>({...freshRun(),cash:9999,peak:9999,portfolio:[{id:"edge-50",count:1}]});
const outcome=(amount:number,jackpot=false)=>{const s=spin(ready(),80);return {...s,last:{...s.last!,profit:amount,jackpot}};};
describe("coin visibility and cash-driven pulses",()=>{
 it.each([[9999,false],[10000,false],[10000.01,true],[10001,true]] as const)("requires a peak strictly above $10K: %s",(peak,expected)=>{
  const run={...freshRun(),peak,cash:1};
  expect(coinUnlocked(run)).toBe(expected);expect(needsCoinUnlockNotice(run)).toBe(expected);
 });
 it("hides the coin destination until the public peak exceeds $10K and keeps it unlocked",()=>{
  expect(nextDockPanel("positions",coinUnlocked(ready()))).toBe("upgrades");
  const model=presentationReducer({run:ready(),pending:null},{type:"change",update:s=>spin(s,80)});
  expect(coinUnlocked(model.run)).toBe(true);expect(nextDockPanel("positions",coinUnlocked(presentedRun(model)))).toBe("upgrades");
  expect(needsCoinUnlockNotice(presentedRun(model))).toBe(false);
  const revealed=presentationReducer(model,{type:"reveal",runId:model.run.id,spinId:model.run.last!.id});
  expect(nextDockPanel("positions",coinUnlocked(revealed.run))).toBe("coin");
  expect(needsCoinUnlockNotice(revealed.run)).toBe(true);
  expect(nextDockPanel("positions",coinUnlocked({...revealed.run,cash:1}))).toBe("coin");
  expect(nextDockPanel("coin",false)).toBe("upgrades");
 });
 it("keeps an old eligible save's announcement pending until acknowledged, then preserves it across reloads",()=>{
  const old={...freshRun(),cash:12000,peak:12000,coinUnlockAnnounced:undefined};
  const restored=readSave(JSON.stringify(old))!;expect(needsCoinUnlockNotice(restored)).toBe(true);
  expect(needsCoinUnlockNotice(readSave(JSON.stringify(restored))!)).toBe(true);
  const announced=acknowledgeCoinUnlock(restored);
  const reloaded=readSave(JSON.stringify({...announced,cash:1}))!;
  expect(coinUnlocked(reloaded)).toBe(true);expect(needsCoinUnlockNotice(reloaded)).toBe(false);
  expect(acknowledgeCoinUnlock(reloaded)).toBe(reloaded);
  const fresh=freshRun();expect(acknowledgeCoinUnlock(fresh)).toBe(fresh);expect(fresh.coinUnlockAnnounced).toBe(false);
 });
 it("can acknowledge an unlock after a timed challenge without changing its final record",()=>{
  const trial=resumeTrial({...freshTrial(),cash:12000,peak:12000},1000);
  const done=advanceTrial(trial,TRIAL_MS+1000),record=done.trial!.result;
  expect(record).not.toBeNull();expect(needsCoinUnlockNotice(done)).toBe(true);
  const model=presentationReducer({run:done,pending:null},{type:"change",update:acknowledgeCoinUnlock});
  expect(model.run.trial!.result).toBe(record);
  expect(needsCoinUnlockNotice(readSave(JSON.stringify(model.run))!)).toBe(false);
 });
 it("scales pulse brightness, spread, duration and waves with the settled amount",()=>{
  const low=chartPulse(outcome(1)),medium=chartPulse(outcome(1000)),big=chartPulse(outcome(1e6));
  for(const key of ["opacity","scale","duration","waves"] as const){expect(medium[key]).toBeGreaterThan(low[key]);expect(big[key]).toBeGreaterThan(medium[key]);}
  const loss=chartPulse(outcome(-1e6));expect(loss).toMatchObject({...big,falling:true});
  expect(chartPulse(outcome(0)).opacity).toBe(0);
 });
 it("holds the old pulse throughout reveal and does not change it for WORK or wallet changes",()=>{
  const before=outcome(10),model=presentationReducer({run:before,pending:null},{type:"change",update:s=>spin(s,100)});
  expect(chartPulse(presentedRun(model))).toEqual(chartPulse(before));
  expect(chartPulse(work(before))).toEqual(chartPulse(before));expect(chartPulse({...before,cash:1e9})).toEqual(chartPulse(before));
  expect(chartPulse(model.run).jackpot).toBe(true);
 });
 it("makes even a zero-profit Jackpot much stronger, with bounded configurable energy",()=>{
  const normal=chartPulse(outcome(10)),jp=chartPulse(outcome(0,true));
  expect(jp.opacity).toBeGreaterThan(normal.opacity*2);expect(jp.waves).toBe(3);expect(jp.duration).toBeGreaterThan(normal.duration);
  const huge=chartPulse(configure(outcome(1e200,true),{effectIntensity:2}));expect(huge.opacity).toBeLessThanOrEqual(.82);expect(huge.duration).toBeLessThanOrEqual(1600);
  const html=renderToStaticMarkup(<ChartBackdrop s={outcome(0,true)} recordedCash={1}/>);expect(html).toContain("jackpot-pulse");expect(html.match(/<i /g)).toHaveLength(3);
  expect(renderToStaticMarkup(<ChartBackdrop s={configure(ready(),{chartBackdrop:"off"})} recordedCash={999}/>)).toBe("");
 });
 it("uses one canonical CASH RAIN default and preserves a later explicit choice",()=>{
  const run=freshRun();expect(run.settings).toMatchObject(CASH_RAIN_SETTINGS);expect(soundPackSettings("arcade-coinop")).toEqual(CASH_RAIN_SETTINGS);expect(run.settings.music).toBe(false);
  expect(readSave(JSON.stringify(configure(run,{soundPack:"wood"})))!.settings.soundPack).toBe("wood");
 });
 it("keeps the louder Jackpot packet below the simultaneous audio voice cap",()=>{
  for(const pack of ["terminal","arcade-coinop","arcade-pinball","arcade-synth","arcade-punch"] as const){
   const settings={...freshRun().settings,soundPack:pack,effectIntensity:2,streakEffects:true};
   const tones=resultTones("jackpot",settings,30);expect(tones.length).toBeLessThanOrEqual(28);expect(tones.every(t=>Number.isFinite(t.gain)&&t.gain<=.3)).toBe(true);
   expect(resultTones("jackpot",{...settings,soundVolume:0}).every(t=>t.gain===0)).toBe(true);
  }
 });
});
