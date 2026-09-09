import { afterEach,describe,expect,it,vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { freshRun,spin,configure,purchase,TARGET,interval,type Run } from "./game/engine";
import { presentationReducer as reduce,presentedRun } from "./presentation";
import { fundsBecameLow } from "./fundsAlert";
import { autoCycle,remainingSpinMs,spinTiming } from "./spinTiming";
import { advanceBackground,startBackground } from "./backgroundPlay";
import { notificationTransition,notifyJackpot } from "./jackpotNotifications";
import { PayoffSweep,WealthChart } from "./TradingViews";
import { effectEnergy } from "./effectEnergy";
import { resultTones,cueTones } from "./audioPalette";
const ready=():Run=>({...freshRun(),cash:1000,peak:1000,portfolio:[{id:"edge-50",count:1}],running:true,settings:{...freshRun().settings,assist:false}});
afterEach(()=>vi.unstubAllGlobals());
describe("v2.6 timing and alerts",()=>{
 it("does not reveal hidden loss/Jackpot through the charge or low-funds sound",()=>{
  const before={...ready(),cash:10};
  for(const roll of [1,80,100]){
   const model=reduce({run:before,pending:null},{type:"change",update:s=>spin(s,roll,0)}),shown=presentedRun(model);
   expect(autoCycle(model.run,shown,2000,true,0)).toEqual({progress:.4,ready:false});
   expect(autoCycle(model.run,shown,5000,true,0).ready).toBe(false);
   expect(fundsBecameLow(before,shown)).toBe(false);
   const done=reduce(model,{type:"reveal",runId:before.id,spinId:model.run.last!.id});
   expect(fundsBecameLow(shown,done.run)).toBe(roll===1);
   expect(fundsBecameLow(done.run,done.run)).toBe(false);
   expect(autoCycle(done.run,done.run,5000,false,0).ready).toBe(roll!==1);
  }
 });
 it("waits for the reveal after speed purchases, and preserves longer waits on return",()=>{
  const before=ready(),after=purchase(spin(before,100,0),"speed"),delay=spinTiming(before,after).revealDelay;
  const remaining=remainingSpinMs(after,1000,delay-1000),charged=interval(after)-remaining;
  expect(remaining).toBe(3000);expect(charged).toBeLessThan(0);
  expect(autoCycle(after,after,charged+2999,false).ready).toBe(false);expect(autoCycle(after,after,charged+3000,false).ready).toBe(true);
  expect(autoCycle(after,after,5000,false,10).ready).toBe(false);
 });
 it("background and foreground use the same next-cycle interval including OS reduced motion",()=>{
  for(const reduced of [false,true]){
   const before={...ready(),settings:{...freshRun().settings,backgroundPlay:true}},result=advanceBackground(startBackground(before,1000),6000,false,1,75,reduced),after=result.run;
   expect(after.background!.remainingMs).toBe(remainingSpinMs(after,0,spinTiming(before,after,reduced).revealDelay));
   expect(after.debug).toBe(false);
  }
 });
 it("standard background keeps its earned ranking time after later catch-up spins",()=>{
  const before={...freshRun(),settings:{...freshRun().settings,backgroundPlay:true},cash:TARGET-1,peak:TARGET-1,portfolio:[{id:"edge-50",count:1}],running:true};
  const after=advanceBackground(startBackground(before,1000),13000,true,100,75).run;
  expect(after.debug).toBe(false);expect(after.completion).toMatchObject({ranked:true,timeMs:5000,appVersion:"3.0.0"});expect(after.activeMs).toBe(12000);
  expect(configure(after,{backgroundPlay:false}).completion).toEqual(after.completion);
 });
 it("makes the funds alarm audible independently of small-loss filtering",()=>{
  const settings={...freshRun().settings,lossVolume:0,soundDensity:"highlights" as const};
  const alarm=resultTones("cash-low",settings);expect(alarm.length).toBeGreaterThanOrEqual(6);expect(alarm.some(t=>t.frequency<100)).toBe(true);expect(alarm.some(t=>t.offset>=.36)).toBe(true);
  expect(alarm.reduce((s,t)=>s+t.gain,0)).toBeGreaterThan(cueTones("work",settings).reduce((s,t)=>s+t.gain,0));
  expect(resultTones("cash-low",{...settings,soundVolume:0}).every(t=>t.gain===0)).toBe(true);
 });
});
describe("v2.6 notifications and optional effects",()=>{
 it("only notifies live entry/infinity, never catch-up or every chain",()=>{
  const before={...ready(),settings:{...ready().settings,jackpotNotifications:true}},entry=spin(before,100),chain=spin(entry,100);
  const steps=[{before,after:entry},{before:entry,after:chain}];
  expect(notificationTransition(steps,1000,0,false)).toBe(entry);
  expect(notificationTransition(steps,1000,0,true)).toBeNull();expect(notificationTransition(steps,10000,0,false)).toBeNull();
  expect(notificationTransition([{before:entry,after:chain}],1000,0,false)).toBeNull();
 });
 it("requires granted opt-in, deduplicates, renotifies and tolerates unsupported registrations",async()=>{
  const showNotification=vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("MessageChannel",undefined);vi.stubGlobal("Notification",{permission:"granted"});vi.stubGlobal("document",{hidden:true});
  vi.stubGlobal("navigator",{serviceWorker:{getRegistration:vi.fn().mockResolvedValue({active:{},showNotification})}});
  const run=spin({...ready(),settings:{...ready().settings,jackpotNotifications:true}},100);
  expect(await notifyJackpot(run)).toBe(true);expect(await notifyJackpot(run)).toBe(false);
  expect(showNotification).toHaveBeenCalledWith(expect.stringContaining("JACKPOT"),expect.objectContaining({renotify:true,data:{url:"/play",clientId:null}}));
  expect(await notifyJackpot({...run,id:crypto.randomUUID(),settings:{...run.settings,jackpotNotifications:false}})).toBe(false);
  vi.stubGlobal("Notification",{permission:"denied"});expect(await notifyJackpot({...run,id:crypto.randomUUID()})).toBe(false);
  expect(showNotification).toHaveBeenCalledTimes(1);
 });
 it("moves the gold flag only after a revealed high roll, including SVG",()=>{
  for(const style of ["classic","net","chart"] as const){
   const regular=renderToStaticMarkup(<PayoffSweep values={Array(100).fill(1)} frame={null} reduced={false} style={style}/>);
   const armed=renderToStaticMarkup(<PayoffSweep values={Array(100).fill(1)} frame={null} reduced={false} style={style} jackpotHigh/>);
   expect(armed).toContain("jackpot-ready");expect(regular).not.toContain("jackpot-ready");
   if(style!=="chart"){expect(regular).toContain('left:99.5%');expect(armed).toContain('left:90.5%');}
   else expect(armed).toContain('x1="895.28"');
  }
 });
 it("leaves coins in chart accounting but shows their markers only in LAB",()=>{
  const run={...ready(),spins:2,history:[{cash:1000,at:0,spin:0,kind:"start"},{cash:1200,at:1000,spin:2,kind:"win",coinCount:20,coinProfit:200}]};
  expect(renderToStaticMarkup(<WealthChart s={run}/>)).not.toContain('class="coin-marker-svg"');
  expect(renderToStaticMarkup(<WealthChart s={configure(run,{coinChartMarkers:true})}/>)).toContain('class="coin-marker-svg"');
 });
 it("scales multiple effects together and resets optional overall-win intensity",()=>{
  const settings=freshRun().settings;
  expect(effectEnergy(settings,{streak:30})).toBe(1);
  const boosted={...settings,streakEffects:true,effectIntensity:2};
  expect(effectEnergy(boosted,{streak:30})).toBe(4);
  expect(effectEnergy(boosted,{streak:0})).toBe(2);
  const low=resultTones("win",boosted,1),high=resultTones("win",boosted,20);
  expect(high.length).toBeGreaterThan(low.length);expect(high.length).toBeLessThan(28);expect(high.every(t=>t.gain<=.3)).toBe(true);
  expect(configure(ready(),{sweepSound:true,coinChartMarkers:true,streakEffects:true,effectIntensity:2}).debug).toBe(false);
  expect(configure(configure(ready(),{handToys:true,dockToy:"charge"}),{workMode:"gamble"}).settings.dockToy).toBe("off");
 });
});
