import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiSnapshot } from './aiApi';
import { aiChoices, newAiRun } from './game/ai';
import { interval, purchase, spin, work, type Run } from './game/engine';
import { sweepSnapshot } from './game/sweep';
import { aiSpectatorPresentationReducer as reduce, initialAiSpectatorPresentation, scheduleAiSweepFinish, type AiSpectatorPresentationState } from './aiSpectatorPresentation';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const SERVER_NOW = 1_800_000_000_000;
function snapshot(run: Run = { ...newAiRun(), cash: 10000, peak: 10000, portfolio: [{ id: 'edge-50', count: 1 }] }): AiSnapshot {
  return { id: 'ai-session', nickname: 'Player', agentName: 'Codex', ruleset: 'ai-v1-astra-13', version: 0,
    createdAt: SERVER_NOW, expiresAt: SERVER_NOW + 86400000, startedAt: SERVER_NOW, updatedAt: SERVER_NOW,
    status: 'active', elapsedMs: 0, nextWorkAt: SERVER_NOW, nextSpinAt: SERVER_NOW, strategy: '', run,
    choices: aiChoices(run), log: [], spinView: { spinId: run.spins, sweep: sweepSnapshot(run), intervalMs: interval(run), jackpotHigh: run.jackpotHigh, jackpotRule: run.settings.jackpotRule } };
}
function rolled(before: AiSnapshot, roll = 80, spinInterval = 1000): AiSnapshot {
  const run = spin(before.run, roll, 0), version = before.version + 1;
  return { ...before, version, run, choices: aiChoices(run), updatedAt: SERVER_NOW + version * 1000,
    log: [...before.log, { version, type: 'spin', at: SERVER_NOW + version * 1000, reason: 'test', cash: run.cash, roll }],
    spinView: { spinId: run.spins, sweep: sweepSnapshot(before.run), intervalMs: spinInterval, jackpotHigh: before.run.jackpotHigh, jackpotRule: before.run.settings.jackpotRule } };
}
const receive = (state: AiSpectatorPresentationState, value: AiSnapshot | null, now: number, watching = true, reduced = false) => reduce(state, { type: 'receive', snapshot: value, now, watching, reduced });
const finish = (state: AiSpectatorPresentationState, now = state.frame!.at + state.frame!.duration, reduced = false) => reduce(state, { type: 'finish', token: state.token, now, reduced });

describe('AI spectator result presentation', () => {
  it('takes the first snapshot as a silent settled baseline, including an existing Jackpot', () => {
    const latest = rolled(snapshot(), 100), state = receive(initialAiSpectatorPresentation(), latest, 25);
    expect(state.shown).toBe(latest);
    expect(state.frame).toMatchObject({ settled: true, roll: 100 });
    expect(state.pending).toBe(false);
    expect(state.result).toBeNull();
  });

  it('hides cash, charts, logs, strategy and completion until the captured sweep ends', () => {
    const before = snapshot(), next = { ...rolled(before, 100, 4000), status: 'finished' as const, strategy: 'won' };
    const unchanged = structuredClone(next);
    const state = receive(receive(initialAiSpectatorPresentation(), before, 0), next, 200);
    expect(state.shown).toBe(before);
    expect(state.pending).toBe(true);
    expect(state.result).toBeNull();
    expect(state.frame).toMatchObject({ id: 1, roll: 100, at: 200, duration: 3200, settled: false });
    expect(state.frame!.snapshot).toBe(next.spinView!.sweep);
    expect(state.frame!.values).toEqual(next.spinView!.sweep.bars.map(bar => bar ? bar.payout - bar.cost : null));
    expect(state.spinView).toBe(next.spinView);
    expect(finish(state, 3399)).toBe(state);
    const published = finish(state, 3400);
    expect(published.shown).toBe(next);
    expect(published.frame?.settled).toBe(true);
    expect(published.result).toEqual({ key: 'ai-session:1', run: next.run });
    expect(published.pending).toBe(false);
    expect(next).toEqual(unchanged);
  });

  it('uses the captured before-spin interval, even after Jackpot or speed upgrades change the server interval', () => {
    const before = snapshot(), next = rolled(before, 100, 3800);
    const state = receive(receive(initialAiSpectatorPresentation(), before, 0), next, 1000);
    expect(interval(next.run)).not.toBe(3800);
    expect(state.frame?.duration).toBe(3040);
    expect(state.spinView?.jackpotHigh).toBe(before.run.jackpotHigh);
  });

  it('keeps a stable frame during WORK, upgrades and quiet polls, then catches up without replaying the result', () => {
    const before = snapshot(), captured = rolled(before), updatedRun = purchase(work(captured.run), 'speed');
    const updated = { ...captured, version: 3, run: updatedRun, choices: aiChoices(updatedRun), strategy: 'upgrade now' };
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), captured, 100);
    const queued = receive(receive(pending, updated, 400), { ...updated }, 500);
    expect(queued.frame).toBe(pending.frame);
    expect(queued.captured).toBe(captured);
    expect(queued.shown).toBe(before);
    const published = finish(queued);
    expect(published.shown?.run).toBe(updatedRun);
    expect(published.result?.run).toBe(captured.run);
    expect(published.result?.key).toBe('ai-session:1');
    expect(finish(published, 5000)).toBe(published);
    const quiet = receive(published, updated, 1500);
    expect(quiet.pending).toBe(false);
    expect(quiet.result).toBe(published.result);
  });

  it('does not reveal a captured result when later actions trim its sweep metadata from the server log', () => {
    const before = snapshot(), captured = rolled(before, 100);
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), captured, 100);
    const trimmed = { ...captured, version: 35, run: work(captured.run), spinView: undefined };
    const queued = receive(pending, trimmed, 400);
    expect(queued.pending).toBe(true);
    expect(queued.frame).toBe(pending.frame);
    expect(queued.spinView).toBe(captured.spinView);
    expect(queued.shown).toBe(before);
    expect(queued.result).toBeNull();
    const published = finish(queued);
    expect(published.shown).toBe(trimmed);
    expect(published.result).toEqual({ key: 'ai-session:1', run: captured.run });
    expect(published.pending).toBe(false);
  });

  it('finishes the captured result even when the newest queued spin has no surviving view', () => {
    const before = snapshot(), captured = rolled(before), second = rolled(captured, 100);
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), captured, 100);
    const trimmed = { ...second, version: 35, spinView: undefined };
    const queued = receive(pending, trimmed, 400);
    expect(queued.shown).toBe(before);
    expect(queued.frame).toBe(pending.frame);
    expect(queued.result).toBeNull();
    const published = finish(queued);
    expect(published.shown).toBe(trimmed);
    expect(published.result).toEqual({ key: 'ai-session:1', run: captured.run });
    expect(published.pending).toBe(false);
    expect(published.frame).toBeNull();
  });

  it('coalesces many queued spins into the newest complete result, never a historical backlog', () => {
    const before = snapshot(), captured = rolled(before);
    let state = receive(receive(initialAiSpectatorPresentation(), before, 0), captured, 100), latest = captured;
    for (let i = 0; i < 20; i++) { latest = rolled(latest, i % 2 ? 1 : 80); state = receive(state, latest, 120 + i * 20); }
    expect(state.captured).toBe(captured);
    expect(state.latest).toBe(latest);
    const firstResult = finish(state);
    expect(firstResult.shown).toBe(captured);
    expect(firstResult.result?.key).toBe('ai-session:1');
    expect(firstResult.captured).toBe(latest);
    expect(firstResult.frame?.id).toBe(21);
    const lastResult = finish(firstResult);
    expect(lastResult.shown).toBe(latest);
    expect(lastResult.result?.key).toBe('ai-session:21');
    expect(lastResult.captured).toBeNull();
    expect(lastResult.pending).toBe(false);
  });

  it('ignores stale snapshots and timers without rewinding or ending the next spin', () => {
    const before = snapshot(), first = rolled(before), second = rolled(first);
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), first, 100);
    const queued = receive(pending, second, 200);
    expect(receive(queued, first, 300)).toBe(queued);
    const next = finish(queued);
    expect(reduce(next, { type: 'finish', token: pending.token, now: 5000, reduced: false })).toBe(next);
    expect(receive(next, before, 4000)).toBe(next);
    expect(next.pending).toBe(true);
  });

  it.each([5000, 8000, -1])('silently rebases after an unsafe polling gap of %i ms', gap => {
    const before = snapshot(), next = rolled(before);
    const baseline = receive(initialAiSpectatorPresentation(), before, 10000);
    const received = receive(baseline, next, 10000 + gap);
    expect(received.shown).toBe(next);
    expect(received.pending).toBe(false);
    expect(received.result).toBeNull();
  });

  it('counts quiet polls as a live connection and accepts a spin before the five second boundary', () => {
    const before = snapshot();
    let state = receive(initialAiSpectatorPresentation(), before, 0);
    state = receive(state, { ...before }, 4000);
    state = receive(state, { ...before }, 8000);
    state = receive(state, rolled(before), 12999);
    expect(state.pending).toBe(true);
  });

  it('discards animation and result events on visibility changes, baselining the first returning poll', () => {
    const before = snapshot(), first = rolled(before), second = rolled(first), third = rolled(second);
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), first, 100);
    const hidden = reduce(pending, { type: 'suspend', now: 200, snapshot: second });
    expect(hidden.shown).toBe(second);
    expect(hidden.pending).toBe(false);
    expect(hidden.result).toBeNull();
    expect(reduce(hidden, { type: 'finish', token: pending.token, now: 2000, reduced: false })).toBe(hidden);
    const resumed = reduce(hidden, { type: 'resume' });
    const returningPoll = receive(resumed, third, 300);
    expect(returningPoll.shown).toBe(third);
    expect(returningPoll.pending).toBe(false);
    expect(returningPoll.result).toBeNull();
    expect(receive(returningPoll, rolled(third), 500).pending).toBe(true);
  });

  it('does not replay updates received while rankings or the connection form are open', () => {
    const before = snapshot(), first = rolled(before), second = rolled(first);
    let state = receive(initialAiSpectatorPresentation(), before, 0);
    state = receive(state, first, 100, false);
    expect(state.shown).toBe(first);
    expect(state.result).toBeNull();
    expect(state.needsBaseline).toBe(true);
    state = reduce(state, { type: 'resume' });
    state = receive(state, second, 200);
    expect(state.shown).toBe(second);
    expect(state.pending).toBe(false);
    expect(receive(state, rolled(second), 300).pending).toBe(true);
  });

  it('rebases a different session and rejects the previous session animation timer', () => {
    const before = snapshot(), first = rolled(before);
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), first, 100);
    const other = { ...rolled(snapshot(), 100), id: 'other-session' };
    const switched = receive(pending, other, 200);
    expect(switched.shown).toBe(other);
    expect(switched.result).toBeNull();
    expect(switched.pending).toBe(false);
    expect(reduce(switched, { type: 'finish', token: pending.token, now: 1000, reduced: false })).toBe(switched);
  });

  it('supports old snapshots and malformed sweep metadata as silent static updates', () => {
    const before = snapshot(), next = rolled(before);
    const baseline = receive(initialAiSpectatorPresentation(), before, 0);
    for (const spinView of [undefined, { ...next.spinView!, spinId: 99 }, { ...next.spinView!, intervalMs: Infinity }]) {
      const legacy = { ...next, spinView }, received = receive(baseline, legacy, 100);
      expect(received.shown).toBe(legacy);
      expect(received.frame).toBeNull();
      expect(received.result).toBeNull();
      expect(received.pending).toBe(false);
    }
  });

  it('publishes a newly observed result immediately with reduced motion', () => {
    const before = snapshot(), next = rolled(before);
    const baseline = receive(initialAiSpectatorPresentation(), before, 0, true, true);
    const reduced = receive(baseline, next, 100, true, true);
    expect(reduced.shown).toBe(next);
    expect(reduced.pending).toBe(false);
    expect(reduced.frame).toMatchObject({ duration: 0, settled: true, roll: next.run.last!.roll });
    expect(reduced.result).toEqual({ key: 'ai-session:1', run: next.run });
  });

  it('finishes a reduced-motion transition without losing a captured or newest queued result', () => {
    const before = snapshot(), first = rolled(before), second = rolled(first);
    const pending = receive(receive(initialAiSpectatorPresentation(), before, 0), first, 100);
    const queued = receive(pending, second, 200);
    const firstPublished = finish(queued, 250, true);
    expect(firstPublished.result?.key).toBe('ai-session:1');
    expect(firstPublished.shown).toBe(first);
    expect(firstPublished.frame?.duration).toBe(0);
    expect(firstPublished.pending).toBe(true);
    const secondPublished = finish(firstPublished, 250, true);
    expect(secondPublished.shown).toBe(second);
    expect(secondPublished.result?.key).toBe('ai-session:2');
    expect(secondPublished.pending).toBe(false);
  });
});

describe('AI sweep completion timer', () => {
  it('rounds a fractional millisecond deadline up instead of permanently leaving the sweep pending', () => {
    vi.useFakeTimers(); vi.setSystemTime(1000);
    const complete = vi.fn();
    scheduleAiSweepFinish(1234.8, () => false, complete);
    vi.advanceTimersByTime(234);
    expect(complete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(complete).toHaveBeenCalledExactlyOnceWith(1235, false);
  });

  it('re-arms a prematurely invoked host timer and remains cancellable', () => {
    const callbacks: (() => void)[] = [], waits: number[] = [];
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, wait: number) => {
      callbacks.push(callback); waits.push(wait); return callbacks.length;
    }) as typeof setTimeout);
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {});
    const complete = vi.fn(), cancel = scheduleAiSweepFinish(1234.8, () => false, complete);
    vi.mocked(Date.now).mockReturnValue(1234); callbacks[0]();
    expect(complete).not.toHaveBeenCalled();
    expect(waits).toEqual([235, 1]);
    vi.mocked(Date.now).mockReturnValue(1235); callbacks[1]();
    expect(complete).toHaveBeenCalledExactlyOnceWith(1235, false);
    cancel(); callbacks[1]();
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
