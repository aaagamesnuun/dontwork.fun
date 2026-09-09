import { describe, it, expect } from 'vitest';
import { captureScenes, captureSpin, parseCaptureRolls, validateCaptureRolls, recordingRun } from './captureScenario';
import { freshRun } from './game/engine';

describe('capture scenarios',()=>{
  it('builds small checkpoints using paid upgrades and recorded real balances',()=>{
    const scenes=captureScenes();
    expect(scenes.work.initialRun).toMatchObject({cash:0,spins:0,work:0,debug:true,telemetry:false});
    expect(scenes.select.initialRun).toMatchObject({cash:20,work:20,spins:0});
    expect(scenes.upgrade.initialRun).toMatchObject({cash:350,spins:30,slots:1});
    expect(scenes.choose.initialRun).toMatchObject({cash:230,spins:30,slots:2});
    expect(validateCaptureRolls(scenes.growth.initialRun,scenes.growth.rolls)).toMatchObject({cash:1370,spins:32});
    expect(scenes.finale.initialRun).toMatchObject({cash:1345,spins:32,speed:1});
    const spend=scenes.choose.initialRun.history.filter(p=>p.kind==='upgrade');
    expect(spend.at(-1)).toMatchObject({cash:230,spent:120});
  });
  it('replays the exact pair and two chains through the normal payout rules',()=>{
    const scene=captureScenes().finale;
    let run={...scene.initialRun,running:true};
    const jackpots:number[]=[];
    for(let i=0;i<scene.rolls.length;i++){
      run=captureSpin(run,scene);
      if(run.last?.jackpot)jackpots.push(run.spins);
    }
    expect(jackpots).toEqual([39,55]);
    expect(run).toMatchObject({cash:6415,spins:55,chain:2,running:false,debug:true,telemetry:false,background:null});
    expect(run.history.at(-1)?.cash).toBe(run.cash);
    expect(captureSpin(run,scene).spins).toBe(55);
  });
  it('does not consume a queue when a reducer update is evaluated again',()=>{
    const scene=captureScenes().growth;
    const before=structuredClone(scene);
    const first=captureSpin({...scene.initialRun,running:true},scene);
    const again=captureSpin({...scene.initialRun,running:true},scene);
    expect([first.cash,first.spins,first.last?.roll]).toEqual([800,31,83]);
    expect([again.cash,again.spins,again.last?.roll]).toEqual([800,31,83]);
    expect(scene).toEqual(before);
  });
  it('validates inputs and stops on exhaustion or bankruptcy',()=>{
    expect(parseCaptureRolls('25, 75、95\n97')).toEqual([25,75,95,97]);
    expect(parseCaptureRolls('')).toEqual([]);
    for(const value of ['0','101','1.5','hello','1,'.repeat(301)])expect(()=>parseCaptureRolls(value)).toThrow();
    const scene=captureScenes().growth;
    const broke=captureSpin({...scene.initialRun,cash:0,running:true},scene);
    expect(broke).toMatchObject({cash:0,spins:30,running:false});
    expect(()=>validateCaptureRolls({...scene.initialRun,rushLeft:20,removed:99},[50])).toThrow('カット');
  });
  it('keeps ordinary run state immutable and unmodified',()=>{
    const ordinary=freshRun();const before=structuredClone(ordinary);
    const studio=recordingRun(ordinary);
    expect(ordinary).toEqual(before);
    expect(ordinary.debug).toBe(false);
    expect(studio).toMatchObject({debug:true,telemetry:false,settings:{captureMode:true,backgroundPlay:false}});
  });
});
