import { describe, expect, it } from "vitest";
import { guidance } from "./guidance";
import { interval, spin, defaultSettings, freshRun, setCount, firstBet, work, readSave, configure, priceProfile, upgradePrice, type Run } from "./engine";
import { spinTiming } from "../spinTiming";
import { snapshot } from "../api";

describe("v2.2 guidance and configurable pacing", () => {
  it("guides exactly WORK → positions → plus → chart tab → AUTO in legacy navigation", () => {
    let s = configure(freshRun(), {workspaceMode:"tabs"});
    expect(guidance(s, 0, "spin").target).toBe("work");
    for (let i = 0; i < 10; i++) s = work(s);
    expect(guidance(s, 0, "spin").target).toBe("positions");
    expect(guidance(s, 0, "positions").target).toBe("equip");
    s = setCount(s, firstBet(s), 1);
    expect(guidance(s, 0, "positions").target).toBe("spin");
    expect(guidance(s, 0, "upgrades").target).toBe("spin");
    expect(guidance(s, 0, "spin").target).toBe("auto");
    expect(guidance({ ...s, spins: 1 }, 0, "positions").target).toBe("auto");
  });
  it("defaults to bass and proportional timing, keeping explicit imported sound choices", () => {
    expect(defaultSettings).toMatchObject({ bassMode: true, revealDurationMs: 700, revealPacing: "ratio", revealRatio: .8 });
    const saved = { ...freshRun(), economyRevision: 7, cash: 321, spins: 12,
      settings: { ...defaultSettings, bassMode: false, economyProfile: "v21" } };
    const imported = readSave(JSON.stringify(saved))!;
    expect(imported).toMatchObject({ cash: 321, spins: 12, economyRevision: 13, debug: true,
      settings: { bassMode: false, economyProfile: "v24" } });
    expect(readSave(JSON.stringify(imported))!.id).toBe(imported.id);
  });
  it("scales the reveal with each starting interval without revealing Jackpot early",()=>{
    const base={...freshRun(),cash:1000,portfolio:[{id:"edge-50",count:1}]};
    for(const before of [base,{...base,speed:60},{...base,rushLeft:20},{...base,rushLeft:20,settings:{...base.settings,jackpotSpinIntervalMs:100 as const}},{...base,catalog:"curated" as const}]){
      for(const roll of [1,80,100]){
        const after=spin(before,roll);
        expect(spinTiming(before,after).revealDelay).toBeCloseTo(interval(before)*.8);
        expect(spinTiming(before,after,true).revealDelay).toBe(0);
      }
    }
    const rush={...base,rushLeft:1,speed:100,settings:{...base.settings,jackpotSpinIntervalMs:1000 as const,spinSpeedScale:.5}};
    expect(spinTiming(rush,spin(rush,1))).toEqual({revealDelay:800,holdForResult:true});
    const long=configure(base,{revealRatio:2});expect(spinTiming(long,spin(long,80))).toEqual({revealDelay:10000,holdForResult:true});
  });
  it("adopts previous baseline display settings once while preserving subsequent LAB choices and saves",()=>{
    const old={...freshRun(),cash:12345,speed:25,settings:{...defaultSettings,rhythmRevision:undefined,spinRevealRevision:undefined,payoffStyle:"net",newsPosition:"bottom",revealPacing:"adaptive",revealDurationMs:700}};
    const migrated=readSave(JSON.stringify(old))!;
    expect(migrated).toMatchObject({id:old.id,cash:12345,speed:25,debug:false,settings:{rhythmRevision:1,payoffStyle:"classic",newsPosition:"top",revealPacing:"ratio",revealRatio:.8}});
    const chosen=configure(migrated,{payoffStyle:"net",newsPosition:"bottom",revealPacing:"full",revealRatio:1.2});
    expect(readSave(JSON.stringify(chosen))!.settings).toEqual(chosen.settings);
    expect(readSave(JSON.stringify({...old,settings:{...old.settings,revealPacing:"full",revealDurationMs:3500,payoffStyle:"chart"}}))!.settings).toMatchObject({revealPacing:"ratio",revealRatio:.8,revealDurationMs:3500,payoffStyle:"chart"});
    for(const revealRatio of [0,-1,3,null,".8"])expect(readSave(JSON.stringify({...migrated,settings:{...migrated.settings,revealRatio}}))).toBeNull();
    expect(snapshot(migrated)).toMatchObject({revealPacing:"ratio",revealRatio:.8});
  });
  it.each([1200, 2000, 3500, 5000] as const)("persists %ims and waits for it even during a fast Jackpot", (ms) => {
    const s = configure({ ...freshRun(), rushLeft: 20 }, { revealDurationMs: ms, revealPacing: "full" });
    expect(readSave(JSON.stringify(s))?.settings.revealDurationMs).toBe(ms);
    expect(spinTiming(s, s)).toMatchObject({ revealDelay: ms, holdForResult: true });
    expect(spinTiming(s, s, true).revealDelay).toBe(0);
    expect(snapshot(s)).toMatchObject({ revealDurationMs: ms, revealPacing: "full" });
    const adaptive = configure(s, { revealPacing: "adaptive" });
    expect(spinTiming(adaptive, adaptive).revealDelay).toBe(250);
  });
  it("rejects invalid pacing/duration instead of admitting broken saved settings", () => {
    const s = freshRun();
    expect(readSave(JSON.stringify({ ...s, settings: { ...s.settings, revealPacing: "never" } }))).toBeNull();
    expect(readSave(JSON.stringify({ ...s, settings: { ...s.settings, revealDurationMs: 99999 } }))).toBeNull();
  });
});

describe("v2.2 Jackpot cumulative investment", () => {
  it("costs 59.5% of v2.1 at its representative infinity levels, preserving initial costs", () => {
    const s = { ...freshRun(), settings:{...defaultSettings,economyProfile:"v22" as const}, jackpots: 1 };
    let total = 0;
    for (let trim = 0; trim < 12; trim++) total += upgradePrice({ ...s, trim }, "trim")!;
    for (let rush = 0; rush < 12; rush++) total += upgradePrice({ ...s, rush }, "rush")!;
    expect(total).toBe(6315307600);
    expect(total / 10620777600).toBeCloseTo(0.595, 2);
    expect(upgradePrice(s, "trim")).toBe(500);
    expect(upgradePrice(s, "rush")).toBe(1000);
    expect(upgradePrice(s, "slots")).toBe(120);
    expect(upgradePrice(s, "speed")).toBe(25);
  });
  it("keeps the v2.0 comparison profile and other upgrades unchanged", () => {
    const s = { ...freshRun(), jackpots: 1 };
    const old = configure(s, priceProfile("v20"));
    expect(upgradePrice({ ...old, trim: 8 }, "trim")).toBe(150e6);
    expect(upgradePrice({ ...old, rush: 8 }, "rush")).toBe(250e6);
    for (const u of ["trim", "rush"] as const) {
      let previous = 0;
      for (let level = 0; level < (u === "trim" ? 99 : 30); level++) {
        const value = upgradePrice({ ...s, [u]: level } as Run, u)!;
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(previous);
        expect(value).toBeLessThanOrEqual(upgradePrice({ ...old, [u]: level }, u)!);
        previous = value;
      }
    }
  });
});
