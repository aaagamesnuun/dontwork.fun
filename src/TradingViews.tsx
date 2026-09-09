import { t as _t, textValue as _text } from "./i18n";
import { ChartBackdrop } from "./ChartBackdrop";
import { useEffect, useState, useId } from "react";
import { duration, money, TRIAL_MS, trialAssets, type Run, type Settings } from "./game/engine";
import { barFraction, framePending, type SweepSnapshot } from "./game/sweep";
import { startSweep } from "./sweepMotion";
import { createSweepSignal, useSweepReading, SweepReadout, type SweepSignal } from "./SweepReadout";
export type SweepFrame = {
    id: number;
    roll: number;
    values: (number | null)[];
    duration: number;
    at: number;
    snapshot?: SweepSnapshot;
    settled?: boolean;
};
export function GrowthStrip({ growth }: {
    growth: SweepSnapshot["growth"];
}) {
    return (<>
      {" "}
      {growth.length > 0 && (<div className="spin-growth" aria-label={_t("装備中の成長ギャンブル")}>
          {growth.map((g) => (<div key={g.id} className={`growth-item ${g.kind}`}>
              <strong>{g.name}</strong>
              <span>{_text(g.detail)}</span>
              <b>{_text(g.next)}</b>
            </div>))}
        </div>)}
    </>);
}
export function PayoffSweep({ values, frame, reduced, snapshot, style = "classic", motion = "classic", jackpotRule = "combined", jackpotHigh = false, signal, rollDisplay = "dice", }: {
    values: (number | null)[];
    frame: SweepFrame | null;
    reduced: boolean;
    snapshot?: SweepSnapshot;
    style?: "classic" | "chart" | "net";
    motion?: Settings["sweepMotion"];
    jackpotRule?: Settings["jackpotRule"];
    jackpotHigh?: boolean;
    signal?: SweepSignal;
    rollDisplay?: Settings["rollDisplay"];
}) {
    const [localSignal] = useState(createSweepSignal);
    const channel = signal ?? localSignal;
    const { cursor: animatedCursor, moving: sweeping, slowing } = useSweepReading(channel);
    useEffect(() => signal ? undefined : startSweep(frame, motion, reduced, localSignal.update), [frame, reduced, motion, signal, localSignal]);
    const current = framePending(frame, reduced)
        ? (frame?.snapshot ?? snapshot)
        : snapshot;
    const displayed = frame?.values ?? values;
    const bars = current?.bars ??
        displayed.map((v) => v === null ? null : { payout: Math.max(0, v), cost: Math.max(0, -v) });
    const scale = current?.scale ?? Math.max(1, ...displayed.map((v) => Math.abs(v ?? 0)));
    const growth = current?.growth ?? [];
    const cursor = signal ? animatedCursor : frame?.settled ? frame.roll : animatedCursor;
    const moving = !reduced && (signal ? sweeping : !frame?.settled && sweeping);
    const overflow = bars.some((v) => v && (v.payout > scale || v.cost > scale));
    const readout = <SweepReadout cursor={cursor} moving={moving} display={rollDisplay}/>;
    const ticks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const jackpotLabel = "JACKPOT";
    const anticipating = jackpotRule !== "hundred" && jackpotHigh;
    const jackpotPosition = anticipating ? 91 : 100;
    const highBand = jackpotRule !== "hundred" ? <span className={`jackpot-high-band ${jackpotHigh ? "armed" : ""}`} aria-hidden="true"/> : null;
    const describe = (i: number) => {
        const v = bars[i];
        return v === null
            ? _t("{0}: カット済み", i + 1) : current
            ? _t("{0}: 配当 {1} / 支払 {2} / 純損益 {3}", i + 1, money(v.payout), money(v.cost), money(v.payout - v.cost)) : `${i + 1}: ${money(displayed[i] ?? 0)}`;
    };
    return (<section className={`sweep-panel sweep-integrated ${anticipating ? "jackpot-ready" : ""} ${anticipating && moving ? "jackpot-suspense" : ""} ${growth.length ? "with-growth" : ""}`}>
      <GrowthStrip growth={growth}/>
      {style !== "chart" ? (<div className="classic-payoff">
          <div className={`payoff-reel ${moving ? "is-spinning" : ""} ${slowing ? "is-slowing" : ""} ${reduced ? "no-sweep-motion" : ""}`} role="img" aria-label={_t("出目1から100。青はプラス、赤はマイナス。同じ固定尺度の金額を表示。灰色はカット済み。{0}", overflow ? _t("山形は枠の上限を超えた金額。") : "")}>
            {readout}{highBand}
            <div className="payoff-grid-lines" aria-hidden="true">{Array.from({ length: 99 }, (_, i) => <span key={i} className={ticks.includes(i + 1) ? "major" : ""} style={{ left: `${i + .5}%` }}/>)}</div>
            <div className={style === "net" ? "payoff-reel-bars net-bars" : "payoff-reel-bars flow-bars"}>
              {bars.map((v, i) => (<i key={i} className={v === null ? "is-cut" : style === "net" ? (v.payout - v.cost >= 0 ? "net-profit" : "net-loss") : "flow-column"} style={style === "net" && v !== null ? { height: `${barFraction(Math.abs(v.payout - v.cost), scale) * 100}%` } : undefined} title={describe(i)}>
                  {v !== null && style !== "net" && (<>
                      <span className={`flow-payout ${v.payout > scale ? "clipped" : ""}`} style={{
                        height: `${barFraction(v.payout, scale) * 50}%`,
                    }}/>
                      <span className={`flow-cost ${v.cost > scale ? "clipped" : ""}`} style={{
                        height: `${barFraction(v.cost, scale) * 50}%`,
                    }}/>
                    </>)}
                </i>))}
            </div>
            <div className="payoff-cursor-track">
              <span className="classic-jackpot-line" style={{ left: `${jackpotPosition - .5}%`, right: "auto" }}>
                <span>{jackpotLabel}</span>
              </span>
              <span className="payoff-cursor" style={{ left: `${(cursor ?? 50) - 0.5}%` }}/>
            </div>
            <div className="payoff-scale" aria-hidden="true">{ticks.map(n => <span key={n} style={{ left: `${n - .5}%` }}>{n}</span>)}</div>
          </div>
        </div>) : (<div className={`payoff-sweep ${moving ? "sweeping" : ""} ${slowing ? "is-slowing" : ""}`}>
          {readout}{highBand}
          <span className="chart-jackpot-label" style={{ right: `calc(10px + ${100 - (12 + (jackpotPosition - .5) * 9.76) / 10}%)` }} aria-hidden="true">{jackpotLabel}</span>
          <svg viewBox="0 0 1000 180" preserveAspectRatio="none" role="img" aria-label={_t("出目1から100。青は配当、赤は支払。同じ固定尺度の金額バー。")}>
            {Array.from({ length: 99 }, (_, i) => <line key={`tick-${i}`} className={`sweep-vertical-tick ${ticks.includes(i + 1) ? "major" : ""}`} x1={12 + (i + .5) * 9.76} x2={12 + (i + .5) * 9.76} y1="7" y2="173" vectorEffect="non-scaling-stroke"/>)}
            {[45, 90, 135].map((y) => (<path key={y} d={`M12 ${y}H988`} className="sweep-grid"/>))}
            {bars.map((v, i) => {
                const ph = barFraction(v?.payout ?? 0, scale) * 78, ch = barFraction(v?.cost ?? 0, scale) * 78;
                return (<g key={i}>
                  <title>{describe(i)}</title>
                  {v === null ? (<rect x={12 + i * 9.76} y="88" width="7.5" height="4" fill="#38413b"/>) : (<>
                      <rect x={12 + i * 9.76} y={90 - ph} width="7.5" height={ph} fill="#70b8ff"/>
                      <rect x={12 + i * 9.76} y="90" width="7.5" height={ch} fill="#ff756e"/>
                      {v.payout > scale && (<path d={`M${12 + i * 9.76} 17l3.75 -5l3.75 5`} fill="none" stroke="#fff"/>)}
                      {v.cost > scale && (<path d={`M${12 + i * 9.76} 163l3.75 5l3.75 -5`} fill="none" stroke="#fff"/>)}
                    </>)}
                </g>);
            })}
            <line x1={12 + (jackpotPosition - .5) * 9.76} x2={12 + (jackpotPosition - .5) * 9.76} y1="7" y2="173" stroke="#ffd166" strokeWidth="2"/>
            {cursor !== null && (<line className="sweep-cursor" x1={12 + (cursor - 0.5) * 9.76} x2={12 + (cursor - 0.5) * 9.76} y1="7" y2="173"/>)}
          </svg>
          <div className="payoff-scale chart-scale" aria-hidden="true">{ticks.map(n => <span key={n} style={{ left: `${(12 + (n - .5) * 9.76) / 10}%` }}>{n}</span>)}</div>
        </div>)}
    </section>);
}
export function chartGeometry(s: Run, range: "recent" | "all" = "recent") {
    const time = !!s.trial || s.settings.chartAxis === "time";
    const raw = s.coinChartHold ?? s.history;
    const history = s.trial ? [...raw.map(p => ({ ...p, at: p.trialMs ?? Math.min(s.trial!.elapsedMs, p.at), cash: p.assets ?? p.cash })), { at: s.trial.elapsedMs, cash: s.trial.result?.finalBankroll ?? trialAssets(s), kind: "trial-current", spin: s.spins }] : raw;
    const eligible = time
        ? history
        : history.filter((p) => p.spin !== undefined);
    let recorded = eligible.length
        ? eligible
        : [{ at: 0, spin: 0, cash: 0, kind: "start" }];
    let windowStart: number | null = null;
    if (!s.trial && range === "recent" && s.spins > s.settings.chartWindowSpins) {
        const cutoff = s.spins - s.settings.chartWindowSpins;
        const first = recorded.findIndex((p) => p.spin !== undefined && p.spin >= cutoff);
        if (first >= 0) {
            recorded = recorded.slice(first);
            windowStart = cutoff;
        }
    }
    const lastPoint = recorded[recorded.length - 1];
    const upgradeDrop=(p:{spent?:number})=>s.trial?.scoring!=="cash"&&s.trial?0:p.spent??0;
    const peak = Math.max(100, ...recorded.map((p) => p.cash + upgradeDrop(p)));
    const unit = 10 ** Math.floor(Math.log10(peak));
    const ceiling = Math.ceil((peak * 1.55) / unit) * unit;
    const start = s.trial ? 0 : time ? recorded[0].at : (windowStart ?? recorded[0].spin ?? 0);
    const end = s.trial ? TRIAL_MS + s.trial.addedMs : time ? lastPoint.at : (lastPoint.spin ?? 0);
    const coords = recorded.map((p) => ({
        x: end === start
            ? 994
            : 6 +
                Math.min(1, Math.max(0, ((time ? p.at : (p.spin ?? 0)) - start) / (end - start))) *
                    988,
        y: 178 - Math.min(1, p.cash / ceiling) * 162,
    }));
    return {
        start,
        upgrades: recorded.flatMap((p, i) => p.kind === "upgrade"
            ? [
                {
                    ...coords[i],
                    cash: p.cash,
                    spent: upgradeDrop(p),
                    top: 178 - Math.min(1, (p.cash + upgradeDrop(p)) / ceiling) * 162,
                },
            ]
            : []),
        coins: recorded.flatMap((p, i) => p.coinCount && p.coinCount > 0 && Number.isFinite(p.coinProfit) ? [{ ...coords[i], cash: p.cash, profit: p.coinProfit!, count: p.coinCount }] : []),
        ceiling,
        end,
        coords,
        time,
        recordedPeak: Math.max(...recorded.map((p) => p.cash)),
        recordedCash: lastPoint.cash,
        points: coords.map((p) => `${p.x},${p.y}`).join(" "),
    };
}
export function WealthChart({ s, summary = false }: {
    s: Run;
    summary?: boolean;
}) {
    const fillId = useId();
    const [range, setRange] = useState<"recent" | "all">("recent");
    useEffect(() => setRange("recent"), [s.id, s.settings.chartWindowSpins]);
    const canExpand = !s.trial && !summary && s.spins > s.settings.chartWindowSpins;
    const { start, end, coords, points, time, recordedCash, upgrades, coins, ceiling } = chartGeometry(summary ? { ...s, coinChartHold: null } : s, summary ? "all" : canExpand ? range : "recent"), last = coords[coords.length - 1];
    return (<section className="wealth-chart">
      <div className="wealth-plot">
        {!summary && <ChartBackdrop s={s} recordedCash={recordedCash}/>}
        {canExpand && (<div className="chart-range-control" role="group" aria-label={_t("チャートの表示範囲")}>
            <button aria-pressed={range === "recent"} onClick={() => setRange("recent")}>{_t("直近{0}", s.settings.chartWindowSpins)}</button>
            <button aria-pressed={range === "all"} onClick={() => setRange("all")}>{_t("全体")}</button>
          </div>)}
        <svg viewBox="0 0 1000 194" preserveAspectRatio="none" role="img" aria-label={_t("総資産の推移。最新の記録{0}。横軸は{1}。黄色の中抜き丸は強化購入、金色の塗り丸はコインフリップの増減。", money(recordedCash), time ? _t("時間") : _t("スピン数"))}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#74f2a5" stopOpacity=".14"/>
              <stop offset="1" stopColor="#74f2a5" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (<g key={i}>
              <path className="chart-grid" d={`M6 ${178 - i * 40.5}H994 M${6 + i * 247} 16V178`}/>
            </g>))}
          <polygon points={`${coords[0].x},178 ${points} ${last.x},178`} fill={`url(#${fillId})`}/>
          <polyline points={points} fill="none" stroke="#74f2a5" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>
          <path d={`M${last.x} 16V178 M6 ${last.y}H994`} className="chart-crosshair"/>
          <circle cx={last.x} cy={last.y} r="3.5" fill="#bcf27c"/>
          {upgrades.map((p, i) => <g className="upgrade-marker-svg" key={i}><title>{_t("強化 −{0} · 購入後 {1}", money(p.spent), money(p.cash))}</title><path d={`M${p.x} ${p.top}V${p.y}`} className="upgrade-drop"/><path d={`M${p.x} ${p.y}h0.001`} stroke="#ffd166" strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><path d={`M${p.x} ${p.y}h0.001`} stroke="#292213" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></g>)}
          {s.settings.coinChartMarkers && coins.map((p, i) => <g className="coin-marker-svg" key={i}><title>{_t("コイン {0}{1} · {2}回 · 合流後 {3}", p.profit >= 0 ? "+" : "−", money(Math.abs(p.profit)), p.count, money(p.cash))}</title><path d={`M${p.x} ${p.y}h0.001`} stroke="#452b0c" strokeWidth="10" strokeLinecap="round" vectorEffect="non-scaling-stroke"/><path d={`M${p.x} ${p.y}h0.001`} stroke="#edbd62" strokeWidth="7" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></g>)}
        </svg>
        <div className="wealth-left-labels" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <span key={i} style={{ top: `${(178 - i * 40.5) / 194 * 100}%` }}>{money(ceiling * i / 4)}</span>)}</div>
        <div className="wealth-x-axis" aria-hidden="true">
          {(time ? [0, 2, 4] : [2, 4]).map((i) => (<span key={i} style={{
                left: `${(6 + i * 247) / 10}%`,
                transform: i === 0
                    ? "none"
                    : i === 4
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
            }}>
              {time
                ? duration(start + ((end - start) * i) / 4)
                : Math.round(start + ((end - start) * i) / 4).toLocaleString()}
            </span>))}
        </div>
      </div>
    </section>);
}
