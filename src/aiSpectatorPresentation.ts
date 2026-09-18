import { useEffect, useReducer, useRef } from 'react';
import type { AiSnapshot } from './aiApi';
import type { Run } from './game/engine';
import type { SweepFrame } from './TradingViews';

type SpinView = NonNullable<AiSnapshot['spinView']>;
export interface AiSpectatorPresentationState {
  shown: AiSnapshot | null;
  frame: SweepFrame | null;
  spinView: SpinView | null;
  pending: boolean;
  result: { key: string; run: Run } | null;
  /** One most recently received snapshot, not a queue of missed actions. */
  latest: AiSnapshot | null;
  captured: AiSnapshot | null;
  observedAt: number | null;
  needsBaseline: boolean;
  token: number;
}
export type AiSpectatorPresentationAction =
  | { type: 'receive'; snapshot: AiSnapshot | null; now: number; watching: boolean; reduced: boolean }
  | { type: 'finish'; token: number; now: number; reduced: boolean }
  | { type: 'suspend'; now: number; snapshot?: AiSnapshot | null }
  | { type: 'resume' };

export function initialAiSpectatorPresentation(): AiSpectatorPresentationState {
  return { shown: null, frame: null, spinView: null, pending: false, result: null,
    latest: null, captured: null, observedAt: null, needsBaseline: true, token: 0 };
}

function viewOf(snapshot: AiSnapshot | null): SpinView | null {
  const view = snapshot?.spinView;
  return view && Number.isFinite(view.intervalMs) && view.intervalMs > 0 &&
    Number.isSafeInteger(view.spinId) && view.spinId >= 0 &&
    view.spinId === snapshot.run.spins && Array.isArray(view.sweep?.bars) && view.sweep.bars.length === 100
    ? view : null;
}
function frameOf(snapshot: AiSnapshot | null, now: number, settled: boolean, reduced: boolean): SweepFrame | null {
  const view = viewOf(snapshot), last = snapshot?.run.last;
  if (!view || !last || last.id !== view.spinId) return null;
  return { id: view.spinId, roll: last.roll, values: view.sweep.bars.map(bar => bar ? bar.payout - bar.cost : null),
    snapshot: view.sweep, at: now, duration: reduced ? 0 : view.intervalMs * .8, settled };
}
function synchronize(state: AiSpectatorPresentationState, snapshot: AiSnapshot | null, now: number, needsBaseline: boolean): AiSpectatorPresentationState {
  return { ...state, shown: snapshot, latest: snapshot, frame: frameOf(snapshot, now, true, true),
    spinView: viewOf(snapshot), captured: null, pending: false, result: null, observedAt: now,
    needsBaseline, token: state.token + 1 };
}
function start(state: AiSpectatorPresentationState, snapshot: AiSnapshot, now: number, reduced: boolean, deferImmediate = false): AiSpectatorPresentationState {
  const frame = frameOf(snapshot, now, false, reduced);
  if (!frame) return synchronize(state, snapshot, now, false);
  if (reduced && !deferImmediate) return { ...state, shown: snapshot, frame: { ...frame, settled: true },
    spinView: viewOf(snapshot), captured: null, pending: false,
    result: { key: `${snapshot.id}:${frame.id}`, run: snapshot.run }, token: state.token + 1 };
  return { ...state, frame, spinView: viewOf(snapshot), captured: snapshot, pending: true, token: state.token + 1 };
}

/** Pure receive -> animate -> publish state machine. Never mutates server snapshots. */
export function aiSpectatorPresentationReducer(state: AiSpectatorPresentationState, action: AiSpectatorPresentationAction): AiSpectatorPresentationState {
  if (action.type === 'resume') return { ...state, needsBaseline: true, result: null };
  if (action.type === 'suspend') {
    const offered = action.snapshot;
    const latest = offered && (!state.latest || offered.id !== state.latest.id || offered.version >= state.latest.version) ? offered : state.latest;
    return synchronize(state, latest, action.now, true);
  }
  if (action.type === 'finish') {
    if (!state.pending || !state.captured || !state.frame || action.token !== state.token) return state;
    if (!action.reduced && action.now < state.frame.at + state.frame.duration) return state;
    const captured = state.captured;
    const finished: AiSpectatorPresentationState = { ...state, shown: captured,
      frame: { ...state.frame, settled: true }, spinView: viewOf(captured), captured: null, pending: false,
      result: { key: `${captured.id}:${state.frame.id}`, run: captured.run } };
    const latest = state.latest;
    if (!latest || latest.id !== captured.id || latest.version < captured.version) return finished;
    if (latest.run.spins > captured.run.spins) {
      if (!frameOf(latest, action.now, false, action.reduced)) {
        // The latest spin may have aged out of the server's short action log.
        // Keep the completed captured result observable, then catch up statically.
        return { ...synchronize(finished, latest, action.now, false), result: finished.result };
      }
      // The result above remains observable while the one newest queued spin starts.
      // Even reduced-motion queues use a zero-delay boundary, so neither result is lost.
      return start(finished, latest, action.now, action.reduced, true);
    }
    return { ...finished, shown: latest, spinView: viewOf(latest) ?? finished.spinView };
  }

  const { snapshot, now, watching, reduced } = action;
  if (!snapshot) return synchronize(state, null, now, true);
  if (state.latest?.id === snapshot.id && snapshot.version < state.latest.version) return state;
  const gap = state.observedAt !== null && (now < state.observedAt || now - state.observedAt >= 5000);
  if (!watching || state.needsBaseline || !state.latest || state.latest.id !== snapshot.id || gap)
    return synchronize(state, snapshot, now, !watching);
  const received = { ...state, latest: snapshot, observedAt: now };
  // A later WORK/upgrade batch can trim the captured spin out of the server log.
  // Its missing view must not reveal that spin before the local sweep completes.
  if (state.pending) return received;
  if (!viewOf(snapshot)) return synchronize(received, snapshot, now, false);
  if (state.shown && snapshot.run.spins > state.shown.run.spins)
    return start(received, snapshot, now, reduced);
  return { ...received, shown: snapshot, spinView: viewOf(snapshot) };
}

/** Round up fractional deadlines and re-arm if a host timer still fires early. */
export function scheduleAiSweepFinish(deadline: number, reduced: () => boolean, complete: (now: number, reduced: boolean) => void): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const check = () => {
    if (cancelled) return;
    const now = Date.now(), reduceMotion = reduced(), remaining = deadline - now;
    if (!reduceMotion && remaining > 0) { timer = setTimeout(check, Math.ceil(remaining)); return; }
    complete(now, reduceMotion);
  };
  timer = setTimeout(check, reduced() ? 0 : Math.max(0, Math.ceil(deadline - Date.now())));
  return () => { cancelled = true; clearTimeout(timer); };
}

/** Viewer lifecycle stays local; visibility and other pages discard historical playback. */
export function useAiSpectatorPresentation(latest: AiSnapshot | null, watching: boolean, reduced: boolean) {
  const [state, dispatch] = useReducer(aiSpectatorPresentationReducer, undefined, initialAiSpectatorPresentation);
  const current = useRef({ latest, watching, reduced });
  current.current = { latest, watching, reduced };
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) dispatch({ type: 'suspend', now: Date.now(), snapshot: current.current.latest });
      else dispatch({ type: 'resume' });
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);
  useEffect(() => {
    if (!watching || document.hidden) dispatch({ type: 'suspend', now: Date.now(), snapshot: current.current.latest });
    else dispatch({ type: 'resume' });
  }, [watching]);
  useEffect(() => {
    dispatch({ type: 'receive', snapshot: latest, now: Date.now(), watching: current.current.watching && !document.hidden, reduced: current.current.reduced });
  }, [latest]);
  useEffect(() => {
    if (!state.pending || !state.frame) return;
    const token = state.token;
    return scheduleAiSweepFinish(state.frame.at + state.frame.duration, () => current.current.reduced, (now, reduceMotion) => {
      if (!current.current.watching || document.hidden) dispatch({ type: 'suspend', now: Date.now(), snapshot: current.current.latest });
      else dispatch({ type: 'finish', token, now, reduced: reduceMotion });
    });
  }, [state.pending, state.frame, state.token, reduced]);
  return { shown: state.shown, frame: state.frame, spinView: state.spinView, pending: state.pending, result: state.result };
}
