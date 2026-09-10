import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkInput } from "./workInput";
import { configure, freshRun, freshTrial, pauseTrial, resumeTrial, readSave, spin, work, type Run } from "./game/engine";
import { presentationReducer, presentedRun } from "./presentation";
import { snapshot } from "./api";
import { Lab } from "./Panels";
import { setLanguage } from "./i18n";

afterEach(() => setLanguage("ja"));

describe("normal WORK input budget", () => {
  it("accepts at most 15 in any rolling second, including across wall-second boundaries", () => {
    const gate = new WorkInput(), run = freshRun();
    const accepted = Array.from({length:3000}, (_, now) => gate.accept(run, now) ? now : -1).filter(now => now >= 0);
    expect(accepted).toHaveLength(45);
    for (let now=0; now<3000; now++) expect(accepted.filter(at => at > now-1000 && at <= now).length).toBeLessThanOrEqual(15);
    expect(accepted.slice(15,18)).toEqual([1000,1001,1002]);
  });
  it("does not queue excess input or bank idle time", () => {
    const gate = new WorkInput(), run = freshRun();
    expect(Array.from({length:100}, () => gate.accept(run, 0)).filter(Boolean)).toHaveLength(15);
    expect(gate.accept(run,999)).toBe(false);
    expect(Array.from({length:100}, () => gate.accept(run,60000)).filter(Boolean)).toHaveLength(15);
  });
  it("applies LAB changes immediately without resetting the current window", () => {
    const gate = new WorkInput(), run = freshRun();
    for (let i=0; i<15; i++) expect(gate.accept(run, i)).toBe(true);
    const lower = configure(run,{workClicksPerSecond:5});
    expect(gate.accept(lower,20)).toBe(false);
    const higher = configure(lower,{workClicksPerSecond:20});
    expect(Array.from({length:10},()=>gate.accept(higher,30)).filter(Boolean)).toHaveLength(5);
    expect(gate.accept({...higher,running:false},40)).toBe(false);
  });
  it("keeps normal WORK usable without funds or AUTO, and applies only accepted income during a reveal", () => {
    const gate = new WorkInput(), empty = freshRun();
    expect(gate.accept(empty,0)).toBe(true);
    const before: Run = {...empty,cash:100,peak:100,portfolio:[{id:"edge-50",count:1}],running:true};
    let model = presentationReducer({run:before,pending:null},{type:"change",update:s=>spin(s,80)});
    const resolvedCash = model.run.cash;
    for (let i=0;i<100;i++) if (gate.accept(model.run,1000)) model=presentationReducer(model,{type:"change",update:work});
    expect(presentedRun(model)).toMatchObject({cash:115,spins:0,work:15});
    expect(model.run.cash).toBe(resolvedCash+15);
    const revealed=presentationReducer(model,{type:"reveal",runId:model.run.id,spinId:model.run.last!.id});
    expect(revealed.run).toMatchObject({cash:resolvedCash+15,work:15,spins:1});
  });
  it("rejects non-click WORK without consuming slots and preserves timed-mode pause rules", () => {
    const gate = new WorkInput(), trial = freshTrial();
    expect(gate.accept(trial,0)).toBe(false);
    expect(gate.accept(configure(freshRun(),{workMode:"gamble"}),0)).toBe(false);
    const playing = resumeTrial(trial,1000);
    expect(Array.from({length:100},()=>gate.accept(playing,0)).every(Boolean)).toBe(true);
    expect(gate.accept(pauseTrial(playing,1001),0)).toBe(false);
    expect(Array.from({length:20},()=>gate.accept(freshRun(),0)).filter(Boolean)).toHaveLength(15);
  });
});

describe("WORK limit preferences", () => {
  it("adopts 15 on existing saves without changing progress or earned results", () => {
    const old=JSON.parse(JSON.stringify({...freshRun(),cash:42,peak:42,work:42,startedAt:1234}));
    delete old.settings.workClicksPerSecond;
    const saved=readSave(JSON.stringify(old))!;
    expect(saved).toMatchObject({id:old.id,cash:42,work:42,startedAt:1234,debug:false,settings:{workClicksPerSecond:15}});
    expect(snapshot(saved).workClicksPerSecond).toBe(15);
  });
  it("persists the LAB value and its unranked status even after returning to 15", () => {
    const changed=configure(freshRun(),{workClicksPerSecond:30});
    expect(readSave(JSON.stringify(changed))).toMatchObject({debug:true,settings:{workClicksPerSecond:30}});
    expect(readSave(JSON.stringify(configure(changed,{workClicksPerSecond:15})))?.debug).toBe(true);
    const trial=freshTrial();
    expect(configure(trial,{workClicksPerSecond:30})).toMatchObject({debug:false,settings:{workClicksPerSecond:15}});
  });
  it.each([0,61,1.5,Infinity,NaN,"15",null])("rejects invalid limit %s", value => {
    const run=freshRun();
    expect(configure(run,{workClicksPerSecond:value as number})).toBe(run);
    expect(readSave(JSON.stringify({...run,settings:{...run.settings,workClicksPerSecond:value}}))).toBeNull();
  });
  it("exposes a labeled 1–60 LAB control in Japanese and English", () => {
    for (const lang of ["ja","en"] as const) {
      setLanguage(lang);
      const html=renderToStaticMarkup(<Lab s={freshRun()} change={()=>{}} notify={()=>{}}/>);
      expect(html).toContain(lang==="ja" ? "WORKの上限（回/秒）" : "WORK limit (clicks/sec)");
      expect(html).toMatch(/type="number" min="1" max="60" step="1" value="15"/);
    }
  });
});
