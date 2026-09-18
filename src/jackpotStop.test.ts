import { describe, expect, it } from "vitest";
import { finish, freshRun, interval, isInfinite, purchase, readSave, rollFloor, spin, TARGET, work, type Run } from "./game/engine";
import { presentationReducer, presentedRun, type Presentation } from "./presentation";
import { resultRankingPath } from "./resultRanking";

const infinite = (): Run => spin({
  ...freshRun(), cash: 10_000, peak: 10_000, startedAt: 1000, activeMs: 60_000,
  portfolio: [{ id: "edge-50", count: 1 }], running: true,
  spins: 20, work: 73, spent: 5000, rushLeft: 20, removed: 98, trim: 1,
  chain: 98, jackpots: 98,
}, 100);
const stop = (model: Presentation) => presentationReducer(model, { type: "jackpot-stop" });
const acceptSpin = (run: Run) => presentationReducer({ run, pending: null }, { type: "change", update: s => spin(s, 100) });
const reveal = (model: Presentation, runId = model.run.id, spinId = model.run.last!.id) =>
  presentationReducer(model, { type: "reveal", runId, spinId });

describe("ending an infinite Jackpot by choice", () => {
  it("ends the current chain without altering money, positions, upgrades or earned milestones", () => {
    const before = { ...infinite(), backgroundJackpot: true };
    expect(isInfinite(before)).toBe(true);
    const stopped = stop({ run: before, pending: null });
    expect(stopped.pending).toBeNull();
    expect(stopped.run).toMatchObject({ rushLeft: 0, removed: 0, chain: 0, jackpotHigh: false, backgroundJackpot: false, background: null });
    for (const key of ["id", "cash", "portfolio", "speed", "slots", "trim", "rush", "spent", "work", "spins", "history", "jackpots", "maxChain", "infinityAt", "activeMs", "running", "debug"] as const)
      expect(stopped.run[key], key).toEqual(before[key]);
    expect(isInfinite(stopped.run)).toBe(false);
    expect(rollFloor(stopped.run)).toBe(1);
    expect(interval(stopped.run)).toBeGreaterThan(interval(before));
  });

  it("publishes an accepted 100 exactly once and ignores the late reveal callback", () => {
    const before = infinite(), accepted = acceptSpin(before);
    expect(presentedRun(accepted).cash).toBe(before.cash);
    expect(accepted.run.cash).toBeGreaterThan(before.cash);
    const stopped = stop(accepted);
    expect(stopped.pending).toBeNull();
    expect(presentedRun(stopped)).toBe(stopped.run);
    expect(stopped.run).toMatchObject({ cash: accepted.run.cash, spins: before.spins + 1, rushLeft: 0, removed: 0 });
    expect(stopped.run.last).toEqual(accepted.run.last);
    expect(stopped.run.history).toEqual(accepted.run.history);
    expect(reveal(stopped)).toBe(stopped);
    expect(stop(stopped)).toBe(stopped);

    const next = presentationReducer(stopped, { type: "change", update: s => spin(s, 1) });
    const stale = reveal(next, accepted.run.id, accepted.run.last!.id);
    expect(stale).toBe(next);
    expect(reveal(stale).run).toMatchObject({ spins: before.spins + 2, rushLeft: 0, removed: 0 });
    expect(reveal(stale).run.last?.roll).toBe(1);
  });

  it("keeps WORK and an upgrade made while the last infinite spin was hidden", () => {
    const before = infinite();
    let model = acceptSpin(before);
    const acceptedCash = model.run.cash;
    model = presentationReducer(model, { type: "change", update: work });
    const workedCash = model.run.cash, workIncome = workedCash - acceptedCash;
    model = presentationReducer(model, { type: "purchase", update: s => purchase(s, "speed") });
    const cost = model.run.spent - before.spent;
    expect(workIncome).toBeGreaterThan(0);
    expect(cost).toBeGreaterThan(0);
    expect(presentedRun(model).cash).toBe(before.cash + workIncome - cost);

    const stopped = stop(model);
    expect(stopped.run).toMatchObject({ cash: acceptedCash + workIncome - cost, work: before.work + 1, speed: before.speed + 1, spent: before.spent + cost, rushLeft: 0 });
    expect(stopped.run.history).toEqual(model.run.history);
    expect(stopped.run.history.at(-1)).toMatchObject({ kind: "upgrade", spent: cost });
    expect(reveal(stopped)).toBe(stopped);
  });

  it("merges a concurrent FLIP into its accepted spin once instead of discarding or counting it twice", () => {
    const before = infinite();
    let model = acceptSpin({ ...before, peak: 1e6, coinEnabled: true, settings: { ...before.settings, coinFlip: true } });
    const acceptedCash = model.run.cash;
    model = presentationReducer(model, { type: "coin-flip", wager: 10, forced: true });
    expect(model.pending?.coinTouched).toBe(true);
    const stopped = stop(model);
    expect(stopped.run).toMatchObject({ cash: acceptedCash + 10, coinRounds: 1, coinWagered: 10, coinPaid: 20, coinPendingCount: 0, coinPendingProfit: 0, rushLeft: 0 });
    expect(stopped.run.history.reduce((sum, point) => sum + (point.coinCount ?? 0), 0)).toBe(1);
    expect(stopped.run.history.reduce((sum, point) => sum + (point.coinProfit ?? 0), 0)).toBe(10);
    expect(reveal(stopped)).toBe(stopped);
  });

  it("does nothing to a finite Jackpot, including one that will become infinite on its hidden result", () => {
    const finite = { ...infinite(), removed: 98 };
    const visible: Presentation = { run: finite, pending: null };
    expect(stop(visible)).toBe(visible);
    const hidden = acceptSpin(finite);
    expect(isInfinite(hidden.run)).toBe(true);
    expect(isInfinite(presentedRun(hidden))).toBe(false);
    expect(stop(hidden)).toBe(hidden);
  });

  it("preserves a completed ranked record and restores the stopped state from a save", () => {
    const completed = { ...finish({ ...infinite(), cash: TARGET, activeMs: 80_000 }), completionNickname: "Player", submitted: true };
    expect(completed.completion?.ranked).toBe(true);
    const rankingPath = resultRankingPath(completed);
    expect(rankingPath).not.toBeNull();
    const stopped = stop(acceptSpin(completed));
    for (const key of ["completion", "clearSnapshot", "clearAt", "clearSpins", "clearActiveMs", "completionNickname", "submitted", "infinityAt", "debug"] as const)
      expect(stopped.run[key], key).toEqual(completed[key]);
    expect(resultRankingPath(stopped.run)).toBe(rankingPath);
    const restored = readSave(JSON.stringify(stopped.run));
    expect(restored).not.toBeNull();
    expect(restored).toMatchObject({ id: completed.id, rushLeft: 0, removed: 0, cash: stopped.run.cash, completion: completed.completion, debug: false });
    expect(resultRankingPath(restored!)).toBe(rankingPath);
  });

  it("retains a first clear earned by the accepted payout without marking the run as LAB", () => {
    const before = { ...infinite(), cash: TARGET - 1, peak: TARGET - 1 };
    const accepted = acceptSpin(before);
    expect(accepted.run.completion?.ranked).toBe(true);
    expect(presentedRun(accepted).completion).toBeNull();
    const stopped = stop(accepted);
    expect(stopped.run.completion).toEqual(accepted.run.completion);
    expect(stopped.run.clearSnapshot).toEqual(accepted.run.clearSnapshot);
    expect(stopped.run).toMatchObject({ cash: accepted.run.cash, debug: false, rushLeft: 0 });
    expect(resultRankingPath(stopped.run)).not.toBeNull();
  });
});
