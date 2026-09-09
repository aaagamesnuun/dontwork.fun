import { expect, it } from "vitest";
import { cashCents, cashRainPlan, compactCash, MAX_CASH_TOKENS, tokenCents } from "./cashPlan";

it("uses actual small denominations and counts", () => {
  expect(cashRainPlan(1).tokens).toEqual([{denomination:100,units:1n}]);
  expect(cashRainPlan(20).tokens).toEqual(Array.from({length:2},()=>({denomination:1000,units:1n})));
  expect(cashRainPlan(250).tokens).toEqual(Array.from({length:25},()=>({denomination:1000,units:1n})));
  const change=cashRainPlan(21.03).tokens;
  expect(change.filter(t=>t.denomination===1000)).toHaveLength(2);
  expect(change.filter(t=>t.denomination===100)).toHaveLength(1);
  expect(change.filter(t=>t.denomination===1)).toHaveLength(3);
});

it.each([0,-20,NaN,Infinity,-Infinity])("never invents money for %s", amount => {
  expect(cashRainPlan(amount).tokens).toEqual([]);
});

it("conserves rounded cents across denomination boundaries, fractions and extreme amounts", () => {
  const values=[.001,.005,.01,.99,1,9.99,10,19.99,20,99.99,100,999.99,1000,10000,999999.99,1e6,1e9,1e15,1e100,1e200];
  let seed=417;
  for(let i=0;i<200;i++){seed=(seed*1664525+1013904223)>>>0;values.push(seed/100);}
  for(const amount of values) {
    const plan=cashRainPlan(amount);
    expect(plan.tokens.reduce((sum,t)=>sum+tokenCents(t),0n)).toBe(cashCents(amount));
    expect(plan.tokens.length).toBeLessThanOrEqual(MAX_CASH_TOKENS);
    expect(plan.tokens.every(t=>t.units>0n)).toBe(true);
  }
});

it("represents huge rewards as bundles and preserves value when rapid wins combine", () => {
  let queued=cashRainPlan(21.03).tokens,total=cashCents(21.03);
  for(const amount of [1e9,20,1e100,250,1e200]) {
    queued=compactCash([...queued,...cashRainPlan(amount).tokens]);total+=cashCents(amount);
    expect(queued.reduce((sum,t)=>sum+tokenCents(t),0n)).toBe(total);
    expect(queued.length).toBeLessThanOrEqual(MAX_CASH_TOKENS);
  }
  expect(queued.some(t=>t.units>1n)).toBe(true);
});

it("keeps coin-only effects in the same monetary scale", () => {
  const plan=cashRainPlan(20.02,true);
  expect(plan.tokens.filter(t=>t.denomination===100)).toHaveLength(20);
  expect(plan.tokens.filter(t=>t.denomination===1)).toHaveLength(2);
  expect(plan.tokens.reduce((sum,t)=>sum+tokenCents(t),0n)).toBe(2002n);
});
