import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshRun, freshTrial, resumeTrial, spin, readSave, configure, defaultSettings, finish, TARGET, type Run } from './game/engine';
const ready = (): Run => ({...freshRun(),cash:1e6,peak:1e6,portfolio:[{id:'edge-50',count:1}]});
afterEach(()=>vi.restoreAllMocks());
describe('opening spin assistance',()=>{
 it('uses WLWW, preserves its place across reload, then returns to random spins from the fifth spin',()=>{
  vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{(array as Uint32Array).fill(0);return array});
  let run=ready();const hits=[];
  for(let i=0;i<6;i++){
   if(i===2)run=readSave(JSON.stringify(run))!;
   run=spin(run);hits.push(run.last!.hits.includes('edge-50'));
  }
  expect(hits).toEqual([true,false,true,true,false,false]);expect(run.debug).toBe(false);
 });
 it('accepts another four-outcome order without rewinding spins and marks changes as LAB rules',()=>{
  let run=configure(ready(),{spinAssistSequence:'LLWW'});const hits=[];
  for(let i=0;i<4;i++){run=spin(run);hits.push(run.last!.hits.includes('edge-50'));}
  expect(hits).toEqual([false,false,true,true]);expect(run.debug).toBe(true);
  const changed=configure(run,{spinAssistSequence:'WWWW'});expect(changed.spins).toBe(4);
  for(const spinAssistSequence of ['W','XXXX','WWWWW','WWWWWW'])expect(configure(run,{spinAssistSequence})).toBe(run);
 });
 it('migrates the former standard without rewinding an in-progress or completed run',()=>{
  vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{(array as Uint32Array).fill(0);return array});
  for(const [spins,hit] of [[0,true],[1,false],[2,true],[3,true],[4,false],[20,false]] as const) {
   const current={...ready(),spins},old={...current,settings:{...current.settings,spinAssistSequence:'WWLWW'}};
   const restored=readSave(JSON.stringify(old))!;
   expect(restored).toMatchObject({id:old.id,cash:old.cash,spins,debug:false,settings:{spinAssistSequence:'WLWW'}});
   expect(spin(restored).last!.hits.includes('edge-50')).toBe(hit);
  }
  const complete=finish({...ready(),cash:TARGET,peak:TARGET,spins:20,activeMs:600000});
  const restored=readSave(JSON.stringify({...complete,settings:{...complete.settings,spinAssistSequence:'WWLWW'}}))!;
  expect(restored).toMatchObject({id:complete.id,cash:TARGET,spins:20,completion:complete.completion,clearSnapshot:complete.clearSnapshot});
 });
 it('shortens legacy LAB orders while preserving OFF and existing ranking status, and rejects invalid saves',()=>{
  const run=configure(ready(),{spinAssist:false});
  const restored=readSave(JSON.stringify({...run,settings:{...run.settings,spinAssistSequence:'LWLWL'}}))!;
  expect(restored).toMatchObject({id:run.id,debug:true,settings:{spinAssist:false,spinAssistSequence:'LWLW'}});
  expect(readSave(JSON.stringify(restored))).toMatchObject({settings:{spinAssistSequence:'LWLW',spinAssist:false},debug:true});
  for(const spinAssistSequence of ['W','XXWW','WWWWWW',null])
   expect(readSave(JSON.stringify({...run,settings:{...run.settings,spinAssistSequence}}))).toBeNull();
 });
 it('does not consume unaffordable spins or override forced spins and handles early Jackpot cuts',()=>{
  const empty={...ready(),cash:0};expect(spin(empty)).toBe(empty);
  expect(spin(ready(),1).last?.roll).toBe(1);
  const cut={...ready(),rushLeft:20,removed:90};expect(()=>spin(cut)).not.toThrow();expect(spin(cut).last!.roll).toBeGreaterThanOrEqual(91);
  expect(spin({...ready(),settings:{...defaultSettings,opening:20}}).last!.hits).toContain('edge-50');
 });
 it('allows disabling the opening aid while preserving the first Jackpot aid',()=>{
  vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{(array as Uint32Array).fill(0);return array});
  const run=configure(ready(),{spinAssist:false});expect(spin(run).last!.hits).not.toContain('edge-50');
  const jackpot=spin({...ready(),spins:31});expect(jackpot.last).toMatchObject({roll:100,assisted:true,jackpot:true});
 });
 it('never aids a timed challenge, and a standard timed spin remains ranked',()=>{
  vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{(array as Uint32Array).fill(0);return array});
  const trial={...resumeTrial(freshTrial(),1000),cash:1e6,peak:1e6,portfolio:[{id:'edge-50',count:1}]};
  expect(trial.settings.spinAssist).toBe(false);
  const next=spin({...trial,settings:{...trial.settings,spinAssist:true,upgradeTutorial:'scripted' as const}});
  expect(next.last?.roll).toBe(1);expect(next.last?.assisted).toBe(false);expect(next.debug).toBe(false);
  expect(readSave(JSON.stringify(next))).toMatchObject({debug:false,settings:{spinAssist:false}});
  expect(readSave(JSON.stringify({...next,settings:{...next.settings,spinAssistSequence:'WWLWW'}}))).toMatchObject({id:next.id,spins:next.spins,debug:false,settings:{spinAssist:false,spinAssistSequence:'WLWW'}});
  expect(configure(trial,{spinAssist:true}).settings.spinAssist).toBe(false);
 });
});
