import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectSequence } from "./effectSequence";
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe("LAB sequence lifetime", () => {
  it("settles each preview before advancing and finishes only after the final result", () => {
    const start = vi.fn(),
      result = vi.fn(),
      done = vi.fn();
    effectSequence(
      [23, 72, 39],
      260,
      600,
      { start, result, done, active: () => true },
      100,
    );
    vi.advanceTimersByTime(99);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(start).toHaveBeenCalledExactlyOnceWith(23, 0);
    vi.advanceTimersByTime(260);
    expect(result).toHaveBeenCalledExactlyOnceWith(23);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1200);
    expect(result.mock.calls.flat()).toEqual([23, 72, 39]);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(done).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels the pending result on close, even when the start callback ran late", () => {
    const result = vi.fn(),
      done = vi.fn();
    const cancel = effectSequence([23, 72], 700, 860, {
      start: vi.fn(),
      result,
      done,
      active: () => true,
    });
    // Only the first overdue callback executes; it now owns the result timer.
    vi.runOnlyPendingTimers();
    expect(vi.getTimerCount()).toBe(1);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(result).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("abandons a hidden preview without replaying old results on return", () => {
    let visible = true;
    const result = vi.fn(),
      done = vi.fn();
    effectSequence([23, 72], 260, 600, {
      start: vi.fn(),
      result,
      done,
      active: () => visible,
    });
    vi.advanceTimersByTime(1);
    visible = false;
    vi.advanceTimersByTime(5000);
    visible = true;
    vi.advanceTimersByTime(5000);
    expect(result).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
