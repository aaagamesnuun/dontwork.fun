import {afterEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {freshRun,defaultSettings,configure,readSave,spin,setCount,work,purchase,upgradePrice,resolve,TARGET,VERSION,ECONOMY_REVISION,duration,type Run} from './engine';
import {betById} from './catalog';
import {guidance} from './guidance';
import {presentedRun,presentationReducer} from '../presentation';
import {clearCardRun} from '../ResultCard';
import {Leaderboard} from '../Leaderboard';
import {resultImage,resultShareText} from '../resultShare';
import {JackpotHelp} from '../Onboarding';
import {PayoffSweep} from '../TradingViews';
import {snapshot,ruleset} from '../api';
import {impact} from '../impact';
import App from '../App';
afterEach(()=>vi.unstubAllGlobals());
const playable=()=>setCount({...freshRun(),cash:1e6,peak:1e6},'edge-50',1);
const doubled=()=>configure(playable(),{jackpotRule:'double-high',assist:false});
describe('consecutive Jackpot LAB and hidden outcomes',()=>{
 it('requires two consecutive 91+ results and resets at 90; a single 100 is not a jackpot',()=>{
  let s=spin(doubled(),100);expect(s.jackpots).toBe(0);expect(s.jackpotHigh).toBe(true);
  s=spin(s,90);expect(s.jackpotHigh).toBe(false);s=spin(s,91);expect(s.jackpots).toBe(0);
  s=spin(s,91);expect(s.jackpots).toBe(1);expect(s.rushLeft).toBe(20);expect(s.spinsSinceJackpot).toBe(0);
  s=spin(s,92);expect(s.jackpots).toBe(2);expect(s.rushLeft).toBe(20);
 });
 it('persists the first high, leaves it alone for WORK/equipping and resets on rule change',()=>{
  const s=spin(doubled(),95),saved=readSave(JSON.stringify(s))!;
  expect(saved.jackpotHigh).toBe(true);expect(spin(work(saved),92).jackpots).toBe(1);
  expect(configure(saved,{showJackpotCounter:true}).jackpotHigh).toBe(true);
  expect(configure(saved,{jackpotRule:'hundred'}).jackpotHigh).toBe(false);
 });
 it('assists through real successive draws, consumes assistance only when it fires',()=>{
  let s:Run={...doubled(),settings:{...defaultSettings,jackpotRule:'double-high' as const},spins:30};
  s=spin(s);expect(s.last?.roll).toBe(100);expect(s.jackpots).toBe(0);expect(s.assistUsed).toBe(false);
  s=spin(s);expect(s.jackpots).toBe(1);expect(s.assistUsed).toBe(true);expect(s.spins).toBe(32);
  const ready={...doubled(),settings:{...defaultSettings,jackpotRule:'double-high' as const},spins:30,jackpotHigh:true};
  expect(spin(ready).jackpots).toBe(1);
 });
 it('renews on the final Rush spin and keeps infinity triggering every spin',()=>{
  let s={...doubled(),jackpotHigh:true,rushLeft:1,removed:98,trim:1};
  s=spin(s,100);expect(s.rushLeft).toBe(20);expect(s.removed).toBe(99);expect(s.last?.infinity).toBe(true);
  s=spin(s,100);expect(s.last?.jackpot).toBe(true);expect(s.rushLeft).toBe(20);
 });
 it('uses the chosen Jackpot condition for extra heat and extra Rush cards',()=>{
  const ready={...doubled(),jackpotHigh:true};
  expect(resolve(ready,betById('trim-reaper'),91).trim).toBe(5);
  expect(resolve(ready,betById('overtime-pay'),91).extension).toBe(5);
  expect(resolve({...ready,jackpotHigh:false},betById('trim-reaper'),100).trim).toBe(0);
 });
 it('publishes the counter and preparation state only when the sweep lands',()=>{
  const s=spin(doubled(),91),after=spin(s,92);
  const model=presentationReducer({run:s,pending:null},{type:'change',update:()=>after});
  expect(presentedRun(model)).toMatchObject({jackpots:0,spinsSinceJackpot:1,jackpotHigh:true});
  expect(presentedRun(presentationReducer(model,{type:'reveal',runId:s.id,spinId:after.last!.id}))).toMatchObject({jackpots:1,spinsSinceJackpot:0});
 });
 it('tracks spins even when the counter is hidden and never counts WORK or purchases',()=>{
  let s=spin(playable(),25);expect(s.spinsSinceJackpot).toBe(1);s=purchase(work(s),'speed');expect(s.spinsSinceJackpot).toBe(1);
  s=spin(s,100);expect(s.spinsSinceJackpot).toBe(0);s=spin(s,25);expect(s.spinsSinceJackpot).toBe(1);
  expect(configure(freshRun(),{showJackpotCounter:true}).debug).toBe(false);
 });
 it('does not invent an old counter and rejects malformed progress',()=>{
  const old={...playable(),spins:80,jackpots:3,spinsSinceJackpot:undefined,jackpotHigh:undefined};
  expect(readSave(JSON.stringify(old))!.spinsSinceJackpot).toBeNull();
  expect(readSave(JSON.stringify({...old,jackpots:0}))!.spinsSinceJackpot).toBe(80);
  expect(readSave(JSON.stringify({...playable(),spinsSinceJackpot:-1}))).toBeNull();
 });
 it('uses remaining spins instead of repeating the rules throughout a jackpot',()=>{
  const s={...playable(),rushLeft:18,chain:4,running:true};
  for(let tick=0;tick<6;tick++)expect(guidance(s,tick).text).toBe('4連鎖 · 残り18スピン');
  expect(guidance({...s,running:false,settings:{...s.settings,autoAlwaysOn:false}})).toMatchObject({key:'jackpot-paused',target:'auto'});
  const help=renderToStaticMarkup(<JackpotHelp rule="double-high"/>);expect(help).toContain('91以上');expect(help).not.toContain('無限');
  const sweep=renderToStaticMarkup(<PayoffSweep values={Array(100).fill(1)} frame={null} reduced={false} jackpotRule="double-high"/>);
  expect(sweep).not.toContain('91+ × 2');expect(sweep).toContain('jackpot-high-band');
 });
});
describe('current heat economy and completion continuity',()=>{
 it('prices the ninth heat purchase 8 to 9 at $10M, preserves opening price and historical profiles',()=>{
  const current={...playable(),trim:8};expect(upgradePrice(current,'trim')).toBe(10e6);
  expect(upgradePrice({...current,trim:0},'trim')).toBe(500);
  const previous=configure(current,{economyProfile:'v22'}),old=configure(current,{economyProfile:'v20'});
  expect(upgradePrice(previous,'trim')).toBe(67e6);expect(upgradePrice(old,'trim')).toBe(150e6);
  for(const u of ['slots','speed','rush','capacity'] as const)expect(upgradePrice(current,u)).toEqual(upgradePrice(previous,u));
 });
 it('migrates v2.3 progress as a comparison run for the changed Jackpot economy',()=>{
  const old={...playable(),economyRevision:9,spins:12,work:10,spent:999,settings:{...defaultSettings,economyProfile:'v22'}};
  const migrated=readSave(JSON.stringify(old))!;expect(migrated).toMatchObject({cash:old.cash,spins:12,spent:999,debug:true,economyRevision:13,settings:{economyProfile:'v24'}});
  expect(migrated.id).not.toBe(old.id);
  expect(readSave(JSON.stringify(configure(migrated,{economyProfile:'v22'})))!.settings.economyProfile).toBe('v22');
  const cleared=work({...migrated,cash:TARGET-1});expect(cleared.completion).toMatchObject({appVersion:VERSION,rulesetVersion:`astra-v${ECONOMY_REVISION}:classic`,ranked:false});
  expect(ruleset(cleared)).toBe('astra-v13:classic');expect(snapshot(cleared).economyProfile).toBe('v24');
 });
 it('leaves a persistent clear notice and lets the player continue until they choose to open it',()=>{
  const s=work({...playable(),cash:TARGET-1,activeMs:4000});
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(s)});
  const html=renderToStaticMarkup(<App/>);expect(html).toContain('クリア記録を開く');expect(html).not.toContain('class="clear-name-intro"');
  const signup=renderToStaticMarkup(<Leaderboard s={s} clear change={()=>{}} saveName={()=>s} notify={()=>{}}/>);
  expect(signup).toContain('required=""');expect(signup).not.toContain('クリア記念カード');expect(signup).not.toContain('記念カードをシェア');
  const named=renderToStaticMarkup(<Leaderboard s={{...s,completionNickname:'Nuun'}} clear change={()=>{}} saveName={()=>s} notify={()=>{}}/>);
  expect(named).toContain('クリア記念カード');expect(named).toContain('Nuun');expect(named).not.toContain('score-form');expect(named).toContain('画像を長押しして保存');
 });
 it('keeps the share text and PNG based on the completed run, not continued play',async()=>{
  const s=work({...playable(),cash:TARGET-1,activeMs:60000,spins:100});const frozen=clearCardRun({...s,activeMs:9e9,spins:10000});
  const text=resultShareText(frozen,'Nuun');expect(text).toContain('Nuun');expect(text).toContain('1:00');
  const drawing:string[]=[];const ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}}),fillText:(t:string)=>drawing.push(t)},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{},set:()=>true});
  vi.stubGlobal('document',{createElement:()=>({getContext:()=>ctx,toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob(['png'],{type:'image/png'}))})});
  expect((await resultImage(frozen,'Nuun')).type).toBe('image/png');expect(drawing).toContain('Nuun');expect(drawing).toContain(duration(60000));expect(drawing).toContain('100 SPINS');
 });
 it('responds to every WORK tap while respecting disabled motion',()=>{
  const animate=vi.fn(()=>({cancel:()=>{}}));const surface={animate} as unknown as HTMLElement;
  impact(surface,'work',defaultSettings);impact(surface,'work',defaultSettings);expect(animate).toHaveBeenCalledTimes(2);
  impact(surface,'work',{...defaultSettings,motion:'reduced'});expect(animate).toHaveBeenCalledTimes(2);
 });
});
