import { describe, expect, it } from "vitest";
import { presentationReducer, presentedRun, type Presentation } from "./presentation";
import { freshRun, spin, work, purchase, loadPreset, configure, TARGET, type Run } from "./game/engine";
import { guidance } from "./game/guidance";

const ready = (): Run => ({ ...freshRun(), cash: 1000, peak: 1000,
  portfolio: [{ id: "edge-50", count: 1 }], running: true });
const change = (model: Presentation, update: (run: Run) => Run) =>
  presentationReducer(model, { type: "change", update });
const reveal = (model: Presentation) => presentationReducer(model, {
  type: "reveal", runId: model.run.id, spinId: model.run.last!.id,
});

describe("one published spin across every view", () => {
  it.each([1, 80, 100])("hides roll %i from the first render, then publishes all result fields together", (roll) => {
    const before = ready();
    const model = change({ run: before, pending: null }, (run) => spin(run, roll));
    expect(model.run.spins).toBe(1);
    const shown = presentedRun(model);
    for (const key of ["cash", "spins", "last", "history", "memory", "rushLeft", "removed", "jackpots", "lifetimeProfit", "maxChain", "bestWin"] as const)
      expect(shown[key], key).toEqual(before[key]);
    expect(guidance(shown).label).not.toBe("JACKPOT");
    expect(presentedRun(reveal(model))).toBe(model.run);
  });
  it("keeps WORK, AUTO, settings and a changed portfolio responsive without publishing the spin", () => {
    const before = ready();
    let model = change({ run: before, pending: null }, (run) => spin(run, 1));
    const resolvedCash = model.run.cash;
    model = change(model, work);
    model = change(model, (run) => ({ ...configure(run, { sound: false }), running: false,
      presets: [[{ id: "edge-50", count: 1 }]] }));
    model = change(model, (run) => loadPreset(run, 0));
    expect(presentedRun(model)).toMatchObject({ cash: before.cash + 1, spins: 0, work: 1, running: false, settings: { sound: false } });
    expect(model.run).toMatchObject({ cash: resolvedCash + 1, spins: 1 });
    expect(presentedRun(reveal(model))).toBe(model.run);
  });
  it("retains direct non-spin spending without duplicating or undoing the resolved spin", () => {
    const before = ready();
    let model = change({ run: before, pending: null }, (run) => spin(run, 80));
    const beforePurchase = model.run;
    model = change(model, (run) => purchase(run, "speed"));
    const cost = model.run.spent - beforePurchase.spent;
    expect(cost).toBeGreaterThan(0);
    expect(presentedRun(model).cash).toBe(before.cash - cost);
    expect(presentedRun(model).speed).toBe(1);
    const visible = presentedRun(reveal(model));
    expect(visible.cash).toBe(beforePurchase.cash - cost);
    expect(visible.spins).toBe(1);
  });
  it("hides a clear and infinity until landing, including the chart and next odds", () => {
    const before = { ...ready(), cash: TARGET - 10, peak: TARGET - 10,
      rushLeft: 10, removed: 98, trim: 2 };
    const model = change({ run: before, pending: null }, (run) => spin(run, 100));
    expect(model.run.clearAt).not.toBeNull();
    expect(model.run.infinityAt).not.toBeNull();
    expect(presentedRun(model)).toMatchObject({ clearAt: null, infinityAt: null, removed: 98, completion: null });
    expect(presentedRun(model).history).toEqual(before.history);
    expect(presentedRun(reveal(model))).toBe(model.run);
  });
  it("ignores a stale timer after a new run, and does not reapply a result twice", () => {
    const before = ready();
    const model = change({ run: before, pending: null }, (run) => spin(run, 80));
    const reset = change(model, () => freshRun());
    expect(presentationReducer(reset, { type: "reveal", runId: before.id, spinId: model.run.last!.id })).toBe(reset);
    const settled = reveal(model);
    expect(reveal(settled)).toBe(settled);
    expect(presentedRun(reset)).toBe(reset.run);
  });
  it("acknowledges a hidden result without requiring visual effects", () => {
    let model = change({ run: ready(), pending: null }, (run) => spin(run, 100));
    model = change(model, (run) => ({ ...run, running: false }));
    const done = reveal(model);
    expect(done.pending).toBeNull();
    expect(presentedRun(done)).toMatchObject({ running: false, spins: 1, jackpots: 1 });
  });
});
