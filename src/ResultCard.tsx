import { t as _t } from "./i18n";
import { catalogById } from "./game/catalog";
import { duration, money, VERSION, type Run } from "./game/engine";
import { completionTarget } from "./rankingOutbox";
import { WealthChart } from "./TradingViews";
export function clearCardRun(s: Run): Run {
    const spins = s.clearSpins ?? s.spins, activeMs = s.clearActiveMs ?? s.activeMs;
    if (s.clearSnapshot)
        return { ...s, coinChartHold: null, ...s.clearSnapshot, spins, activeMs, history: s.clearSnapshot.history.map(p => ({ ...p })), settings: { ...s.settings, chartAxis: "spins" } };
    const history = s.history.filter(p => (p.spin ?? 0) <= spins && p.at <= activeMs).map(p => ({ ...p }));
    const target = completionTarget(s), last = history[history.length - 1];
    // WORK can also clear the game between spins, so explicitly include that landing.
    if (!last || last.cash < target)
        history.push({ spin: spins, at: activeMs, cash: target, kind: "clear" });
    return { ...s, coinChartHold: null, spins, activeMs, history, cash: history[history.length - 1].cash, settings: { ...s.settings, chartAxis: "spins" } };
}
export function effortStats(s:Run) {
    const known=!!s.trial || s.clearAt===null || !!s.clearSnapshot && s.clearSnapshot.work!==undefined;
    return {work:known?s.work.toLocaleString():"—",wager:known?money(s.coinWagered):"—",profit:known?(s.coinPaid>=s.coinWagered?"+":"")+money(s.coinPaid-s.coinWagered):"—",known};
}
export function ResultCard({ s, name }: {
    s: Run;
    name: string;
}) {
    const effort=effortStats(s);
    return <section className="result-card" aria-label={_t("クリア記念カード")}>
    <div className="result-brand"><img src="/icons/dontwork.svg" alt="" width="34" height="34"/><strong>dontwork.fun</strong><span>GOAL CLEARED</span></div>
    <div className="result-hero"><span>FROM $0 TO</span><h3>{money(completionTarget(s))}<i>↗</i></h3><p>{name || "YOU MADE IT"}</p></div>
    <div className="result-time"><strong>{duration(s.completion?.timeMs ?? s.clearActiveMs ?? s.activeMs)}</strong><span>{_t("クリア時間")}</span></div>
    <WealthChart s={s} summary/>
    <div className="result-numbers"><div><b>{(s.clearSpins ?? s.spins).toLocaleString()}</b><span>{_t("スピン")}</span></div><div><b>{s.maxChain.toLocaleString()}</b><span>{_t("最大連鎖")}</span></div><div><b>{money(s.spent)}</b><span>{_t("強化への投資")}</span></div></div>
    <div className="result-numbers result-effort"><div><b>{effort.work}</b><span>{effort.known?_t("WORK回数 · {0}", money(s.work)):_t("WORK回数")}</span></div><div><b>{effort.wager}</b><span>{_t("FLIPの賭け金累計")}</span></div><div><b>{effort.profit}</b><span>{_t("FLIPの損益")}</span></div></div>
    <footer><span>{catalogById(s.completion?.catalog ?? s.catalog).name}</span><span>{s.completion?.ranked ? "CLEAR RECORD" : "LAB RECORD"} · v{s.completion?.appVersion ?? VERSION}</span></footer>
  </section>;
}
