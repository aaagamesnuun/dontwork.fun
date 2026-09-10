import { describe, expect, it } from "vitest";
import { freshRun, spin, setCount, loadPreset, readSave, upgradePrice, work, purchase, isInfinite, type Run } from "./game/engine";
import { presentationReducer as reduce, presentedRun, coinBudget, type Presentation } from "./presentation";

const ready = (): Run => ({...freshRun(),cash:1e6,peak:1e6,slots:2,running:true,
  coinEnabled:true,portfolio:[{id:"edge-50",count:1}],settings:{...freshRun().settings,coinFlip:true,assist:false}});
const begin = (s:Run,roll:number) => reduce({run:s,pending:null},{type:"change",update:r=>spin(r,roll)});
const remove = (s:Presentation) => reduce(s,{type:"position-change",intent:{kind:"count",id:"edge-50",delta:-1}});
const reveal = (s:Presentation) => reduce(s,{type:"reveal",runId:s.run.id,spinId:s.run.last!.id});
const approve = (s:Presentation) => reduce(s,{type:"position-decision",request:s.positionRequest!,accept:true});

describe("Jackpot refill economy",()=>{
  it("starts unupgraded cuts at zero and cannot accumulate cuts by renewing alone",()=>{
    let s=ready();expect(s.trim).toBe(0);
    for(let i=0;i<300;i++)s=spin(s,100);
    expect(s.removed).toBe(0);expect(s.rushLeft).toBe(20);expect(isInfinite(s)).toBe(false);
  });
  it("refills after spending the current spin, applies new maxima, and preserves old surplus",()=>{
    const s={...ready(),rushLeft:8,rush:2,trim:3,removed:6};
    const hit=spin(s,100);expect(hit).toMatchObject({rushLeft:30,removed:9});
    expect(spin(hit,100)).toMatchObject({rushLeft:30,removed:12});
    expect(spin({...hit,rush:3,rushLeft:1},100).rushLeft).toBe(35);
    expect(spin({...hit,rushLeft:100},100).rushLeft).toBe(99);
  });
  it("migrates purchase counts once without changing cash, spending, residual spins, or earned records",()=>{
    const old={...ready(),economyRevision:12,trim:8,spent:5742600,spins:100,rushLeft:700,removed:60};
    const migrated=readSave(JSON.stringify(old))!;
    expect(migrated).toMatchObject({economyRevision:13,trim:7,cash:old.cash,spent:old.spent,rushLeft:700,removed:60,debug:true});
    expect(migrated.id).not.toBe(old.id);
    expect(upgradePrice(migrated,"trim")).toBe(5800000);
    expect(readSave(JSON.stringify(migrated))).toMatchObject({id:migrated.id,trim:7,spent:old.spent});
    const initial=readSave(JSON.stringify({...old,trim:1}))!;
    expect(initial.trim).toBe(0);expect(upgradePrice(initial,"trim")).toBe(500);
  });
  it("ignores unchanged positions and presets, and uses the outgoing legacy deck for retention",()=>{
    const s={...ready(),slots:1,rushLeft:20,removed:40,chain:4,jackpotHigh:true};
    expect(setCount(s,"edge-50",1)).toBe(s);
    const preset={...s,presets:[s.portfolio.map(r=>({...r}))]};expect(loadPreset(preset,0)).toBe(preset);
    expect(setCount(s,"edge-50",-1)).toMatchObject({rushLeft:0,removed:0,chain:0,jackpotHigh:false,running:false});
    const legacy={...s,catalog:"legacy" as const,slots:2,owned:["memory-leak"],portfolio:[...s.portfolio,{id:"memory-leak",count:1}]};
    expect(setCount(legacy,"memory-leak",-1)).toMatchObject({rushLeft:0,removed:10,persistentRemoved:10});
  });
});

describe("position confirmation and pending settlement",()=>{
  it("requires consent while settled, and cancellation retains the entire Jackpot",()=>{
    const original={...ready(),rushLeft:20,removed:14,chain:7};
    const requested=remove({run:original,pending:null});
    expect(requested.run).toBe(original);expect(requested.positionRequest?.confirm).toBe(true);
    const cancel=reduce(requested,{type:"position-decision",request:requested.positionRequest!,accept:false});
    expect(cancel.run).toBe(original);expect(cancel.positionRequest).toBeUndefined();
    const accepted=approve(requested);expect(accepted.run).toMatchObject({rushLeft:0,removed:0,portfolio:[]});
  });
  it("does not reveal a hidden first Jackpot through the confirmation dialog",()=>{
    const pending=begin(ready(),100),queued=remove(pending);
    expect(queued.positionRequest).toBeUndefined();
    expect(queued.run.portfolio).toEqual([]);
    expect(presentedRun(queued).rushLeft).toBe(0);
    const landed=reveal(queued);expect(landed.positionRequest).toBeUndefined();
    expect(landed.run.rushLeft).toBe(20);expect(landed.run.portfolio).toHaveLength(0);
  });
  it("updates next positions immediately while preserving WORK, the accepted result, purchases and coin accounting",()=>{
    let s=remove(begin({...ready(),rushLeft:10,trim:2,removed:4},75));
    const request=s.positionRequest!,outcome=s.run.last,initialCash=s.run.cash;
    s=approve(s);expect(s.run.rushLeft).toBe(0);expect(s.run.portfolio).toHaveLength(0);
    s=reduce(s,{type:"change",update:work});
    s=reduce(s,{type:"purchase",update:r=>purchase(r,"speed")});
    expect(coinBudget(s)).toBeGreaterThan(100);
    s=reduce(s,{type:"coin-flip",wager:100,forced:true});
    const final=reveal(s);
    expect(final.run.cash).toBe(initialCash+1-25+100);
    expect(final.run).toMatchObject({rushLeft:0,removed:0,portfolio:[],speed:1,spent:25,work:1,coinPendingCount:0});
    expect(final.run.last).toBe(outcome);expect(final.run.history.at(-1)).toMatchObject({kind:"spin",coinCount:1,coinProfit:100});
    expect(final.positionRequest).toBeUndefined();
    expect(reveal(final)).toBe(final);
    expect(reduce(final,{type:"position-decision",request,accept:true})).toBe(final);
    expect(readSave(JSON.stringify(final.run))).toMatchObject({cash:final.run.cash,rushLeft:0,portfolio:[]});
  });
  it("cancels a pending request and drops stale approvals after replacing the run",()=>{
    const pending=begin({...ready(),rushLeft:10},75),request=remove(pending);
    const canceled=reduce(request,{type:"position-decision",request:request.positionRequest!,accept:false});
    expect(reveal(canceled).run).toMatchObject({rushLeft:9,portfolio:[{id:"edge-50",count:1}]});
    const reset=reduce(request,{type:"change",update:()=>freshRun()});
    expect(reset.positionRequest).toBeUndefined();
    expect(reduce(reset,{type:"position-decision",request:request.positionRequest!,accept:true})).toBe(reset);
  });
});
