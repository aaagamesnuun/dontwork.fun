import { describe, expect, it } from "vitest";
import { freshRun, spin, work, purchase, endUnfundedJackpot, totalCost, readSave, type Run } from "./game/engine";
import { presentationReducer, presentedRun, type Presentation } from "./presentation";
import { startBackground, advanceBackground } from "./backgroundPlay";
import { jackpotEndedForFunds } from "./fundsAlert";

const rush = (cash = 10): Run => ({ ...freshRun(), cash, peak: 1e6, spins: 10, rushLeft: 20,
  chain: 3, removed: 5, jackpots: 3, running: true, portfolio: [{ id: "edge-50", count: 1 }] });
const reveal = (s: Presentation) => presentationReducer(s, { type: "reveal", runId: s.run.id, spinId: s.run.last!.id });

describe("a Jackpot needs enough money for the next wager", () => {
  it("ends on a losing spin, clears temporary cuts, and never resumes that chain after WORK", () => {
    const before = rush(), after = spin(before, 20);
    expect(after).toMatchObject({ cash: 0, rushLeft: 0, chain: 0, removed: 0, jackpotHigh: false, running: true, spins: 11 });
    expect(after.last).toMatchObject({ roll: 20, profit: -10 });
    expect(jackpotEndedForFunds(before, after)).toBe(true);
    let restored = after;
    for(let i=0;i<10;i++) restored=work(restored);
    expect(spin(restored,80)).toMatchObject({ rushLeft: 0, spins: 12 });
  });
  it("keeps a chain when the remaining cash exactly covers the next wager", () => {
    expect(spin(rush(20),20)).toMatchObject({ cash: 10, rushLeft: 19, removed: 5 });
    expect(spin(rush(19),20)).toMatchObject({ cash: 9, rushLeft: 0, removed: 0 });
  });
  it("uses the next wager after a loss-ladder raises its stake", () => {
    const before = { ...rush(250), catalog: "all-test" as const, portfolio: [{ id: "risk-1", count: 1 }] };
    const after = spin(before,20);
    expect(after.cash).toBeGreaterThanOrEqual(totalCost(before));
    expect(after.cash).toBeLessThan(totalCost(after));
    expect(after.rushLeft).toBe(0);
  });
  it("hides the end until reveal and does not resurrect it after a concurrent refill", () => {
    const before=rush();
    let model=presentationReducer({run:before,pending:null},{type:"change",update:s=>spin(s,20)});
    expect(presentedRun(model)).toMatchObject({cash:10,rushLeft:20,removed:5});
    expect(jackpotEndedForFunds(before,presentedRun(model))).toBe(false);
    for(let i=0;i<10;i++)model=presentationReducer(model,{type:"change",update:work});
    expect(presentedRun(model).rushLeft).toBe(20);
    expect(reveal(model).run).toMatchObject({cash:10,rushLeft:0,removed:0});
  });
  it("ends on an upgrade purchase and leaves enough to continue only at the exact boundary", () => {
    const before=rush(30);
    const after=presentationReducer({run:before,pending:null},{type:"purchase",update:s=>purchase(s,"speed")});
    expect(after.run).toMatchObject({cash:5,speed:1,spent:25,rushLeft:0});
    expect(jackpotEndedForFunds(before,after.run)).toBe(true);
    const funded=presentationReducer({run:rush(35),pending:null},{type:"purchase",update:s=>purchase(s,"speed")});
    expect(funded.run.rushLeft).toBe(20);
  });
  it("defers a purchase's ending decision until the accepted spin is revealed", () => {
    let model=presentationReducer({run:rush(35),pending:null},{type:"change",update:s=>spin(s,20)});
    model=presentationReducer(model,{type:"purchase",update:s=>purchase(s,"speed")});
    expect(model.run).toMatchObject({cash:0,speed:1,rushLeft:19});
    expect(presentedRun(model)).toMatchObject({cash:10,rushLeft:20});
    expect(reveal(model).run).toMatchObject({cash:0,rushLeft:0,removed:0});
  });
  it("ends after a FLIP loss without losing coin accounting", () => {
    const before={...rush(10),settings:{...rush(10).settings,coinFlip:true},coinEnabled:true};
    const after=presentationReducer({run:before,pending:null},{type:"coin-flip",wager:10,forced:false});
    expect(after.run).toMatchObject({cash:0,rushLeft:0,coinRounds:1,coinWagered:10,coinPaid:0});
  });
  it("applies the same rule to background spins", () => {
    const before={...rush(),settings:{...rush().settings,backgroundPlay:true}};
    const background=startBackground(before,1000);
    const after=advanceBackground(background,2000,true,100,20).run;
    expect(after).toMatchObject({cash:0,rushLeft:0,background:null,backgroundJackpot:false});
  });
  it("does not hold a background Jackpot notification when that same spin runs out of funds", () => {
    const before={...rush(20),catalog:"all-test" as const,rushLeft:0,removed:0,portfolio:[{id:"sequence-boost-1",count:1}],settings:{...rush().settings,backgroundPlay:true}};
    const after=advanceBackground(startBackground(before,1000),6000,true,100,100).run;
    expect(after.last?.jackpot).toBe(true);
    expect(after).toMatchObject({cash:0,rushLeft:0,background:null,backgroundJackpot:false});
  });
  it("normalizes an old unfunded Jackpot without resetting progress or earned records", () => {
    const before=rush(0), loaded=readSave(JSON.stringify(before))!;
    const after=endUnfundedJackpot(loaded);
    expect(after).toMatchObject({id:before.id,cash:0,spins:before.spins,rushLeft:0,removed:0,debug:before.debug});
    expect(after.history).toEqual(loaded.history);
    expect(after.completion).toEqual(loaded.completion);
    expect(after.infinityAt).toBe(loaded.infinityAt);
  });
  it("does not end for AUTO off, empty fuel or zero-cost WORK", () => {
    const paused={...rush(10),running:false,fuel:0};
    expect(endUnfundedJackpot(paused)).toBe(paused);
    const free={...rush(0),portfolio:[{id:"work-income",count:1}]};
    expect(endUnfundedJackpot(free)).toBe(free);
  });
});
