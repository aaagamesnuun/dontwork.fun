import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {resumeAutomaticPlay} from './automaticPlay';
import {freshRun,freshTrial,resumeTrial,readSave,configure,setCount,work,advanceTrial,TRIAL_MS,type Run} from './game/engine';
import {startBackground,advanceBackground,backgroundAccess,backgroundSave} from './backgroundPlay';
import {BackgroundSettings} from './BackgroundSettings';
import {ReleaseLab} from './ReleaseLab';
import {guidance} from './game/guidance';
import {GameHelp,NewsHelp} from './GameHelp';
const ready=():Run=>({...configure(freshRun(),{autoAlwaysOn:true}),cash:100,peak:100,portfolio:[{id:'edge-50',count:1}]});
afterEach(()=>vi.unstubAllGlobals());
describe('automatic ordinary mode',()=>{
 it('starts only when funded and ready, and resumes after re-equipping or replenishing',()=>{
  const run=ready();expect(run.debug).toBe(true);
  const started=resumeAutomaticPlay(run,1000,true,true);expect(started).toMatchObject({running:true,startedAt:1000});
  for(const [readyFlag,visible,held] of [[false,true,false],[true,false,false],[true,true,true]])
   expect(resumeAutomaticPlay(run,1000,readyFlag,visible,held)).toBe(run);
  for(const stopped of [{...run,backgroundJackpot:true},{...run,cash:0},{...run,portfolio:[]}])
   expect(resumeAutomaticPlay(stopped,1000,true,true)).toBe(stopped);
  const empty=setCount(started,'edge-50',-1),equipped=setCount(empty,'edge-50',1);
  expect(resumeAutomaticPlay(equipped,2000,true,true).running).toBe(true);
  let poor={...run,cash:0};for(let i=0;i<10;i++)poor=work(poor);
  expect(resumeAutomaticPlay(poor,3000,true,true).running).toBe(true);
  expect(guidance({...run,spins:6},0,'spin').target).not.toBe('auto');
  expect(renderToStaticMarkup(<GameHelp s={run}/>)).not.toContain('AUTO');
 });
 it('persists LAB selection, defaults old saves OFF, and excludes challenges',()=>{
  expect(freshRun().settings.autoAlwaysOn).toBe(false);
  const old=JSON.parse(JSON.stringify(freshRun()));delete old.settings.autoAlwaysOn;
  expect(readSave(JSON.stringify(old))!.settings.autoAlwaysOn).toBe(false);
  const run=ready(),saved=readSave(JSON.stringify(run))!;expect(saved).toMatchObject({id:run.id,debug:true,settings:{autoAlwaysOn:true}});
  expect(readSave(JSON.stringify({...run,settings:{...run.settings,autoAlwaysOn:'yes'}}))).toBeNull();
  const trial=freshTrial(run.settings);expect(trial).toMatchObject({debug:false,settings:{autoAlwaysOn:false,backgroundPlay:false}});
  expect(configure(trial,{autoAlwaysOn:true,backgroundPlay:true})).toMatchObject({debug:false,settings:{autoAlwaysOn:false,backgroundPlay:false}});
  expect(resumeAutomaticPlay(trial,1000,true,true)).toBe(trial);
  expect(renderToStaticMarkup(<ReleaseLab s={trial} change={()=>{}}/>)).toContain('AUTOボタンをなくす');
 });
});
describe('foreground-only timed challenge',()=>{
 it('pauses clocks and pending legacy background state without granting offline spins',()=>{
  const trial={...resumeTrial(freshTrial(),1000),cash:100,peak:100,settings:{...freshTrial().settings,backgroundPlay:true,jackpotNotifications:true},portfolio:[{id:'edge-50',count:1}]};
  expect(backgroundSave(trial,2000).background).toBeNull();
  const departure=startBackground(trial,11000);expect(departure.trial).toMatchObject({elapsedMs:10000,paused:true});
  const returned=advanceBackground(departure,TRIAL_MS*2,true);expect(returned.run).toMatchObject({spins:0,trial:{elapsedMs:10000,paused:true,result:null}});
  const legacy={...trial,background:{at:1000,remainingMs:5000,until:3601000,spinsLeft:12000},backgroundJackpot:true};
  const saved=readSave(JSON.stringify(legacy))!;expect(saved).toMatchObject({id:trial.id,cash:100,spins:0,background:null,backgroundJackpot:false,settings:{backgroundPlay:false},trial:{elapsedMs:0,paused:true}});
  expect(advanceTrial(saved,TRIAL_MS*2).trial?.result).toBeNull();
 });
 it('allows the normal permission and sound flow but explains why challenge background is unavailable',()=>{
  vi.stubGlobal('navigator',{locks:{},serviceWorker:{}});vi.stubGlobal('Notification',{permission:'granted'});
  const run={...freshRun(),settings:{...freshRun().settings,backgroundPlay:true,jackpotNotifications:true}};
  expect(backgroundAccess(run)).toBe(true);expect(backgroundAccess({...run,trial:freshTrial().trial})).toBe(false);
  const normal=renderToStaticMarkup(<BackgroundSettings s={run} change={()=>{}}/>);
  expect(normal).toContain('効果音をONにする');expect(normal).toContain('音を試す');expect(normal).not.toContain('大きな資産変動も通知');
  const off=renderToStaticMarkup(<BackgroundSettings s={freshRun()} change={()=>{}}/>);expect(off).toContain('通知をONにしてバックグラウンドで遊ぶ');
  const trial=renderToStaticMarkup(<BackgroundSettings s={freshTrial()} change={()=>{}}/>);
  expect(renderToStaticMarkup(<GameHelp s={freshTrial()}/>)).not.toContain('AUTO');
  expect(renderToStaticMarkup(<NewsHelp s={freshTrial()} guide={guidance(freshTrial(),0,'spin')}/>)).toContain('砂時計');
  expect(trial).toContain('画面を離れると時計とスピンが止まります');expect(trial).not.toContain('<button');
 });
});
