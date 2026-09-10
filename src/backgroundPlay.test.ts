import { describe, it, expect } from "vitest";
import { advanceBackground, backgroundSave, startBackground, BACKGROUND_MS } from "./backgroundPlay";
import { configure, freshRun, interval, readSave, spin, type Run } from "./game/engine";
import { presentationReducer } from "./presentation";

const playable=():Run=>({...configure(freshRun(),{backgroundPlay:true}),cash:1e6,peak:1e6,running:true,portfolio:[{id:"edge-50",count:1}],startedAt:1000});
describe("owned background progression",()=>{
  it("defaults off, migrates older saves once, and preserves explicit new OFF",()=>{
    const old=JSON.parse(JSON.stringify(freshRun()));delete old.background;delete old.backgroundMs;delete old.settings.backgroundPlay;delete old.settings.backgroundRevision;
    expect(readSave(JSON.stringify(old))).toMatchObject({background:null,backgroundMs:0,settings:{backgroundPlay:false},debug:false});
    const off=configure(freshRun(),{backgroundPlay:false});expect(readSave(JSON.stringify(off))!.settings.backgroundPlay).toBe(false);expect(off.debug).toBe(false);
    expect(startBackground({...freshRun(),running:true},1000).background).toBeNull();
  });
  it("resumes the remaining cycle and never credits the same interval twice",()=>{
    const start=startBackground(playable(),1000,2000);
    const a=advanceBackground(start,3500,false,100,75);
    expect(a.run.spins).toBe(0);expect(a.run.background?.remainingMs).toBe(500);
    const saved=readSave(JSON.stringify(a.run))!;
    const b=advanceBackground(saved,4000,true,100,75);
    expect(b.run.spins).toBe(1);expect(b.run.background).toBeNull();
    expect(b.run.activeMs).toBe(3000);expect(b.run.backgroundMs).toBe(3000);
    const twice=advanceBackground(readSave(JSON.stringify(b.run))!,9000,true,100,75);
    expect(twice.run.cash).toBe(b.run.cash);expect(twice.run.spins).toBe(1);
  });
  it("chunks a long absence with checkpoints that survive restarts",()=>{
    let run=startBackground(playable(),1000);const until=61000;
    const first=advanceBackground(run,until,true,3,75);
    expect(first.done).toBe(false);expect(first.transitions).toHaveLength(3);
    run=readSave(JSON.stringify(first.run))!;
    while(run.background)run=advanceBackground(run,until,true,3,75).run;
    expect(run.spins).toBe(12);expect(run.backgroundMs).toBe(60000);
    expect(run.activeMs-run.backgroundMs).toBe(0);
  });
  it("stops at the first Jackpot including Infinity and preserves it through reload",()=>{
    let run=startBackground({...playable(),trim:99,settings:{...playable().settings,jackpotSpinIntervalMs:100}},1000);
    let loops=0;
    while(run.background && loops++<150)run=advanceBackground(run,1000+BACKGROUND_MS*3,true,100,100).run;
    expect(run.spins).toBe(1);expect(run.removed).toBe(99);expect(run.running).toBe(false);expect(run.background).toBeNull();
    expect(run.backgroundMs).toBeLessThanOrEqual(BACKGROUND_MS);
    expect(advanceBackground(readSave(JSON.stringify(run))!,1e9,true).run.spins).toBe(1);
  });
  it("stops after one hour at a slower tempo and preserves a completed record",()=>{
    let run=spin({...playable(),cash:1e9},75);
    const completion=run.completion;
    run=startBackground(run,1000);
    while(run.background)run=advanceBackground(run,1000+BACKGROUND_MS*2,true,100,75).run;
    expect(run.backgroundMs).toBe(BACKGROUND_MS);expect(run.completion).toEqual(completion);expect(run.running).toBe(false);
  });
  it("stops on insufficient funds or capacity, without phantom spins",()=>{
    const run=startBackground({...playable(),cash:10,settings:{...playable().settings,assist:false}},1000);
    const a=advanceBackground(run,50000,true,100,1);
    expect(a.run.spins).toBe(1);expect(a.run.cash).toBe(0);expect(a.run.running).toBe(false);
    const fuel=startBackground({...playable(),fuel:1,settings:{...playable().settings,fuelEnabled:true}},1000);
    const b=advanceBackground(fuel,50000,true,100,75);
    expect(b.run.spins).toBe(1);expect(b.run.fuel).toBe(0);
  });
  it("rejects corrupt clocks and pauses for clock rollback or disabling",()=>{
    const run=startBackground(playable(),1000);
    expect(advanceBackground(run,500,true).run).toMatchObject({running:false,background:null});
    expect(configure(run,{backgroundPlay:false}).background).toBeNull();
    for(const patch of [{remainingMs:0},{spinsLeft:12001},{until:1e100},{at:NaN}]){
      expect(readSave(JSON.stringify({...run,background:{...run.background,...patch}}))).toBeNull();
    }
  });
  it("saving an existing checkpoint does not extend its time or spin budget",()=>{
    const a=startBackground(playable(),1000,1000,4500);
    expect(a.background?.remainingMs).toBe(4500);
    expect(backgroundSave(a,500000,0).background).toEqual(a.background);
    expect(backgroundSave({...playable(),running:false},500000).background).toBeNull();
  });
  it("uses the longer LAB reveal duration as a limit on the next spin",()=>{
    const s=configure(playable(),{revealPacing:"ratio",revealRatio:2});
    const result=advanceBackground(startBackground(s,1000),1000+interval(s)*3,true,100,75);
    expect(result.run.spins).toBe(2);
  });
  it("reveals a reserved spin and concurrent coin before bulk settlement",()=>{
    let s={...playable(),settings:{...playable().settings,coinFlip:true},coinEnabled:true};
    let model=presentationReducer({run:s,pending:null},{type:"change",update:r=>spin(r,75,0)});
    model=presentationReducer(model,{type:"coin-flip",wager:10,forced:true});
    const settled=presentationReducer(model,{type:"reveal",runId:s.id,spinId:model.run.last!.id}).run;
    const batch=advanceBackground(startBackground(settled,1000),11000,true,100,75);
    const final=presentationReducer(model,{type:"background",run:batch.run});
    expect(final.pending).toBeNull();expect(final.run.coinRounds).toBe(1);expect(final.run.history.some(p=>p.coinCount===1&&p.coinProfit===10)).toBe(true);
  });
});
