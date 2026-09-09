import { describe,it,expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { freshRun,defaultSettings,spin,work,purchase,drawUpgrade,configure,readSave,coinUnlocked,playCoinFlip, fuelCapacity,TARGET,type Run } from "./engine";
import { presentationReducer as reduce,presentedRun,coinBudget,type Presentation } from "../presentation";
import { PayoffSweep } from "../TradingViews";
import { CoinFlip } from "../CoinFlip";
import { particleCount,payoutMilestone } from "../ResultVisuals";
import { impactScale } from "../impact";
const ready=():Run=>({...freshRun(),cash:1000,peak:1e6,portfolio:[{id:"edge-50",count:1}],coinEnabled:true,settings:{...defaultSettings,assist:false}});
const begin=(s:Run,roll:number)=>reduce({run:s,pending:null},{type:"change",update:r=>spin(r,roll)});
const reveal=(s:Presentation)=>reduce(s,{type:"reveal",runId:s.run.id,spinId:s.run.last!.id});
describe("v2.6 simultaneous actions",()=>{
 it.each([1,80,100])("buys repeatedly during hidden %s, holding its result and spend reserve",roll=>{
  let state=begin(ready(),roll);const outcome=state.run.last;
  for(let i=0;i<3;i++)state=reduce(state,{type:"purchase",update:r=>purchase(r,"speed")});
  expect(state.run.speed).toBe(3);expect(state.run.spent).toBe(91);
  expect(presentedRun(state)).toMatchObject({cash:909,spins:0,last:null,speed:3});
  expect(state.run.last).toBe(outcome);expect(coinBudget(state)).toBe(899);
  state=reduce(state,{type:"coin-flip",wager:100,forced:false});
  expect(presentedRun(state).cash).toBe(809);
  const done=reveal(state);expect(done.run.cash).toBe(809+outcome!.profit);
  expect(done.run.history.filter(p=>p.kind==="upgrade")).toHaveLength(3);
  expect(readSave(JSON.stringify(done.run))!.spent).toBe(91);expect(reveal(done)).toBe(done);
 });
 it("never draws newly hidden Jackpot upgrades, and never spends a hidden win",()=>{
  const s={...ready(),settings:{...defaultSettings,upgradeMode:"gacha" as const}};
  for(const roll of [1,80,100]){
   const state=reduce(begin(s,roll),{type:"purchase",update:r=>drawUpgrade(r,()=>.99)});
   expect(state.run.lastUpgradeDraw?.upgrade).toBe("speed");expect(state.run.trim).toBe(0);expect(state.run.rush).toBe(0);
  }
  const low=begin({...ready(),cash:20},80);expect(reduce(low,{type:"purchase",update:r=>purchase(r,"speed")})).toBe(low);
 });
 it("fills capacity identically before and after reveal",()=>{
  const initial={...ready(),fuel:5,settings:{...defaultSettings,fuelEnabled:true}};
  const state=reduce(begin(initial,80),{type:"purchase",update:r=>purchase(r,"capacity")});
  expect(presentedRun(state).fuel).toBe(fuelCapacity(state.run));expect(reveal(state).run.fuel).toBe(fuelCapacity(state.run));
 });
 it("keeps a public WORK unlock and a public clear through immediate spending",()=>{
  let state=begin({...ready(),cash:999995,peak:999995},1);
  for(let i=0;i<5;i++)state=reduce(state,{type:"change",update:work});
  expect(coinUnlocked(presentedRun(state))).toBe(true);
  state=reduce(state,{type:"purchase",update:r=>purchase(r,"speed")});expect(coinUnlocked(presentedRun(state))).toBe(true);expect(coinUnlocked(reveal(state).run)).toBe(true);
  state=begin({...ready(),cash:TARGET-5,peak:TARGET-5},1);
  for(let i=0;i<5;i++)state=reduce(state,{type:"change",update:work});
  expect(state.run.completion).not.toBeNull();const record=state.run.completion;
  state=reduce(state,{type:"purchase",update:r=>purchase(r,"speed")});expect(reveal(state).run.completion).toEqual(record);
 });
 it("requires a public $1M peak for coins, including old saves and a hidden first win",()=>{
  const low={...ready(),peak:999999,cash:999999};expect(playCoinFlip(low,10,true)).toBe(low);
  const state=begin(low,80);expect(reduce(state,{type:"coin-flip",wager:10,forced:true})).toBe(state);
  expect(playCoinFlip({...ready(),cash:10},10,true).coinRounds).toBe(1);
  expect(readSave(JSON.stringify(low))!.coinEnabled).toBe(false);
  const html=renderToStaticMarkup(<CoinFlip s={low} budget={999} onChange={()=>{}}/>);expect(html).toContain("解禁");expect(html).not.toContain("coin-stakes");
 });
});
describe("v2.6 Jackpot and presentation defaults",()=>{
 it("triggers on 100 or consecutive high rolls and resets on 90",()=>{
  let s=ready();const hits=[];
  for(const roll of [91,92,93,90,91,100,91]){s=spin(s,roll);hits.push(s.last?.jackpot)}
  expect(hits).toEqual([false,true,true,false,false,true,true]);
  expect(spin({...ready(),rushLeft:1,jackpotHigh:true},91).rushLeft).toBe(20);
  const infinite=spin({...ready(),rushLeft:1,removed:99},100);expect(infinite.last?.jackpot).toBe(true);expect(infinite.rushLeft).toBe(20);
 });
 it("uses the 32nd spin assistance and preserves strict historical comparisons",()=>{
  const s={...ready(),spins:31,settings:{...defaultSettings,assist:true}};const n=spin(s);expect(n.last).toMatchObject({roll:100,jackpot:true,assisted:true});
  expect(spin({...ready(),settings:{...defaultSettings,jackpotRule:"double-high"}},100).last?.jackpot).toBe(false);
  expect(spin({...ready(),jackpotHigh:true,settings:{...defaultSettings,jackpotRule:"hundred"}},91).last?.jackpot).toBe(false);
 });
 it("migrates v2.5 progress once while retaining alternate choices and earned records",()=>{
  const {spectacleRevision,...settings}=defaultSettings;
  const old={...ready(),economyRevision:11,settings:{...settings,jackpotRule:"hundred",winVisual:"classic",jackpotVisual:"classic",chartBackdrop:"off",soundPack:"terminal"}};
  const restored=readSave(JSON.stringify(old))!;expect(restored).toMatchObject({id:old.id,cash:1000,debug:false,economyRevision:13,settings:{jackpotRule:"combined",winVisual:"festival",jackpotVisual:"festival",chartBackdrop:"pulse",soundPack:"arcade-coinop"}});
  const alternative=configure(restored,{winVisual:"neon",chartBackdrop:"off",soundPack:"wood"});expect(readSave(JSON.stringify(alternative))!.settings).toMatchObject({winVisual:"neon",chartBackdrop:"off",soundPack:"wood"});
  const toys=configure({...ready(),cash:TARGET-1},{handToys:true});expect(work(toys).completion?.ranked).toBe(false);
 });
 it("shows a high band and all decade ticks without the old 91×2 label",()=>{
  const html=renderToStaticMarkup(<PayoffSweep values={Array(100).fill(1)} frame={null} reduced={false}/>);
  expect(html).toContain("jackpot-high-band");expect(html).not.toContain("91+ × 2");for(const n of [1,10,20,30,40,50,60,70,80,90,100])expect(html).toContain(`>${n}<`);
 });
 it("scales celebrations with amounts and streaks while keeping effects bounded",()=>{
  expect(particleCount(1e6)).toBeGreaterThan(particleCount(10));expect(particleCount(1e200,true,true)).toBeLessThanOrEqual(48);
  expect(impactScale({amount:1e6,streak:20})).toBeGreaterThan(impactScale({amount:10,streak:1}));expect(impactScale({amount:1e200,streak:1e8})).toBeLessThanOrEqual(3.5);
  expect(payoutMilestone(99,100)).toBe(true);expect(payoutMilestone(100,999)).toBe(false);expect(payoutMilestone(1000,10)).toBe(false);
 });
});
