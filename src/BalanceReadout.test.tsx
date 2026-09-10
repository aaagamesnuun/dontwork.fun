import { afterEach, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BalanceReadout } from "./BalanceReadout";
import { configure, freshRun, freshTrial, resumeTrial, readSave, spin, purchase, trialAssets, type Run } from "./game/engine";
import { presentationReducer, presentedRun } from "./presentation";
import { setMoneyStyle } from "./moneyPreferences";
import { ReleaseLab } from "./ReleaseLab";
afterEach(() => setMoneyStyle("compact"));
const render = (s: Run, amount = -25) => renderToStaticMarkup(<BalanceReadout s={s} amount={amount} serial={1}/>);

it("puts the goal beside the total and switches to total/change/goal in LAB", () => {
  const run = {...freshRun(), cash:1234};
  const standard = render(run);
  expect(standard).not.toContain('eyebrow');
  expect(standard).not.toContain('balance-trial-assets');
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
  for(const balanceChangeInline of [false,true]) {
    const trial=render({...freshTrial({...freshRun().settings,balanceChangeInline}),cash:1000,spent:250});
    expect(trial).toContain('<h1 aria-label="現金: $1,000">$1,000</h1>');
    expect(trial).toContain('class="balance-trial-assets" aria-label="総資産: $1,250"');
    expect(trial).toContain('<small>総資産</small><strong>$1,250</strong>');
    expect(trial.indexOf('</h1>')).toBeLessThan(trial.indexOf('balance-trial-assets'));
    expect(trial.indexOf('balance-trial-assets')).toBeLessThan(trial.indexOf('balance-goal'));
    expect(trial).toContain('30分モード');expect(trial).not.toContain('クリア目標');
  }
});
it("shows total holdings without changing an old challenge's cash-only score", () => {
  const trial=freshTrial();
  const legacy={...trial,cash:1000,spent:250,trial:{...trial.trial!,scoring:"cash" as const}};
  expect(render(legacy)).toContain('class="balance-trial-assets" aria-label="総資産: $1.25K"');
  expect(trialAssets(legacy)).toBe(1000);
});
it("shows spending in cash while keeping total assets stable, then reveals challenge winnings together", () => {
  for(const balanceChangeInline of [false,true]) {
    const before={...resumeTrial(freshTrial({...freshRun().settings,balanceChangeInline}),Date.now()),cash:1000,spent:250,peak:1000,portfolio:[{id:"edge-50",count:1}]};
    let model=presentationReducer({run:before,pending:null},{type:"change",update:s=>spin(s,80)});
    model=presentationReducer(model,{type:"change",update:s=>purchase(s,"speed")});
    const shown=presentedRun(model),pendingHtml=render(shown,0);
    expect(shown.cash).toBe(975);expect(trialAssets(shown)).toBe(1250);
    expect(pendingHtml).toContain('<h1 aria-label="現金: $975">$975</h1>');
    expect(pendingHtml).toContain('class="balance-trial-assets" aria-label="総資産: $1.25K"');
    const revealed=presentationReducer(model,{type:"reveal",runId:before.id,spinId:model.run.last!.id});
    const html=render(presentedRun(revealed),20);
    expect(html).toContain('<h1 aria-label="現金: $995">$995</h1>');
    expect(html).toContain('class="balance-trial-assets" aria-label="総資産: $1.27K"');
    expect(trialAssets(revealed.run)).toBe(1270);expect(revealed.run.debug).toBe(false);
  }
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
