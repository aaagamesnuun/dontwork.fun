import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSweep } from "./sweepMotion";
import { spinTiming } from "./spinTiming";
import { freshRun, spin, SWEEP_MOTIONS } from "./game/engine";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
});
afterEach(() => {
  vi.useRealTimers();
});
describe("spin-triggered sweep", () => {
  it.each(SWEEP_MOTIONS)(
    "keeps charge idle and plays a bounded reveal in %s mode",
    (motion) => {
      const update = vi.fn();
      startSweep(null, motion, false, update);
      vi.advanceTimersByTime(5000);
      expect(update).toHaveBeenCalledExactlyOnceWith(null, false, false);
      const before = {
        ...freshRun(),
        settings: {...freshRun().settings,revealPacing:"adaptive" as const},
        cash: 100,
        peak: 100,
        portfolio: [{ id: "edge-50", count: 1 }],
      };
      const result = spin(before, 100),
        timing = spinTiming(before, result);
      expect(timing).toEqual({ revealDelay: 700, holdForResult: true });
      const values = Array.from({ length: 100 }, (_, i) => (i < 50 ? null : i));
      const stop = startSweep(
        {
          id: 1,
          roll: 100,
          values,
          at: Date.now(),
          duration: timing.revealDelay,
        },
        motion,
        false,
        update,
      );
      expect(update.mock.lastCall?.[1]).toBe(true);
      vi.advanceTimersByTime(100);
      expect(update.mock.lastCall?.[1]).toBe(true);
      vi.advanceTimersByTime(600);
      expect(update).toHaveBeenLastCalledWith(100, false, false);
      const count = update.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(update).toHaveBeenCalledTimes(count);
      for (const [cursor, moving] of update.mock.calls)
        if (moving) expect(cursor).toBeGreaterThanOrEqual(51);
      stop();
    },
  );
  it("does not replay a completed frame and cancels a replaced reveal", () => {
    const update = vi.fn(),
      frame = {
        id: 1,
        roll: 80,
        values: Array(100).fill(10),
        at: Date.now(),
        duration: 260,
      };
    const cancel = startSweep(frame, "classic", false, update);
    cancel();
    const count = update.mock.calls.length;
    vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(count);
    startSweep(frame, "classic", false, update);
    expect(update).toHaveBeenLastCalledWith(80, false, false);
    startSweep({ ...frame, at: Date.now() }, "slow", true, update);
    expect(update).toHaveBeenLastCalledWith(80, false, false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
