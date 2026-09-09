import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshRun, freshTrial, resumeTrial, spin, readSave, configure, defaultSettings, type Run } from './game/engine';
const ready = (): Run => ({...freshRun(),cash:1e6,peak:1e6,portfolio:[{id:'edge-50',count:1}]});
afterEach(()=>vi.restoreAllMocks());
describe('opening spin assistance',()=>{
 it('uses WWLWW, preserves its place across reload, then returns to random spins',()=>{
  vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{(array as Uint32Array).fill(0);return array});
  let run=ready();const hits=[];
  for(let i=0;i<6;i++){
   if(i===2)run=readSave(JSON.stringify(run))!;
   run=spin(run);hits.push(run.last!.hits.includes('edge-50'));
  }
  expect(hits).toEqual([true,true,false,true,true,false]);expect(run.debug).toBe(false);
 });
 it('accepts another five-outcome order without rewinding spins and marks changes as LAB rules',()=>{
  let run=configure(ready(),{spinAssistSequence:'LLWWL'});const hits=[];
  for(let i=0;i<5;i++){run=spin(run);hits.push(run.last!.hits.includes('edge-50'));}
  expect(hits).toEqual([false,false,true,true,false]);expect(run.debug).toBe(true);
  const changed=configure(run,{spinAssistSequence:'WWWWW'});expect(changed.spins).toBe(5);
  for(const spinAssistSequence of ['W','XXXXW','WWWWWW'])expect(configure(run,{spinAssistSequence})).toBe(run);
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
  expect(configure(trial,{spinAssist:true}).settings.spinAssist).toBe(false);
 });
});
