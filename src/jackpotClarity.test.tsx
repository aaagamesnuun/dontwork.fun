import { afterEach, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JackpotNews } from "./JackpotNews";
import { freshRun, setCount, spin, work } from "./game/engine";
import { guidance, jackpotCondition } from "./game/guidance";
import { newsTopic } from "./GameHelp";
import { setLanguage } from "./i18n";
import { createProgressSignal, SpinProgress } from "./SpinProgress";
import { presentationReducer, presentedRun } from "./presentation";
afterEach(() => setLanguage("ja"));
const playable = () => setCount({ ...freshRun(), cash: 1e6, peak: 1e6, spent: 100, running: true, secondBetTutorial: "done" }, "edge-50", 1);

it("keeps the remaining spins and cut range alongside each rotating explanation", () => {
  const s = { ...playable(), rushLeft: 18, chain: 4, removed: 10 };
  for (let tick = 0; tick < 4; tick++) {
    const html = renderToStaticMarkup(<JackpotNews s={s} tick={tick}/>);
    expect(html).toContain("<strong>18</strong>");
    expect(html).toContain("スピン残り"); expect(html).toContain("1〜10をカット");
    expect(html).toContain(tick % 2 === 0 ? "91以上が2回連続" : "最大まで補充");
    expect(html).not.toContain("無限");
  }
  expect(renderToStaticMarkup(<JackpotNews s={{ ...s, running: false }} tick={0}/>)).toContain("停止中");
});
it("introduces the actual rule on a first chain and follows LAB rule changes", () => {
  for (const rule of ["combined", "hundred", "double-high"] as const) {
    const s = { ...playable(), rushLeft: 20, chain: 1, settings: { ...freshRun().settings, jackpotRule: rule } };
    const html = renderToStaticMarkup(<JackpotNews s={s} tick={1}/>);
    expect(html).toContain(jackpotCondition(rule));
    if (rule === "hundred") expect(html).not.toContain("91以上");
  }
});
it("explains a primed roll and the completed jackpot without interrupting cash recovery", () => {
  const first = spin(playable(), 91), jackpot = spin(first, 92);
  expect(guidance(first).key).toBe("jackpot-ready");
  const ended = { ...jackpot, rushLeft: 0, jackpotHigh: false, spinsSinceJackpot: 1 };
  expect(guidance(ended).key).toBe("jackpot-recap");
  expect(guidance({ ...ended, cash: 0 }).target).toBe("work");
  for (const key of ["jackpot-ready", "jackpot-recap", "jackpot-intro"]) expect(newsTopic(key)).toBe("jackpot");
});
it("does not publish the primed condition before the current spin settles", () => {
  const before = { ...playable(), spins: 15 }, after = spin(before, 91);
  const pending = presentationReducer({ run: before, pending: null }, { type: "change", update: () => after });
  expect(guidance(presentedRun(pending)).key).not.toBe("jackpot-ready");
  const settled = presentationReducer(pending, { type: "reveal", runId: before.id, spinId: after.last!.id });
  expect(guidance(presentedRun(settled)).key).toBe("jackpot-ready");
});
it("supports English jackpot news", () => {
  setLanguage("en");
  expect(jackpotCondition("combined")).toContain("two consecutive 91+");
});
it("ends an unfunded Jackpot on the revealed loss and guides ordinary play recovery", () => {
  const before = { ...playable(), cash: 10, rushLeft: 18, chain: 2, spins: 15 };
  let model = presentationReducer({ run: before, pending: null }, { type: "change", update: s => spin(s, 1) });
  expect(renderToStaticMarkup(<JackpotNews s={presentedRun(model)} tick={0}/>)).not.toContain("賭け金が足りず");
  model = presentationReducer(model, { type: "reveal", runId: before.id, spinId: model.run.last!.id });
  const shown = presentedRun(model);
  expect(shown.rushLeft).toBe(0);
  expect(guidance(shown)).toMatchObject({ target: "work", urgent: true });
  expect(guidance(shown).text).toContain("$10");
  let refilled = shown;
  for (let i=0;i<10;i++) refilled=work(refilled);
  expect(refilled.rushLeft).toBe(0);
  expect(spin(refilled, 80).rushLeft).toBe(0);
});
it("highlights AUTO when Jackpot is paused and localizes the stopping reason", () => {
  const paused = { ...playable(), settings:{...playable().settings,autoAlwaysOn:false}, spins: 15, rushLeft: 18, running: false };
  expect(guidance(paused)).toMatchObject({ key: "jackpot-paused", target: "auto", urgent: true });
  expect(newsTopic("jackpot-paused")).toBe("spin");
  const html = renderToStaticMarkup(<JackpotNews s={paused} tick={1}/>);
  expect(html).toContain("AUTOが停止中"); expect(html).toContain("<strong>18</strong>");
  setLanguage("en");
  expect(renderToStaticMarkup(<JackpotNews s={paused} tick={0}/>)).toContain("AUTO is off");
});
it("updates only charge subscribers, ignores duplicate ticks, and remembers progress on remount", () => {
  const signal = createProgressSignal(); let updates = 0;
  const unsubscribe = signal.subscribe(() => updates++);
  signal.update(.4); signal.update(.4); expect(updates).toBe(1);
  expect(renderToStaticMarkup(<SpinProgress signal={signal}/>)).toContain("scaleX(0.4)");
  signal.update(2); expect(signal.read()).toBe(1);
  unsubscribe(); signal.update(0); expect(updates).toBe(2);
  expect(signal.read()).toBe(0);
});
