import { useMemo, useState } from 'react';
import type { AiSnapshot } from './aiApi';
import type { useAiSpectatorPresentation } from './aiSpectatorPresentation';
import { defaultSettings, interval, money } from './game/engine';
import { sweepSnapshot } from './game/sweep';
import { PayoffSweep } from './TradingViews';
import { createSweepSignal, SweepMotionDriver } from './SweepReadout';
import { t } from './i18n';

/** The same reel and cosmetic clock as human play, driven by received AI spins. */
export function AiSweep({ state, presentation, reduced }: {
  state: AiSnapshot;
  presentation: ReturnType<typeof useAiSpectatorPresentation>;
  reduced: boolean;
}) {
  const [signal] = useState(createSweepSignal);
  const { frame, spinView, pending } = presentation;
  const sweep = useMemo(() => pending && spinView ? spinView.sweep : sweepSnapshot(state.run), [pending, spinView, state.run]);
  const values = useMemo(() => sweep.bars.map(bar => bar ? bar.payout - bar.cost : null), [sweep]);
  const displayFrame = useMemo(() => frame ?? (state.run.last ? {
    id: state.run.last.id, roll: state.run.last.roll, values, duration: 0, at: 0, settled: true,
  } : null), [frame, state.run.last, values]);
  // AI mode uses the classic cohort's uniform, non-cut outcomes.
  const bars = sweep.bars.filter(bar => bar !== null);
  const expected = bars.length ? bars.reduce((sum, bar) => sum + bar.payout - bar.cost, 0) / bars.length : 0;
  const maxPayout = Math.max(0, ...bars.map(bar => bar.payout));
  const wager = Math.max(0, ...bars.map(bar => bar.cost));
  const period = pending && spinView ? spinView.intervalMs : interval(state.run);
  const last = state.run.last;
  return <div className="ai-spin-stage" data-pending={pending ? 'true' : 'false'}>
    <SweepMotionDriver signal={signal} frame={displayFrame} motion={defaultSettings.sweepMotion} reduced={reduced}/>
    <PayoffSweep signal={signal} values={values} snapshot={sweep} frame={displayFrame} reduced={reduced}
      style="classic" motion={defaultSettings.sweepMotion} pending={pending} revealedRoll={last?.roll ?? null}
      jackpotRule={pending && spinView ? spinView.jackpotRule : state.run.settings.jackpotRule}
      jackpotHigh={pending && spinView ? spinView.jackpotHigh : state.run.jackpotHigh}/>
    <div className="ai-spin-metrics">
      <span><small>{t('期待値')}</small><b className={expected >= 0 ? 'positive' : 'negative'}>{expected > 0 ? '+' : ''}{money(expected)}</b></span>
      <span><small>{t('最大配当')}</small><b>{money(maxPayout)}</b></span>
      <span><small>{t('賭け金')}</small><b>{money(wager)}</b></span>
      <span><small>{t('スピン周期')}</small><b>{(period / 1000).toFixed(2)}s</b></span>
    </div>
    <div className={`ai-spin-outcome ${last?.jackpot ? 'is-jackpot' : ''}`}>
      <span>{last?.jackpot ? 'JACKPOT' : !last ? t('最初のスピンを待っています') : ''}</span>
      <strong className={(last?.profit ?? 0) >= 0 ? 'positive' : 'negative'} aria-label={t('直前の純損益')}>{last ? `${last.profit > 0 ? '+' : ''}${money(last.profit)}` : '—'}</strong>
    </div>
  </div>;
}
