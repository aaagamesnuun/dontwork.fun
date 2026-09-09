import { afterEach, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BalanceReadout } from "./BalanceReadout";
import { configure, freshRun, freshTrial, readSave, spin, type Run } from "./game/engine";
import { presentationReducer, presentedRun } from "./presentation";
import { setMoneyStyle } from "./moneyPreferences";
import { ReleaseLab } from "./ReleaseLab";
afterEach(() => setMoneyStyle("compact"));
const render = (s: Run, amount = -25) => renderToStaticMarkup(<BalanceReadout s={s} amount={amount} serial={1}/>);

it("puts the goal beside the total and switches to total/change/goal in LAB", () => {
  const run = {...freshRun(), cash:1234};
  const standard = render(run);
  expect(standard).not.toContain('eyebrow');
  expect(standard).toContain('<h1 aria-label="総資産: $1.23K">$1.23K</h1>');
  expect(standard.indexOf('balance-goal')).toBeLessThan(standard.indexOf('balance-result'));
  const inline = render(configure(run,{balanceChangeInline:true}));
  expect(inline.indexOf('</h1>')).toBeLessThan(inline.indexOf('balance-result'));
  expect(inline.indexOf('balance-result')).toBeLessThan(inline.indexOf('balance-goal'));
  expect(inline).toContain('クリア目標:1B$');
  const lab=renderToStaticMarkup(<ReleaseLab s={run} change={()=>{}}/>);
  expect(lab).toContain('最新の資産変化を総資産のすぐ右に表示');
});
it("persists the layout as a display preference without changing progress or ranking", () => {
  const run={...freshRun(),cash:1234,peak:1234,spins:6};
  expect(run.settings.balanceChangeInline).toBe(false);
  const next=readSave(JSON.stringify(configure(run,{balanceChangeInline:true})))!;
  expect(next).toMatchObject({id:run.id,cash:1234,spins:6,debug:false,settings:{balanceChangeInline:true}});
  const old=JSON.parse(JSON.stringify(run));delete old.settings.balanceChangeInline;
  expect(readSave(JSON.stringify(old))!.settings.balanceChangeInline).toBe(false);
  expect(readSave(JSON.stringify({...run,settings:{...run.settings,balanceChangeInline:"right"}}))).toBeNull();
  expect(freshTrial(next.settings)).toMatchObject({debug:false,settings:{balanceChangeInline:true}});
});
it("supports full amounts and the challenge score without adding a heading row", () => {
  setMoneyStyle("full");
  const html=render({...freshRun(),cash:1e9},1234567);
  expect(html).toContain('$1,000,000,000');expect(html).toContain('+$1,234,567');
  expect(html).not.toContain('eyebrow');
  const trial=render({...freshTrial(),cash:1000,spent:250});
  expect(trial).toContain('<h1 aria-label="総資産: $1,250">$1,250</h1>');
  expect(trial).toContain('30 MIN CHALLENGE');expect(trial).not.toContain('クリア目標');
});
it("keeps an accepted spin's winnings hidden until reveal with either layout", () => {
  for(const balanceChangeInline of [false,true]) {
    const before={...configure(freshRun(),{balanceChangeInline}),cash:100,peak:100,spins:6,portfolio:[{id:"edge-50",count:1}]};
    const after=spin(before,80);
    const pending=presentationReducer({run:before,pending:null},{type:"change",update:()=>after});
    expect(render(presentedRun(pending),0)).toContain('<h1 aria-label="総資産: $100">$100</h1>');
    const revealed=presentationReducer(pending,{type:"reveal",runId:before.id,spinId:after.last!.id});
    expect(render(presentedRun(revealed),after.last!.profit)).toContain('<h1 aria-label="総資産: $120">$120</h1>');
  }
});
