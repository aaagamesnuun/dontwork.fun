import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { freshRun, freshTrial, resumeTrial, work, spin, setCount, readSave, configure, type Run } from "./game/engine";
import { secondBetStep } from "./game/positionTutorial";
import { guidance } from "./game/guidance";
import { presentationReducer, presentedRun } from "./presentation";
import { BetCard } from "./App";
import { betById } from "./game/catalog";
afterEach(() => vi.restoreAllMocks());
const beforeUnlock = (): Run => ({ ...freshRun(), cash:199, peak:199, spins:6, running:true, portfolio:[{id:"edge-50",count:1}] });
const unlocked = () => work(beforeUnlock());
const swapped = () => setCount(setCount(unlocked(),"edge-50",-1),"edge-25",1);
const lowestRoll = () => vi.spyOn(crypto,"getRandomValues").mockImplementation(array => { (array as Uint32Array).fill(0); return array; });

describe("second position tutorial", () => {
  it("starts on a WORK or spin unlock, then guides remove, equip and AUTO", () => {
    expect(spin(beforeUnlock(),80).secondBetTutorial).toBe("active");
    let run=unlocked(); expect(run.secondBetTutorial).toBe("active");
    expect(guidance(run,0,"positions")).toMatchObject({target:"remove",betId:"edge-50"});
    expect(guidance(run,0,"positions").text).toContain("1個まで");
    run=readSave(JSON.stringify(run))!;
    run=setCount(run,"edge-50",-1);
    expect(guidance(run,0,"positions")).toMatchObject({target:"equip",betId:"edge-25"});
    run=readSave(JSON.stringify(run))!;run=setCount(run,"edge-25",1);
    expect(guidance(run,0,"positions")).toMatchObject({target:"auto",key:"second-bet-spin"});
    const html=renderToStaticMarkup(<BetCard b={betById("edge-25")} s={run} change={()=>{}} guided/>);
    expect(html).toContain('data-bet-id="edge-25"');
  });
  it("selects the position panel and then the chart in the tabs layout", () => {
    const run=configure(unlocked(),{workspaceMode:"tabs"});
    expect(guidance(run,0,"upgrades").target).toBe("positions");
    const ready=setCount(setCount(run,"edge-50",-1),"edge-25",1);
    expect(guidance(ready,0,"positions").target).toBe("spin");
    expect(guidance(ready,0,"spin").target).toBe("auto");
  });
  it("handles extra slots, an already selected new bet, insufficient cash and Jackpot", () => {
    const multi={...unlocked(),slots:2};
    expect(secondBetStep(multi)?.action).toBe("remove");
    expect(secondBetStep(setCount(multi,"edge-25",1))?.action).toBe("spin");
    expect(guidance({...swapped(),cash:0}).target).toBe("work");
    expect(guidance({...swapped(),cash:50})).toMatchObject({target:"work",key:"second-bet-funds"});
    expect(secondBetStep({...multi,rushLeft:20})).toBeNull();
  });
  it("lands the first new bet once, without Jackpot, and cannot reset through re-equipping or reload", () => {
    lowestRoll();let run=spin(swapped());
    expect(run.last!.hits).toContain("edge-25");expect(run.last!.roll).toBeGreaterThanOrEqual(76);
    expect(run.last!.roll).toBeLessThanOrEqual(90);expect(run.last!.jackpot).toBe(false);
    expect(run.secondBetTutorial).toBe("done");expect(run.debug).toBe(false);
    run=readSave(JSON.stringify(run))!;run=setCount(setCount(run,"edge-25",-1),"edge-25",1);
    expect(spin(run).last!.hits).not.toContain("edge-25");
    expect(secondBetStep(run)).toBeNull();
  });
  it("does not consume a rejected spin; forced spins and assistance OFF cannot reserve another first spin", () => {
    lowestRoll();const run=swapped(),empty={...run,cash:0};
    expect(spin(empty)).toBe(empty);expect(empty.secondBetTutorial).toBe("active");
    const forced=spin(run,1);expect(forced.last!.roll).toBe(1);expect(forced.secondBetTutorial).toBe("done");
    const off=spin(configure(run,{spinAssist:false}));expect(off.last!.hits).not.toContain("edge-25");
    expect(spin(configure(off,{spinAssist:true})).last!.hits).not.toContain("edge-25");
  });
  it("gives the new bet priority if it overlaps the early BASELINE sequence and uses a single common roll", () => {
    const run={...unlocked(),spins:2,slots:2,portfolio:[{id:"edge-50",count:1},{id:"edge-25",count:1}]};
    const result=spin(run);expect(result.last!.hits).toEqual(["edge-50","edge-25"]);
    expect(result.last!.roll).toBeGreaterThanOrEqual(76);
  });
  it("retains the already accepted BASELINE result while equipping the new bet during its reveal", () => {
    const before=unlocked(),after=spin(before,1);
    let model=presentationReducer({run:before,pending:null},{type:"change",update:()=>after});
    model=presentationReducer(model,{type:"position-change",intent:{kind:"count",id:"edge-50",delta:-1}});
    model=presentationReducer(model,{type:"position-change",intent:{kind:"count",id:"edge-25",delta:1}});
    expect(model.run.last!.roll).toBe(1);expect(model.run.secondBetTutorial).toBe("active");
    model=presentationReducer(model,{type:"reveal",runId:before.id,spinId:after.last!.id});
    const next=spin(model.run);expect(next.last!.hits).toContain("edge-25");
    const pending=presentationReducer(model,{type:"change",update:()=>next});
    expect(presentedRun(pending).secondBetTutorial).toBe("active");
    expect(presentedRun(presentationReducer(pending,{type:"reveal",runId:next.id,spinId:next.last!.id})).secondBetTutorial).toBe("done");
  });
  it("activates when WORK crosses the visible unlock during an unrevealed loss", () => {
    lowestRoll();const before=beforeUnlock(),after=spin(before,1);
    let model=presentationReducer({run:before,pending:null},{type:"change",update:()=>after});
    model=presentationReducer(model,{type:"change",update:work});
    expect(presentedRun(model).cash).toBe(200);expect(model.run.secondBetTutorial).toBe("active");
    model=presentationReducer(model,{type:"position-change",intent:{kind:"count",id:"edge-50",delta:-1}});
    model=presentationReducer(model,{type:"position-change",intent:{kind:"count",id:"edge-25",delta:1}});
    model=presentationReducer(model,{type:"reveal",runId:before.id,spinId:after.last!.id});
    expect(spin(model.run).last!.hits).toContain("edge-25");
    expect(readSave(JSON.stringify({...model.run,secondBetTutorial:"waiting"}))!.secondBetTutorial).toBe("active");
  });
  it("still guarantees the first spin after swapping during a hidden Jackpot, including a cut range", () => {
    lowestRoll();const before=unlocked(),after=spin(before,100);
    let model=presentationReducer({run:before,pending:null},{type:"change",update:()=>after});
    model=presentationReducer(model,{type:"position-change",intent:{kind:"count",id:"edge-50",delta:-1}});
    model=presentationReducer(model,{type:"position-change",intent:{kind:"count",id:"edge-25",delta:1}});
    model=presentationReducer(model,{type:"reveal",runId:before.id,spinId:after.last!.id});
    expect(model.run.rushLeft).toBeGreaterThan(0);
    for(const removed of [0,95,99]) {
      const run=spin({...model.run,removed});
      expect(run.last!.hits).toContain("edge-25");expect(run.last!.roll).toBeGreaterThan(removed);
      expect(run.secondBetTutorial).toBe("done");
    }
  });
  it("does not grant returning advanced saves another tutorial or change timed challenges", () => {
    const old={...unlocked()} as Partial<Run>;delete old.secondBetTutorial;
    const restored=readSave(JSON.stringify(old))!;expect(restored.secondBetTutorial).toBe("done");expect(restored.id).toBe(old.id);
    expect(restored.debug).toBe(false);
    expect(readSave(JSON.stringify({...old,peak:50,cash:50}))!.secondBetTutorial).toBe("waiting");
    expect(readSave(JSON.stringify({...old,secondBetTutorial:"invalid"}))).toBeNull();
    lowestRoll();const trial={...resumeTrial(freshTrial(),Date.now()),cash:200,peak:200,portfolio:[{id:"edge-25",count:1}],secondBetTutorial:"active" as const};
    expect(secondBetStep(trial)).toBeNull();expect(spin(trial).last!.roll).toBe(1);
  });
});
