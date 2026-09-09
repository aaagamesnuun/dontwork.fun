import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {freshRun,freshTrial,resumeTrial,advanceTrial,purchase,spin,work,finish,readSave,TRIAL_MS,TARGET,trialAssets,type Run} from './game/engine';
import {presentationReducer as reduce,presentedRun,type Presentation} from './presentation';
import {startBackground,advanceBackground,resumeBackgroundJackpot,backgroundAccess} from './backgroundPlay';
import {decodeTransfer} from './transferProtocol';
import {chartGeometry} from './TradingViews';
import {clearCardRun,effortStats,ResultCard} from './ResultCard';
import {resultShareText} from './resultShare';
import {SweepReadout} from './SweepReadout';
import {BackgroundSettings} from './BackgroundSettings';
import {betById,CATALOGS} from './game/catalog';
import {defaultLanguage,setLanguage,t} from './i18n';
const ready=():Run=>({...resumeTrial(freshTrial(),1000),cash:1e6,peak:1e6,portfolio:[{id:'edge-50',count:1}],coinEnabled:true});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1000);setLanguage('ja')});
afterEach(()=>{vi.unstubAllGlobals();setLanguage('ja');vi.useRealTimers()});
describe('v3 trial rules and exit safety',()=>{
 it('AUTO clocks empty portfolios and insufficient funds while OFF blocks WORK',()=>{
  let m:Presentation={run:resumeTrial(freshTrial(),1000),pending:null};
  m=reduce(m,{type:'trial-clock',now:11000});expect(m.run.trial?.elapsedMs).toBe(10000);expect(m.run.running).toBe(true);
  m=reduce(m,{type:'change',update:work});expect(m.run.work).toBe(1);
  m=reduce(m,{type:'trial-pause',now:12000});m=reduce(m,{type:'change',update:work});expect(m.run.work).toBe(1);
  m=reduce(m,{type:'trial-clock',now:99000});expect(m.run.trial?.elapsedMs).toBe(11000);
 });
 it('counts upgrade investment once and never draws a purchase loss in the assets chart',()=>{
  let m:Presentation={run:ready(),pending:null};const assets=trialAssets(m.run);
  m=reduce(m,{type:'purchase',update:s=>purchase(s,'speed')});
  expect(m.run.cash).toBeLessThan(assets);expect(trialAssets(m.run)).toBe(assets);
  const chart=chartGeometry(m.run);expect(chart.start).toBe(0);expect(chart.end).toBe(TRIAL_MS);expect(chart.time).toBe(true);
  expect(chart.upgrades).toHaveLength(1);expect(chart.upgrades[0].top).toBe(chart.upgrades[0].y);expect(chart.upgrades[0].spent).toBe(0);
  const done=advanceTrial(m.run,TRIAL_MS+1000);expect(done.trial?.result).toMatchObject({finalBankroll:assets,rulesetVersion:'astra-v13-30m-assets:classic'});
  expect(readSave(JSON.stringify(done))?.trial?.result).toEqual(done.trial?.result);
 });
 it('settles a hidden spin and coins once when exiting exactly at time-up',()=>{
  let m:Presentation={run:ready(),pending:null};m=reduce(m,{type:'change',update:s=>spin(s,80,0)});
  m=reduce(m,{type:'coin-flip',wager:100,forced:true});m=reduce(m,{type:'purchase',update:s=>purchase(s,'speed')});
  const expected=trialAssets(m.run);vi.setSystemTime(TRIAL_MS+1000);
  m=reduce(m,{type:'trial-pause',now:Date.now()});const saved=readSave(JSON.stringify(m.run))!;
  expect(m.pending).toBeNull();expect(saved.trial).toMatchObject({paused:true,anchor:null,elapsedMs:TRIAL_MS,result:{finalBankroll:expected,spins:1}});
  expect(saved.history.reduce((n,p)=>n+(p.coinCount??0),0)).toBe(1);
  const later=reduce({run:saved,pending:null},{type:'trial-clock',now:Date.now()+999999});expect(later.run.trial?.result).toEqual(saved.trial?.result);
 });
 it('clears incoming background clocks and Jackpot auto-resume flags during save transfer',()=>{
  const source=startBackground({...ready(),settings:{...ready().settings,backgroundPlay:true}},1000);
  const decoded=decodeTransfer(JSON.stringify({...source,backgroundJackpot:true}),freshRun(),true)!;
  expect(decoded).toMatchObject({running:false,background:null,backgroundJackpot:false,trial:{paused:true,anchor:null}});
  const applied=reduce({run:freshRun(),pending:null},{type:'change',update:()=>decoded});
  const later=reduce(applied,{type:'trial-clock',now:9999999});expect(later.run.trial?.elapsedMs).toBe(0);expect(later.run.trial?.result).toBeNull();
 });
 it('holds the background clock at the first Jackpot, surviving save/reload until returning',()=>{
  const source=startBackground({...ready(),settings:{...ready().settings,backgroundPlay:true}},1000);
  const hit=advanceBackground(source,999999,true,12000,100).run;
  expect(hit).toMatchObject({spins:1,running:false,background:null,backgroundJackpot:true,trial:{elapsedMs:5000,paused:true}});
  const restored=readSave(JSON.stringify(hit))!;expect(advanceBackground(restored,9999999,true).run.trial?.elapsedMs).toBe(5000);
  const back=resumeBackgroundJackpot(restored,9999999);expect(advanceTrial(back,10000999).trial?.elapsedMs).toBe(6000);
 });
 it('updates next positions immediately without replacing the accepted result or its reserve',()=>{
  const run={...freshRun(),cash:10000,peak:10000,slots:2,portfolio:[{id:'edge-50',count:1}],running:true};
  let m=reduce({run,pending:null},{type:'change',update:s=>spin(s,80,0)});const accepted=m.pending?.after.last;
  m=reduce(m,{type:'position-change',intent:{kind:'count',id:'edge-50',delta:-1}});
  expect(m.run.portfolio).toEqual([]);expect(m.pending?.after.last).toBe(accepted);expect(presentedRun(m).cash).toBe(run.cash);
  m=reduce(m,{type:'reveal',runId:run.id,spinId:m.run.last!.id});expect(m.run.cash).toBe(run.cash+accepted!.profit);expect(m.run.portfolio).toEqual([]);
 });
});
describe('v3 player-facing defaults and records',()=>{
 it('keeps WORK and FLIP statistics frozen when continuing after clear',()=>{
  const clear=finish({...freshRun(),cash:TARGET,work:123,coinWagered:1000,coinPaid:1200});
  const card=clearCardRun({...clear,work:999,coinWagered:5000,coinPaid:0});
  expect(effortStats(card)).toMatchObject({work:'123',wager:'$1K',profit:'+$200',known:true});
  expect(resultShareText(card,'Player')).toContain('#dontwork');expect(renderToStaticMarkup(<ResultCard s={card} name="Player"/>)).toContain('123');
  expect(effortStats(clearCardRun({...clear,clearSnapshot:null})).known).toBe(false);
 });
 it('uses Japanese names and changes the same catalog objects immediately into English',()=>{
  const bet=betById('edge-50'),catalog=CATALOGS[0];const ja=bet.name;expect(ja).not.toBe('BASELINE');
  setLanguage('en');expect(bet.name).toBe('BASELINE');expect(catalog.name).toBe(catalog.en);expect(t('期待値')).toBe('Expected value');
  setLanguage('ja');expect(bet.name).toBe(ja);
 });
 it('chooses EN on an English device unless the player saved JP',()=>{
  vi.stubGlobal('document',{documentElement:{lang:'en'}});vi.stubGlobal('navigator',{languages:['en-US']});
  vi.stubGlobal('localStorage',{getItem:()=>null});expect(defaultLanguage()).toBe('en');
  vi.stubGlobal('localStorage',{getItem:()=> 'ja'});expect(defaultLanguage()).toBe('ja');
 });
 it('defaults to D100 and leaves a plain-number option without exposing a hidden result',()=>{
  expect(freshRun().settings).toMatchObject({rollDisplay:'dice',backgroundPlay:false,music:false});
  const dice=renderToStaticMarkup(<SweepReadout cursor={47} moving/>);expect(dice.match(/<polygon /g)).toHaveLength(100);expect(dice).toContain('47');
  expect(renderToStaticMarkup(<SweepReadout cursor={47} moving display="number"/>)).not.toContain('<svg');
 });
 it('requires sound and granted notifications, but always allows an already-enabled setting to be turned off',()=>{
  const run={...ready(),settings:{...ready().settings,backgroundPlay:true,jackpotNotifications:true}};
  vi.stubGlobal('navigator',{locks:{},serviceWorker:{}});vi.stubGlobal('Notification',{permission:'denied'});expect(backgroundAccess(run)).toBe(false);
  const html=renderToStaticMarkup(<BackgroundSettings s={run} change={()=>{}}/>);expect(html).toContain('バックグラウンド進行をOFFにする');expect(html).not.toContain('disabled=""');
  vi.stubGlobal('Notification',{permission:'granted'});expect(backgroundAccess(run)).toBe(true);expect(backgroundAccess({...run,settings:{...run.settings,sound:false}})).toBe(false);
 });
});
