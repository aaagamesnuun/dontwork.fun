import {afterEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {freshRun,freshTrial,work,resumeTrial,pauseTrial,readSave,finish,TARGET,TRIAL_MS,advanceTrial} from './game/engine';
import {ModeSwitchNotice,prestartMode} from './ModeSwitchNotice';
import {switchTrialMode,TRIAL_SLOT} from './trialSaves';
import {setLanguage} from './i18n';
afterEach(()=>{vi.unstubAllGlobals();setLanguage('ja')});
it('offers only the other mode after unlock and before any play',()=>{
 const normal=freshRun(),trial=freshTrial();
 expect(prestartMode(normal,false)).toBeNull();expect(prestartMode(trial,false)).toBeNull();
 expect(prestartMode(normal,true)).toBe('trial');expect(prestartMode(trial,true)).toBe('normal');
 expect(prestartMode(work(normal),true)).toBeNull();
 for(const run of [{...normal,startedAt:123},{...normal,work:1},{...normal,spins:1},{...normal,running:true},finish({...normal,cash:TARGET})])expect(prestartMode(run,true)).toBeNull();
});
it('does not offer a switch after an immediate pause or restored started trial',()=>{
 const paused=pauseTrial(resumeTrial(freshTrial(),1000),1000);
 expect(paused.trial?.elapsedMs).toBe(0);expect(prestartMode(paused,true)).toBeNull();
 expect(prestartMode(readSave(JSON.stringify(paused))!,true)).toBeNull();
 const ended=advanceTrial(resumeTrial(freshTrial(),1000),TRIAL_MS+1000);
 expect(prestartMode(ended,true)).toBeNull();
});
it('uses the existing mode switch to restore the other save, with no reset or automatic start',()=>{
 const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});
 const saved=pauseTrial({...resumeTrial(freshTrial(),1000),cash:123,peak:123},4000);
 values.set(TRIAL_SLOT,JSON.stringify(saved));
 const normal=freshRun();const target=prestartMode(normal,true)!;
 const trial=switchTrialMode(normal,target,undefined,5000);
 expect(trial).toMatchObject({id:saved.id,cash:123,trial:{elapsedMs:3000,started:true,paused:true}});
 const restored=switchTrialMode(trial,'normal',undefined,6000);
 expect(restored).toMatchObject({id:normal.id,work:0,spins:0,startedAt:null});expect(prestartMode(restored,true)).toBe('trial');
});
it('names only the alternative action in Japanese and English',()=>{
 const normal=renderToStaticMarkup(<ModeSwitchNotice target="trial" onSwitch={()=>{}} onDismiss={()=>{}}/>);
 expect(normal).toContain('30分モードで遊ぶ');expect(normal).not.toContain('通常モードで遊ぶ');
 const trial=renderToStaticMarkup(<ModeSwitchNotice target="normal" onSwitch={()=>{}} onDismiss={()=>{}}/>);
 expect(trial).toContain('通常モードで遊ぶ');expect(trial).not.toContain('30分モードで遊ぶ');
 setLanguage('en');expect(renderToStaticMarkup(<ModeSwitchNotice target="trial" onSwitch={()=>{}} onDismiss={()=>{}}/>)).toContain('Play 30-minute mode');
});
