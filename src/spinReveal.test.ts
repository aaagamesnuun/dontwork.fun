import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshRun, freshTrial, resumeTrial, spin, work, type Run } from "./game/engine";
import { presentationReducer, presentedRun, type Presentation } from "./presentation";
import { SpinReveal } from "./spinReveal";

const ready = (): Run => ({ ...freshRun(), cash: 1000, peak: 1000, spins: 10,
  rushLeft: 20, running: true, portfolio: [{ id: "edge-50", count: 1 }] });
function setup(run = ready(), roll = 100) {
  let model: Presentation = { run, pending: null };
  model = presentationReducer(model, { type: "change", update: s => spin(s, roll) });
  const reveal = new SpinReveal(() => model);
  const apply = vi.fn((recovered: boolean) => {
    void recovered;
    model = presentationReducer(model, { type: "reveal", runId: run.id, spinId: model.run.last!.id });
  });
  return { reveal, apply, get model() { return model; }, set model(next: Presentation) { model = next; } };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("spin reveal deadline", () => {
  it("publishes zero-duration results synchronously so roll and money cannot diverge for one frame", () => {
    const s = setup();
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 0, s.apply);
    expect(s.model.pending).toBeNull();
    expect(s.apply).toHaveBeenCalledExactlyOnceWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("publishes a Jackpot only at its deadline and only once", () => {
    const s = setup();
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 240, s.apply);
    vi.advanceTimersByTime(239);
    expect(presentedRun(s.model).spins).toBe(10);
    expect(s.reveal.check()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(s.model.pending).toBeNull();
    expect(s.model.run.spins).toBe(11);
    expect(s.apply).toHaveBeenCalledExactlyOnceWith(false);
    expect(s.reveal.check(1e6)).toBe(false);
  });
  it("recovers a lost timeout after the grace period, keeping the accepted result and concurrent WORK", () => {
    const s = setup(), result = s.model.run.last, originalCash = s.model.run.cash;
    s.reveal.schedule(s.model.run.id, result!.id, 240, s.apply);
    const deadline = s.reveal.dueAt;
    vi.clearAllTimers();
    s.model = presentationReducer(s.model, { type: "change", update: work });
    expect(s.reveal.check(deadline + 249)).toBe(false);
    expect(s.model.pending).not.toBeNull();
    expect(s.reveal.check(deadline + 250)).toBe(true);
    expect(s.apply).toHaveBeenCalledExactlyOnceWith(true);
    expect(s.model.run).toMatchObject({ cash: originalCash + 1, spins: 11, last: result });
    expect(s.model.pending).toBeNull();
    expect(s.reveal.check(deadline + 10000)).toBe(false);
  });
  it("also releases an accepted result after AUTO is switched off", () => {
    const s = setup();
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 240, s.apply);
    s.model = presentationReducer(s.model, { type: "change", update: run => ({ ...run, running: false }) });
    vi.advanceTimersByTime(240);
    expect(s.model.pending).toBeNull();
    expect(s.model.run.running).toBe(false);
  });
  it.each(["reset", "next-spin", "already-revealed"])("ignores a stale deadline after %s", mode => {
    const s = setup();
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 240, s.apply);
    if (mode === "reset") s.model = { run: freshRun(), pending: null };
    else {
      s.model = presentationReducer(s.model, { type: "reveal", runId: s.model.run.id, spinId: s.model.run.last!.id });
      if (mode === "next-spin") s.model = presentationReducer(s.model, { type: "change", update: run => spin(run, 80) });
    }
    const current = s.model;
    vi.advanceTimersByTime(240);
    expect(s.apply).not.toHaveBeenCalled();
    expect(s.model).toBe(current);
  });
  it("cancels all recovery paths at a pause, unmount or mode switch boundary", () => {
    const s = setup();
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 240, s.apply);
    s.reveal.cancel();
    expect(s.reveal.dueAt).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(s.reveal.check(1e6)).toBe(false);
    expect(s.apply).not.toHaveBeenCalled();
  });
  it("does not shorten an extended LAB animation when replacing a timer", () => {
    const s = setup();
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 240, s.apply);
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 10000, s.apply);
    vi.advanceTimersByTime(9999);
    expect(s.apply).not.toHaveBeenCalled();
    expect(s.reveal.check()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(s.apply).toHaveBeenCalledExactlyOnceWith(false);
  });
  it("does not play the delayed reveal after the challenge is paused", () => {
    vi.setSystemTime(1000);
    const trial = { ...resumeTrial(freshTrial(), 1000), cash: 1000, portfolio: [{ id: "edge-50", count: 1 }] };
    const s = setup(trial, 80);
    s.reveal.schedule(s.model.run.id, s.model.run.last!.id, 240, s.apply);
    s.model = presentationReducer(s.model, { type: "trial-pause", now: 1100 });
    const current = s.model;
    vi.advanceTimersByTime(240);
    expect(s.apply).not.toHaveBeenCalled();
    expect(s.model).toBe(current);
  });
});
