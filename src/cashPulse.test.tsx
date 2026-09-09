import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {freshRun,coinUnlocked,spin,work,configure,readSave,type Run} from "./game/engine";
import {presentationReducer,presentedRun} from "./presentation";
import {nextDockPanel} from "./CoinFlip";
import {chartPulse,ChartBackdrop} from "./ChartBackdrop";
import {CASH_RAIN_SETTINGS,soundPackSettings} from "./soundPresets";
import {resultTones} from "./audioPalette";
const ready=():Run=>({...freshRun(),cash:999999,peak:999999,portfolio:[{id:"edge-50",count:1}]});
const outcome=(amount:number,jackpot=false)=>{const s=spin(ready(),80);return {...s,last:{...s.last!,profit:amount,jackpot}};};
describe("coin visibility and cash-driven pulses",()=>{
 it("hides the coin destination until the public peak reaches $1M and keeps it unlocked",()=>{
  expect(nextDockPanel("positions",coinUnlocked(ready()))).toBe("upgrades");
  const model=presentationReducer({run:ready(),pending:null},{type:"change",update:s=>spin(s,80)});
  expect(coinUnlocked(model.run)).toBe(true);expect(nextDockPanel("positions",coinUnlocked(presentedRun(model)))).toBe("upgrades");
  const revealed=presentationReducer(model,{type:"reveal",runId:model.run.id,spinId:model.run.last!.id});
  expect(nextDockPanel("positions",coinUnlocked(revealed.run))).toBe("coin");
  expect(nextDockPanel("positions",coinUnlocked({...revealed.run,cash:1}))).toBe("coin");
  expect(nextDockPanel("coin",false)).toBe("upgrades");
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
