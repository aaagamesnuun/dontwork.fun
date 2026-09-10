import {afterEach,describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {resumeAutomaticPlay} from './automaticPlay';
import {freshRun,freshTrial,finish,TARGET,resumeTrial,readSave,configure,setCount,work,advanceTrial,TRIAL_MS,type Run} from './game/engine';
import {startBackground,advanceBackground,backgroundAccess,backgroundSave} from './backgroundPlay';
import {BackgroundSettings,NotificationSettings} from './BackgroundSettings';
import {ReleaseLab} from './ReleaseLab';
import {guidance} from './game/guidance';
import {GameHelp,NewsHelp} from './GameHelp';
const ready=():Run=>({...configure(freshRun(),{autoAlwaysOn:true}),cash:100,peak:100,portfolio:[{id:'edge-50',count:1}]});
afterEach(()=>vi.unstubAllGlobals());
describe('automatic ordinary mode',()=>{
 it('starts only when funded and ready, and resumes after re-equipping or replenishing',()=>{
  const run=ready();expect(run.debug).toBe(false);
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
 it('defaults ordinary play ON, preserves explicit LAB OFF, and excludes timed mode',()=>{
  expect(freshRun().settings).toMatchObject({autoAlwaysOn:true,autoAlwaysOnRevision:1});
  const run=ready(),saved=readSave(JSON.stringify(run))!;expect(saved).toMatchObject({id:run.id,debug:false,settings:{autoAlwaysOn:true}});
  const manual=configure(run,{autoAlwaysOn:false});
  expect(readSave(JSON.stringify(manual))).toMatchObject({id:run.id,debug:true,settings:{autoAlwaysOn:false,autoAlwaysOnRevision:1}});
  expect(resumeAutomaticPlay(manual,1000,true,true)).toBe(manual);
  expect(readSave(JSON.stringify({...run,settings:{...run.settings,autoAlwaysOn:'yes'}}))).toBeNull();
  const trial=freshTrial(run.settings);expect(trial).toMatchObject({debug:false,settings:{autoAlwaysOn:false,backgroundPlay:false}});
  expect(configure(trial,{autoAlwaysOn:true,backgroundPlay:true})).toMatchObject({debug:false,settings:{autoAlwaysOn:false,backgroundPlay:false}});
  expect(resumeAutomaticPlay(trial,1000,true,true)).toBe(trial);
  expect(renderToStaticMarkup(<ReleaseLab s={trial} change={()=>{}}/>)).toContain('AUTOボタンをなくす');
 });
 it('migrates old ordinary saves once while preserving their progress, recorded clears and LAB status',()=>{
  for(const debug of [false,true]){
   const old=JSON.parse(JSON.stringify({...ready(),debug,work:20,spins:3,startedAt:1000}));
   delete old.settings.autoAlwaysOnRevision;old.settings.autoAlwaysOn=false;
   const migrated=readSave(JSON.stringify(old))!;
   expect(migrated).toMatchObject({id:old.id,cash:old.cash,work:20,spins:3,startedAt:1000,debug,settings:{autoAlwaysOn:true,autoAlwaysOnRevision:1}});
   expect(readSave(JSON.stringify({...migrated,settings:{...migrated.settings,autoAlwaysOn:false}}))!.settings.autoAlwaysOn).toBe(false);
  }
  const clear=finish({...freshRun(),cash:TARGET,activeMs:1000,work:10});
  const old=JSON.parse(JSON.stringify(clear));delete old.settings.autoAlwaysOnRevision;old.settings.autoAlwaysOn=false;
  expect(readSave(JSON.stringify(old))).toMatchObject({completion:clear.completion,id:clear.id,clearAt:clear.clearAt,settings:{autoAlwaysOn:true}});
  const trial=JSON.parse(JSON.stringify(freshTrial()));delete trial.settings.autoAlwaysOnRevision;trial.settings.autoAlwaysOn=true;
  expect(readSave(JSON.stringify(trial))).toMatchObject({id:trial.id,debug:false,settings:{autoAlwaysOn:false},trial:{started:false,paused:true,elapsedMs:0}});
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
 it('keeps notifications optional for background sound, and keeps challenges foreground-only',()=>{
  vi.stubGlobal('navigator',{locks:{},serviceWorker:{}});vi.stubGlobal('Notification',{permission:'granted'});
  const run={...freshRun(),settings:{...freshRun().settings,backgroundPlay:true,jackpotNotifications:true}};
  expect(backgroundAccess(run)).toBe(true);expect(backgroundAccess({...run,trial:freshTrial().trial})).toBe(false);
  const normal=renderToStaticMarkup(<BackgroundSettings s={run} change={()=>{}}/>);
  expect(normal).toContain('効果音をONにする');expect(normal).toContain('音を試す');expect(normal).not.toContain('大きな資産変動も通知');
  const off=renderToStaticMarkup(<NotificationSettings s={freshRun()} change={()=>{}}/>);expect(off).toContain('ジャックポット通知をONにする');expect(off).toContain('通知は任意です');expect(off).not.toContain('音を試す');
  for(const permission of ['default','denied','granted']) {
   vi.stubGlobal('Notification',{permission});expect(backgroundAccess({...run,settings:{...run.settings,jackpotNotifications:false}})).toBe(true);
  }
  vi.stubGlobal('Notification',undefined);expect(backgroundAccess(run)).toBe(true);
  expect(backgroundAccess({...run,settings:{...run.settings,sound:false}})).toBe(false);
  const trial=renderToStaticMarkup(<BackgroundSettings s={freshTrial()} change={()=>{}}/>);
  expect(renderToStaticMarkup(<GameHelp s={freshTrial()}/>)).not.toContain('AUTO');
  expect(renderToStaticMarkup(<NewsHelp s={freshTrial()} guide={guidance(freshTrial(),0,'spin')}/>)).toContain('砂時計');
  expect(trial).toContain('画面を離れると時計とスピンが止まります');expect(trial).not.toContain('<button');
 });
});
