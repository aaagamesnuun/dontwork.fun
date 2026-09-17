import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GAME_LOOKS, normalizeLook, lookEnergy } from "./gameLooks";
import { FutureFolds, LookHeading, LookPanelLabel, LookPicker, LookReaction } from "./LookExperience";
import { advanceTrial, configure, finish, freshRun, freshTrial, readSave, resumeTrial, spin, TARGET, TRIAL_MS, work, type Run } from "./game/engine";
import { presentedRun, presentationReducer, type Presentation } from "./presentation";
import { setLanguage } from "./i18n";
const change = (model: Presentation, update: (s: Run) => Run) => presentationReducer(model, { type: "change", update });
const reveal = (model: Presentation) => presentationReducer(model, { type: "reveal", runId: model.run.id, spinId: model.run.last!.id });
afterEach(() => setLanguage("ja"));

describe("looks never change the game", () => {
  it.each(GAME_LOOKS)("saves $id and retains both ranking qualifications", ({ id }) => {
    const before = { ...freshRun(), cash: 12345, peak: 12345, work: 81, portfolio: [{ id: "edge-50", count: 1 }] };
    const next = configure(before, { look: id });
    expect(next).toEqual({ ...before, settings: { ...before.settings, look: id } });
    expect(readSave(JSON.stringify(next))).toMatchObject({ id: before.id, cash: 12345, work: 81, debug: false, settings: { look: id } });
    expect(finish({ ...next, cash: TARGET }).completion?.ranked).toBe(true);
    const trial = advanceTrial(resumeTrial(freshTrial(next.settings), 1000), 1000 + TRIAL_MS);
    expect(trial.settings.look).toBe(id);
    expect(trial.trial?.result?.ranked).toBe(true);
  });
  it.each([undefined, null, 7, "unknown", "__proto__"])("safely migrates unknown preference %s", value => {
    const source = { ...freshRun(), cash: 730, peak: 730, work: 25 };
    const saved = { ...source, settings: { ...source.settings, look: value } };
    expect(readSave(JSON.stringify(saved))).toMatchObject({ id: source.id, cash: 730, work: 25, debug: false, settings: { look: "classic" } });
    expect(normalizeLook(value)).toBe("classic");
  });
  it("changes looks and accepts WORK during a pending spin without revealing or double-paying it", () => {
    const before = { ...freshRun(), cash: 1000, peak: 1000, portfolio: [{ id: "edge-50", count: 1 }], running: true };
    let model = change({ run: before, pending: null }, s => spin(s, 80));
    const resolvedCash = model.run.cash;
    for (const { id } of GAME_LOOKS) model = change(model, s => configure(s, { look: id }));
    model = change(model, work);
    expect(presentedRun(model)).toMatchObject({ cash: 1001, spins: 0, last: null, work: 1, settings: { look: "futures" } });
    expect(model.pending).not.toBeNull();
    expect(presentedRun(reveal(model)).cash).toBe(resolvedCash + 1);
    expect(reveal(reveal(model))).toEqual(reveal(model));
  });
});

describe("the futures paper only opens after publication", () => {
  it("renders identically for all hidden outcomes, even when a previous result exists", () => {
    const before = spin({ ...freshRun(), cash: 1000, peak: 1000, portfolio: [{ id: "edge-50", count: 1 }] }, 80);
    const markup = [1, 80, 100].map(roll => {
      const model = change({ run: before, pending: null }, s => spin(s, roll));
      const shown = presentedRun(model);
      return renderToStaticMarkup(<FutureFolds revealedRoll={shown.last?.roll ?? null} pending={!!model.pending}/>);
    });
    expect(new Set(markup).size).toBe(1);
    expect(markup[0]).not.toContain('data-open-face');
    expect(markup[0]).not.toContain('future-open');
  });
  it.each([1, 80, 100])("opens just one fold for published face %i", roll => {
    const html = renderToStaticMarkup(<FutureFolds revealedRoll={roll} pending={false}/>);
    expect(html).toContain(`data-open-face="${roll}"`);
    expect(html.match(/future-open/g)).toHaveLength(1);
    expect(html).toContain(`left:${roll - 1}%`);
    expect(renderToStaticMarkup(<FutureFolds revealedRoll={null} pending={false}/>)).not.toContain('future-open');
  });
  it("does not replay an old win merely because a look is selected or a save is loaded", () => {
    for (const { id } of GAME_LOOKS) {
      const s = configure(spin({ ...freshRun(), cash: 1000, portfolio: [{ id: "edge-50", count: 1 }] }, 100), { look: id });
      expect(renderToStaticMarkup(<LookReaction s={s} pending={false} reduced={false}/>)).not.toContain('look-jackpot');
      expect(renderToStaticMarkup(<LookReaction s={s} pending reduced/>)).not.toContain('look-jackpot');
    }
  });
});

it("offers all seven alternatives, one selected value, and an unchanged original in both languages", () => {
  for (const lang of ["ja", "en"] as const) {
    setLanguage(lang);
    const html = renderToStaticMarkup(<LookPicker value="collage" onChange={() => {}}/>);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/class="look-option look-option-/g)).toHaveLength(8);
    for (const look of GAME_LOOKS) expect(html).toContain((lang === "ja" ? look.name : look.en).replaceAll("&", "&amp;"));
  }
  const s = freshRun();
  expect(renderToStaticMarkup(<LookHeading s={s}/>)).toBe("");
  expect(renderToStaticMarkup(<LookPanelLabel look="classic" panel="chart"/>)).toBe("");
});
it("bounds purely visual energy independently of currency size", () => {
  expect(lookEnergy(-100, 10)).toBe(0);
  expect(lookEnergy(0, 0)).toBe(0);
  expect(lookEnergy(Infinity, 1)).toBe(0);
  expect(lookEnergy(1e200, 1)).toBe(1);
  expect(lookEnergy(100, 10)).toBeGreaterThan(lookEnergy(10, 10));
});
