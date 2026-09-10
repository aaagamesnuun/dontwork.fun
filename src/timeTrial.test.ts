import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {advanceTrial,freshRun,freshTrial,pauseTrial,resumeTrial,trialRemaining,trialActive,totalCost,TRIAL_MS,work,spin,configure,purchase,finish,TARGET,readSave,playCoinFlip,switchCatalog,type Run} from './game/engine';
import {presentationReducer,presentedRun,type Presentation} from './presentation';
import {advanceBackground,startBackground} from './backgroundPlay';
import {decodeTransfer} from './transferProtocol';
import {switchTrialMode,NORMAL_SLOT,TRIAL_SLOT} from './trialSaves';
import {saveTrialName,flushTrialScores,readTrialOutbox} from './trialScores';
const start=()=>resumeTrial(freshTrial(),1000);
const rich=():Run=>({...start(),settings:{...start().settings,coinFlip:true,backgroundPlay:true},cash:1000000,peak:1000000,portfolio:[{id:'edge-50',count:1}],coinEnabled:true,running:true});
const model=(s=rich()):Presentation=>({run:s,pending:null});
const change=(m:Presentation,update:(s:Run)=>Run)=>presentationReducer(m,{type:'change',update});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(1000);const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()});
describe('30 minute competition',()=>{
 it('starts only explicitly, counts idle wall time, and preserves normal early clear behavior',()=>{
  const ready=freshTrial();expect(trialActive(ready)).toBe(false);expect(work(ready)).toBe(ready);
  let s=advanceTrial(start(),61000);expect(trialRemaining(s.trial!)).toBe(TRIAL_MS-60000);
  s=finish({...s,cash:TARGET*2});expect(s.completion).toBeNull();expect(s.clearAt).toBeNull();
  expect(finish({...freshRun(),cash:TARGET}).completion).not.toBeNull();
 });
 it('never assists the opening jackpot, even when LAB attempts to enable it',()=>{
  const s={...rich(),spins:100,settings:{...rich().settings,assist:true,assistAfter:1}};
  vi.spyOn(crypto,'getRandomValues').mockImplementation((array:any)=>{array.fill(40);return array});
  const rolled=spin(s);expect(rolled.last?.assisted).toBe(false);expect(rolled.assistUsed).toBe(false);
 });
 it('pause blocks WORK, spins and FLIP but permits upgrades and position changes',()=>{
  const paused=pauseTrial(rich(),31000);expect(trialRemaining(paused.trial!)).toBe(TRIAL_MS-30000);
  expect(advanceTrial(paused,99999999)).toBe(paused);
  expect(work(paused)).toBe(paused);expect(spin(paused,80)).toBe(paused);expect(playCoinFlip(paused,10,true)).toBe(paused);
  let m=presentationReducer(model(paused),{type:'purchase',update:s=>purchase(s,'speed')});expect(m.run.speed).toBe(1);expect(m.run.cash).toBeLessThan(paused.cash);
  m=presentationReducer(m,{type:'position-change',intent:{kind:'count',id:'edge-50',delta:-1}});expect(m.run.portfolio).toEqual([]);
  expect(m.run.trial?.elapsedMs).toBe(30000);
  const resumed=advanceTrial(resumeTrial(m.run,100000),101000);expect(resumed.trial?.elapsedMs).toBe(31000);
 });
 it('settles an accepted hidden spin and coin once, then freezes final assets at the deadline',()=>{
  let m=change(model(),s=>spin(s,80,0));expect(presentedRun(m).spins).toBe(0);
  m=presentationReducer(m,{type:'coin-flip',wager:10,forced:true});const accepted=m.run.cash;
  m=presentationReducer(m,{type:'trial-clock',now:1000+TRIAL_MS});
  expect(m.pending).toBeNull();expect(m.run.trial?.result?.finalBankroll).toBe(accepted);expect(m.run.trial?.result?.spins).toBe(1);
  const result=m.run.trial?.result;vi.setSystemTime(1000+TRIAL_MS+1);
  m=change(m,work);m=presentationReducer(m,{type:'coin-flip',wager:10,forced:true});m=presentationReducer(m,{type:'purchase',update:s=>purchase(s,'speed')});
  m=change(m,s=>({...s,cash:s.cash+100000}));
  expect(m.run.trial?.result).toBe(result);expect(m.run.cash).toBe(accepted);expect(switchCatalog(m.run,'legacy')).toBe(m.run);
  expect(readSave(JSON.stringify(m.run))?.trial?.result).toEqual(result);
 });
 it('refuses an action arriving on the exact deadline before the next display tick',()=>{
  vi.setSystemTime(1000+TRIAL_MS);const m=change(model(),work);expect(m.run.work).toBe(0);expect(m.run.trial?.result?.finalBankroll).toBe(1000000);
 });
 it('pause reveals already accepted results without requiring another spin',()=>{
  const pending=change(model(),s=>spin(s,1,0));const paused=presentationReducer(pending,{type:'trial-pause',now:3000});
  expect(paused.pending).toBeNull();expect(paused.run.cash).toBe(pending.run.cash);expect(paused.run.trial?.paused).toBe(true);
 });
 it('uses final bankroll, not peak; snapshots the score before any restart',()=>{
  const done=advanceTrial({...rich(),cash:123,peak:999999999},1000+TRIAL_MS);expect(done.trial?.result?.finalBankroll).toBe(123);
  expect(done.trial?.result?.ranked).toBe(true);
 });
 it.each(['shop','lottery'] as const)('extends time in %s while paused, permanently excludes the variant',rule=>{
  const s={...freshTrial(undefined,rule),cash:1000,peak:1000};
  const m=presentationReducer(model(s),{type:'trial-time',now:1000,forced:true});
  expect(m.run.cash).toBe(900);expect(m.run.trial?.addedMs).toBe(rule==='shop'?60000:120000);expect(m.run.debug).toBe(true);
  expect(advanceTrial(resumeTrial(m.run,1000),TRIAL_MS+121000).trial?.result?.ranked).toBe(false);
 });
 it('time lottery losses cost money, and cannot spend a pending spin reserve',()=>{
  const s={...resumeTrial(freshTrial(undefined,'lottery'),1000),cash:100,peak:100,portfolio:[{id:'edge-50',count:1}]};
  const pending=change(model(s),run=>spin(run,80,0));
  const rejected=presentationReducer(pending,{type:'trial-time',now:1000,forced:true});expect(rejected.run.trial?.purchases).toBe(0);
  const lost=presentationReducer(model(s),{type:'trial-time',now:1000,forced:false});expect(lost.run.cash).toBe(0);expect(lost.run.trial?.addedMs).toBe(0);
 });
 it('stops background spins at the deadline, including when background bankroll is blocked',()=>{
  const near={...rich(),trial:{...rich().trial!,elapsedMs:TRIAL_MS-11000}};
  const bg=startBackground(near,1000);const done=advanceBackground(bg,9999999,true,12000,80);
  expect(done.done).toBe(true);expect(done.run.trial?.result).not.toBeNull();expect(done.run.spins).toBe(2);expect(done.run.trial?.elapsedMs).toBe(TRIAL_MS);
  const poor=startBackground({...near,cash:totalCost(near)},1000);const out=advanceBackground(poor,9999999,true,12000,1);
  expect(out.run.spins).toBe(1);expect(out.run.trial?.result).not.toBeNull();
 });
 it('settles background spins before a media pause',()=>{
  const bg=startBackground(rich(),1000);const paused=presentationReducer(model(bg),{type:'trial-pause',now:15000});
  expect(paused.run.spins).toBeGreaterThan(0);expect(paused.run.background).toBeNull();expect(paused.run.trial?.elapsedMs).toBe(14000);expect(paused.run.trial?.paused).toBe(true);
 });
 it('restores clocks and names and retains normal saves in a separate slot',()=>{
  const normal={...freshRun(),cash:100,peak:100};const trial=switchTrialMode(normal,'trial','fixed',1000);
  expect(readSave(localStorage.getItem(NORMAL_SLOT))?.cash).toBe(100);
  const progressed=advanceTrial(resumeTrial(trial,1000),31000);
  expect(switchTrialMode(progressed,'trial',undefined,40000)).toBe(progressed);
  expect(switchTrialMode(progressed,'normal',undefined,40000).cash).toBe(100);
  const stored=readSave(localStorage.getItem(TRIAL_SLOT));expect(stored?.trial?.paused).toBe(true);expect(stored?.trial?.elapsedMs).toBe(39000);
  expect(readSave(JSON.stringify(freshRun()))?.trial).toBeNull();
 });
 it('keeps earned ranking eligibility when settings change after finishing',()=>{
  const done=advanceTrial(rich(),TRIAL_MS+1000),changed=configure(done,{handToys:true});
  expect(readSave(JSON.stringify(changed))?.trial?.result).toEqual(done.trial?.result);
 });
 it('keeps a transferred timed record id and disqualifies untrusted imports',()=>{
  const done=advanceTrial(rich(),TRIAL_MS+1000),raw=JSON.stringify(done);
  const trusted=decodeTransfer(raw,freshRun(),true)!;expect(trusted.trial?.result?.id).toBe(done.id);expect(readSave(JSON.stringify(trusted))).not.toBeNull();
  expect(decodeTransfer(raw,freshRun(),false)?.trial?.result?.ranked).toBe(false);
 });
 it('queues offline names without truncation, retries independently and keeps amounts above 1e15',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('offline')));
  for(let i=0;i<52;i++){const done=advanceTrial({...rich(),cash:1e100},TRIAL_MS+1000);saveTrialName(done,'プレイヤー');}
  expect(readTrialOutbox()).toHaveLength(52);await flushTrialScores();expect(readTrialOutbox()).toHaveLength(52);
  const fetcher=vi.fn().mockImplementation(async()=>new Response('{}'));vi.stubGlobal('fetch',fetcher);await flushTrialScores();
  expect(readTrialOutbox()).toHaveLength(0);expect(JSON.parse(fetcher.mock.calls[0][1].body).finalBankroll).toBe(1e100);
 });
});
