import {describe,it,expect,vi,afterEach} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {freshRun,freshTrial,configure,coinUnlocked,needsCoinUnlockNotice,spin,playCoinFlip,purchase,readSave,COIN_STAKES,TARGET,defaultSettings,type Run} from "./game/engine";
import {presentationReducer,presentedRun,coinBudget,type Presentation} from "./presentation";
import {chartGeometry,WealthChart} from "./TradingViews";
import {CoinFlip,nextDockPanel,dockLabel} from "./CoinFlip";
import {GameHelp,NewsHelp,newsTopic} from "./GameHelp";
import {guidance} from "./game/guidance";
import {cueTones,resultTones} from "./audioPalette";
import {ResultCard,clearCardRun} from "./ResultCard";
const ready=():Run=>({...freshRun(),settings:{...defaultSettings,coinFlip:true},cash:1000,peak:1e6,coinEnabled:true,portfolio:[{id:"edge-50",count:1}],history:[{cash:1000,at:0,spin:0,kind:"start"}]});
const start=(run:Run,roll:number)=>presentationReducer({run,pending:null},{type:"change",update:r=>spin(r,roll)});
const flip=(state:Presentation,won:boolean,wager=100)=>presentationReducer(state,{type:"coin-flip",wager,forced:won});
const reveal=(state:Presentation)=>presentationReducer(state,{type:"reveal",runId:state.run.id,spinId:state.run.last!.id});
afterEach(()=>vi.unstubAllGlobals());
describe("coins independent of the main spin",()=>{
 it("uses exact powers of ten and fair net +/- stakes",()=>{
  expect(COIN_STAKES.slice(0,5)).toEqual([10,100,1000,10000,100000]);
  const s=ready(),win=playCoinFlip(s,100,true),loss=playCoinFlip(s,100,false);
  expect(win.cash+loss.cash).toBe(s.cash*2);
  for(const n of [win,loss]){expect(n.spins).toBe(s.spins);expect(n.history).toBe(s.history);expect(n.last).toBe(s.last);expect(n.memory).toBe(s.memory);expect(n.debug).toBe(false)}
  for(const amount of [0,20,11,-10,NaN,Infinity,10000])expect(playCoinFlip(s,amount,true)).toBe(s);
  expect(playCoinFlip({...s,coinEnabled:false},10,true).coinRounds).toBe(0);
 });
 it.each([1,80,100])("reserves the same funds during hidden roll %i and publishes one combined landing",roll=>{
  const s=ready();let model=start(s,roll);const result=model.run.last;
  expect(coinBudget(model)).toBe(990);
  model=flip(model,true);model=flip(model,false,10);
  expect(presentedRun(model)).toMatchObject({cash:1090,spins:0,last:null});
  expect(chartGeometry(presentedRun(model)).recordedCash).toBe(1000);
  const done=reveal(model);expect(done.run.cash).toBe(1090+result!.profit);expect(done.run.last).toBe(result);
  expect(done.run.history.filter(p=>p.kind==="spin")).toHaveLength(1);expect(chartGeometry(done.run).recordedCash).toBe(done.run.cash);
  expect(reveal(done)).toBe(done);
 });
 it("merges coins before and during a reveal once, with a marker even at net zero",()=>{
  for(const won of [true,false]){
   const before=playCoinFlip(ready(),100,won);
   let model=start(before,80);model=flip(model,!won,100);
   expect(chartGeometry(presentedRun(model)).coins).toHaveLength(0);
   const done=reveal(model),mark=chartGeometry(done.run).coins;
   expect(done.run).toMatchObject({coinPendingCount:0,coinPendingProfit:0});
   expect(mark).toHaveLength(1);expect(mark[0]).toMatchObject({count:2,profit:0,cash:done.run.cash});
   expect(mark[0].x).toBe(chartGeometry(done.run).coords.at(-1)!.x);
   expect(reveal(done)).toBe(done);
   expect(chartGeometry(reveal(start(done.run,1)).run).coins).toHaveLength(1);
  }
 });
 it("aggregates the actual wallet differences before rounding at large balances",()=>{
  const initial={...ready(),cash:2**54-100};
  const first=playCoinFlip(initial,10,true),second=playCoinFlip(first,100,true);
  expect(second.coinPendingProfit).toBe(second.cash-initial.cash);
 });
 it("keeps pending coin annotations through save and does not invent markers for older saves",()=>{
  const played=playCoinFlip(ready(),100,false),saved=readSave(JSON.stringify(played))!;
  expect(saved).toMatchObject({coinPendingCount:1,coinPendingProfit:-100});
  expect(chartGeometry(reveal(start(saved,80)).run).coins[0]).toMatchObject({count:1,profit:-100});
  const {coinPendingCount,coinPendingProfit,...old}=played;
  const restored=readSave(JSON.stringify(old))!;
  expect(restored).toMatchObject({coinPendingCount:0,coinPendingProfit:0});
  expect(chartGeometry(reveal(start(restored,80)).run).coins).toHaveLength(0);
  for(const patch of [{coinPendingCount:-1},{coinPendingCount:2},{coinPendingProfit:Infinity}])
   expect(readSave(JSON.stringify({...played,...patch}))).toBeNull();
 });
 it.each(["spins","time"] as const)("anchors coin markers to the same %s geometry at both chart ranges",chartAxis=>{
  const s={...ready(),spins:300,settings:{...defaultSettings,coinFlip:true,chartAxis,coinChartMarkers:true},history:[
   {cash:10000,at:0,spin:0,kind:"start"},
   {cash:500,at:1500,spin:150,kind:"win",coinCount:3,coinProfit:-30},
   {cash:900,at:3000,spin:300,kind:"win"},
  ]};
  for(const range of ["all","recent"] as const){
   const chart=chartGeometry(s,range),index=range==="all"?1:0;
   expect(chart.coins[0]).toMatchObject({...chart.coords[index],profit:-30,count:3});
   const html=renderToStaticMarkup(<WealthChart s={s}/>);expect(html).toContain('class="coin-marker-svg"');expect(html).toContain('コイン −$30');
  }
 });
 it("cannot spend a hidden win or overdraw through repeated losses, even in jackpot",()=>{
  for(const roll of [1,80,100]){
   let model=start({...ready(),rushLeft:20},roll);
   for(let i=0;i<99;i++)model=flip(model,false,10);
   expect(coinBudget(model)).toBe(0);expect(flip(model,false,10)).toBe(model);expect(model.run.cash).toBeGreaterThanOrEqual(0);
  }
 });
 it.each(["spins","time"] as const)("freezes the %s chart through coins, purchases and reload until the next spin",chartAxis=>{
  let run={...ready(),settings:{...defaultSettings,coinFlip:true,chartAxis}};
  const original=chartGeometry(run);run=playCoinFlip(run,100,true);run=purchase(run,"speed");
  expect(chartGeometry(run)).toEqual(original);
  run=readSave(JSON.stringify(run))!;expect(chartGeometry(run)).toEqual(original);
  const done=reveal(start(run,80));expect(done.run.coinChartHold).toBeNull();expect(chartGeometry(done.run).recordedCash).toBe(done.run.cash);
  expect(done.run.history.some(p=>p.kind==="upgrade")).toBe(true);
  expect(chartGeometry(done.run).coins[0]).toMatchObject({profit:100,count:1});
 });
 it("preserves both a public coin peak and a hidden main peak through later losses",()=>{
  let model=flip(start(ready(),80),true,1000);expect(model.run.coinRounds).toBe(0);
  model=flip(start({...ready(),cash:1e6},80),true,100);model=flip(model,false,100);
  expect(reveal(model).run.peak).toBe(1_000_120);
 });
 it("retains a visible coin-earned clear even when the hidden main bet loses",()=>{
  const s={...ready(),cash:TARGET-50,peak:TARGET-50,slots:10,portfolio:[{id:"edge-50",count:10}],activeMs:3000};
  const model=flip(start(s,1),true);
  expect(presentedRun(model).cash).toBe(TARGET+50);expect(model.run.cash).toBe(TARGET-50);
  expect(model.run.completion).not.toBeNull();const record=model.run.completion;
  const done=reveal(flip(model,false));expect(done.run.completion).toEqual(record);
  const card=clearCardRun(done.run);expect(card.coinChartHold).toBeNull();
  expect(chartGeometry(card).coins.at(-1)).toMatchObject({profit:100,count:1});
  expect(readSave(JSON.stringify(done.run))!.completion).toEqual(record);
 });
 it("keeps old clears immutable and v2.4 saves eligible",()=>{
  const s=playCoinFlip({...ready(),cash:TARGET-50},100,true),record=s.completion;
  expect(playCoinFlip(s,1000,false).completion).toBe(record);
  const old={...ready(),economyRevision:10};
  const restored=readSave(JSON.stringify(old))!;expect(restored).toMatchObject({id:old.id,cash:1000,debug:false,economyRevision:13});
  for(const bad of [false,0,"",{},[{}]])expect(readSave(JSON.stringify({...ready(),coinChartHold:bad}))).toBeNull();
 });
});
describe("coin navigation, contextual help and effect recipes",()=>{
 it("cycles the three named destinations and keeps stake controls usable while a main spin is pending",()=>{
  expect([nextDockPanel("spin",true),nextDockPanel("upgrades",true),nextDockPanel("positions",true),nextDockPanel("coin",true)].map(dockLabel)).toEqual(["アップグレード","ギャンブル","コインフリップ","アップグレード"]);
  const html=renderToStaticMarkup(<CoinFlip s={ready()} budget={990} onChange={()=>{}}/>);expect(html).toContain("WORKをFLIPにする");expect(html).toContain("1K");expect(html).not.toContain("バカラ");
 });
 it("explains current news and game rules without spoiling infinity",()=>{
  expect(newsTopic("tip-0")).toBe("spin");expect(newsTopic("first-work")).toBe("work");expect(newsTopic("tip-3")).toBe("jackpot");
  const s=ready(),help=renderToStaticMarkup(<GameHelp s={s}/>);expect(help).toContain("JACKPOT");expect(help).not.toContain("無限");
  const g=guidance({...s,spins:1,spent:0,running:true});
  const html=renderToStaticMarkup(<NewsHelp s={{...s,settings:{...s.settings,upgradeMode:"gacha"}}} guide={g}/>);expect(html).toContain("強化ガチャ");expect(html).not.toContain("スピン周期の価格ボタン");
 });
 it("has distinct bounded Arcade recipes and pitch ratios",()=>{
  const signatures=new Set<string>();
  for(const soundPack of ["arcade-coinop","arcade-pinball","arcade-synth","arcade-punch"] as const){
   const settings={...defaultSettings,soundPack};signatures.add(JSON.stringify(cueTones("jackpot",settings)));
   for(const cue of ["work","ui","loss","win","jackpot","chain","infinity"] as const){
    const tones=resultTones(cue,settings,8);expect(tones.length).toBeLessThanOrEqual(28);
    for(const tone of tones){expect(tone.frequency).toBeGreaterThan(0);expect(tone.pitchEnd??1).toBeLessThan(3)}
   }
   expect(readSave(JSON.stringify({...ready(),settings}))!.settings.soundPack).toBe(soundPack);
  }
  expect(signatures.size).toBe(4);
 });
 it("omits chart backdrops and holds from a shareable summary",()=>{
  const s={...ready(),coinChartHold:[{cash:10,at:0,spin:0,kind:"start"}],settings:{...defaultSettings,chartBackdrop:"flow" as const}};
  const html=renderToStaticMarkup(<WealthChart s={s} summary/>);expect(html).not.toContain("chart-backdrop");expect(html).toContain("最新の記録$1K");
 });
});


describe("LAB-only coin availability",()=>{
 it("keeps ordinary players on WORK at any wealth, even with an old FLIP selection",()=>{
  const run={...freshRun(),cash:1e8,peak:1e8,coinEnabled:true};
  expect(coinUnlocked(run)).toBe(false);
  expect(needsCoinUnlockNotice(run)).toBe(false);
  expect(playCoinFlip(run,100,true)).toBe(run);
  const model={run,pending:null};expect(flip(model,true)).toBe(model);
  expect(nextDockPanel("positions",coinUnlocked(run))).toBe("upgrades");
  expect(renderToStaticMarkup(<CoinFlip s={run} budget={run.cash} onChange={()=>{}}/>)).toBe("");
  expect(renderToStaticMarkup(<GameHelp s={run}/>)).not.toContain("コインフリップ");
  expect(renderToStaticMarkup(<ResultCard s={run} name="PLAYER"/>)).not.toContain("FLIP");
 });
 it("requires both LAB opt-in and a public peak above $10K without turning WORK into FLIP",()=>{
  const run=configure({...freshRun(),cash:10001,peak:10001},{coinFlip:true});
  expect(coinUnlocked(run)).toBe(true);expect(run.coinEnabled).toBe(false);
  expect(coinUnlocked({...run,peak:10000})).toBe(false);
  expect(needsCoinUnlockNotice(run)).toBe(true);
  expect(renderToStaticMarkup(<GameHelp s={run}/>)).toContain("コインフリップ");
  expect(run.debug).toBe(false); // Availability moved to LAB; the existing fair-coin rule is unchanged.
 });
 it("turns FLIP off without losing money or its next-spin chart settlement",()=>{
  const played=playCoinFlip(ready(),100,true),disabled=configure(played,{coinFlip:false});
  expect(disabled.coinEnabled).toBe(false);expect(coinUnlocked(disabled)).toBe(false);
  for(const key of ["id","cash","coinRounds","coinWagered","coinPaid","coinChartHold","coinPendingProfit","coinPendingCount","completion"] as const)
   expect(disabled[key]).toEqual(played[key]);
  const loaded=readSave(JSON.stringify(disabled))!;
  expect(loaded.settings.coinFlip).toBe(false);
  expect(reveal(start(loaded,80)).run.cash).toBe(loaded.cash+20);
  expect(chartGeometry(reveal(start(loaded,80)).run).coins[0]).toMatchObject({profit:100,count:1});
  expect(renderToStaticMarkup(<ResultCard s={loaded} name="PLAYER"/>)).toContain("FLIPの賭け金累計");
 });
 it("migrates old saves to OFF and preserves their completed records and coin accounting",()=>{
  const played=playCoinFlip({...ready(),cash:TARGET-50},100,true);
  const {coinFlip:legacyMissing,...settings}=played.settings;
  const loaded=readSave(JSON.stringify({...played,settings}))!;
  expect(loaded).toMatchObject({id:played.id,cash:played.cash,coinEnabled:false,coinRounds:played.coinRounds,coinPaid:played.coinPaid,settings:{coinFlip:false}});
  expect(loaded.completion).toEqual(played.completion);
  expect(loaded.coinPendingProfit).toBe(played.coinPendingProfit);
  expect(loaded.debug).toBe(played.debug);
  for(const coinFlip of [null,1,"true",{}]) expect(readSave(JSON.stringify({...played,settings:{...played.settings,coinFlip}}))).toBeNull();
 });
 it("starts each new challenge with the coin experiment disabled",()=>{
  const trial=freshTrial({...defaultSettings,coinFlip:true});
  expect(trial.settings.coinFlip).toBe(false);expect(trial.coinEnabled).toBe(false);expect(trial.debug).toBe(false);
 });
});
