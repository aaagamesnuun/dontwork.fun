import { useEffect, useRef, useState, type CSSProperties } from "react";
import { GAME_LOOKS, lookEnergy, type GameLook } from "./gameLooks";
import { t, useLanguage } from "./i18n";
import { interval, money, type Run, type Outcome } from "./game/engine";

export function LookPicker({ value, onChange }: { value: GameLook; onChange: (look: GameLook) => void }) {
  const lang = useLanguage();
  return <section className="look-picker" aria-labelledby="look-picker-title">
    <div className="look-picker-heading"><span>ART DIRECTION / 01—07</span><h3 id="look-picker-title">{t("ルックを変える")}</h3>
      <p>{t("見た目と動きだけを切り替えます。進行・ルール・ランキング資格はそのまま。")}</p></div>
    <div className="look-options" role="group" aria-label={t("ゲームのルック")}>
      {GAME_LOOKS.map(look => <button key={look.id} type="button" className={`look-option look-option-${look.id}`} aria-pressed={value === look.id} onClick={() => onChange(look.id)}>
        <span className="look-sample" aria-hidden="true"><span className="look-sample-label">{look.id === "broadcast" ? "DW / LIVE" : look.id === "desktop" ? "ASSETS.EXE" : look.tagline}</span><b>$128,450</b><span className="look-sample-bars">{[12, 20, 14, 29, 21, 38, 31, 48, 35, 61, 44, 76].map((v, i) => <i key={i} style={{ height: `${v}%` }}/>)}</span><span className="look-sample-footer">{look.number} <span>WORK ↗</span></span></span>
        <span className="look-option-title"><em>{look.number}</em><strong>{lang === "en" ? look.en : look.name}</strong><span className="look-choice" aria-hidden="true">{value === look.id ? "✓" : "+"}</span></span>
        <small>{t(look.description)}</small>
      </button>)}
    </div>
    <p className="look-current" role="status">{t("選択中: {0}", lang === "en" ? GAME_LOOKS.find(x => x.id === value)?.en : GAME_LOOKS.find(x => x.id === value)?.name)}</p>
  </section>;
}

/** All inputs come from presentedRun. Never accept raw pending outcomes here. */
export function LookHeading({ s }: { s: Run }) {
  const look = s.settings.look;
  if (look === "classic") return null;
  const captions: Record<Exclude<GameLook, "classic">, [string, string]> = {
    receipt: ["DONTWORK / ACCOUNT RECEIPT", t("合計")],
    instrument: ["DW—01 / INCOME INSTRUMENT", "CASH / USD"],
    typography: ["NO WORK. ALL CAPITAL.", t("現在の資産")],
    desktop: ["MY COMPUTER / ASSETS", "ACCOUNT.EXE"],
    broadcast: ["DW FINANCIAL / PERSONAL EDITION", t("あなたの資産、放送中。")],
    collage: ["DONTWORK / FINANCIAL ASSEMBLY", t("本日の持ち分")],
    futures: ["THE BOOK OF 100 FUTURES", t("いま、ここにある資産")],
  };
  return <div className="look-heading"><span>{captions[look][0]}</span><strong>{captions[look][1]}</strong><span className="look-status">{look === "broadcast" ? <><i/>{s.running ? "LIVE" : "STANDBY"}</> : look === "receipt" ? `WORK × ${s.work.toLocaleString()}` : look === "desktop" ? "● SYSTEM ONLINE" : look === "futures" ? "01 — 100" : "USD"}</span></div>;
}

export function LookPanelLabel({ look, panel }: { look: GameLook; panel: "sweep" | "chart" }) {
  if (look === "classic") return null;
  const names: Record<Exclude<GameLook, "classic">, [string, string]> = {
    receipt: ["01 / TRANSACTION", "02 / ACCOUNT HISTORY"],
    instrument: ["SCAN / 1—100", "SIGNAL / CAPITAL"],
    typography: ["01. THE ODDS", "02. THE MONEY"],
    desktop: ["OUTCOME.EXE", "ASSETS.LOG"],
    broadcast: ["MARKET WATCH", "YOUR PORTFOLIO / LIVE"],
    collage: ["EXHIBIT A / CHANCE", "EXHIBIT B / CAPITAL"],
    futures: ["100 FUTURES / UNFOLD ONE", "THE PATH YOU TOOK"],
  };
  return <div className={`look-panel-label look-panel-${panel}`} aria-hidden="true"><span>{names[look][panel === "sweep" ? 0 : 1]}</span><i>{look === "desktop" ? "− □ ×" : look === "instrument" ? "●" : "↗"}</i></div>;
}

type Reveal = { outcome: Outcome; key: number; identity: string };
export function LookReaction({ s, pending, reduced }: { s: Run; pending: boolean; reduced: boolean }) {
  const identity = `${s.id}:${s.settings.look}`;
  const previous = useRef({ identity, id: s.last?.id, work: s.work });
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [workPulse, setWorkPulse] = useState(0);
  useEffect(() => {
    const before = previous.current;
    previous.current = { identity, id: s.last?.id, work: s.work };
    if (before.identity !== identity) { setReveal(null); setWorkPulse(0); return; }
    if (typeof document !== "undefined" && document.hidden) return;
    if (s.work > before.work) setWorkPulse(s.work);
    if (!pending && s.last && s.last.id !== before.id) setReveal(old => old?.identity === identity && old.outcome.jackpot && !s.last!.jackpot ? old : { outcome: s.last!, key: s.last!.id, identity });
  }, [identity, s.last, s.work, pending]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { setReveal(null); setWorkPulse(0); } };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (!reveal) return;
    const timer = setTimeout(() => setReveal(null), reveal.outcome.jackpot ? 2400 : Math.min(900, Math.max(180, interval(s) * .62)));
    return () => clearTimeout(timer);
  }, [reveal]);
  useEffect(() => {
    if (!workPulse) return;
    const timer = setTimeout(() => setWorkPulse(0), 650);
    return () => clearTimeout(timer);
  }, [workPulse]);
  if (s.settings.look === "classic") return null;
  const outcome = reveal?.identity === identity ? reveal.outcome : undefined;
  const headline = outcome?.jackpot ? "JACKPOT" : outcome && outcome.profit > 0 ? "PROFIT" : "SETTLED";
  return <div className={`look-reactions ${reduced ? "look-motion-reduced" : ""}`} aria-hidden="true">
    {workPulse > 0 && <div key={`w${workPulse}`} className="look-work-ticket"><span>{s.settings.look === "desktop" ? "work.exe" : s.settings.look === "instrument" ? "INPUT RECEIVED" : "WORK RECORDED"}</span><b>×{workPulse.toLocaleString()}</b></div>}
    {outcome && <div key={outcome.id} className={`look-reveal ${outcome.jackpot ? "look-jackpot" : outcome.profit > 0 ? "look-profit" : "look-loss"}`} style={{ "--look-energy": lookEnergy(outcome.profit, outcome.wager), "--look-roll": outcome.roll } as CSSProperties}>
      <small>{s.settings.look === "broadcast" ? outcome.jackpot ? "BREAKING NEWS" : "MARKET UPDATE" : s.settings.look === "receipt" ? "TRANSACTION COMPLETED" : s.settings.look === "desktop" ? "SYSTEM MESSAGE" : s.settings.look === "futures" ? "ONE FUTURE, NOW PRESENT" : "DONTWORK / SETTLEMENT"}</small>
      <strong>{headline}</strong><b>{outcome.profit > 0 ? "+" : ""}{money(outcome.profit)}</b><span>{String(outcome.roll).padStart(2, "0")} <em>/ 100</em></span>
    </div>}
  </div>;
}

/** Ten visible folds retain 100 equal-width outcomes; only published rolls open. */
export function FutureFolds({ revealedRoll, pending }: { revealedRoll: number | null; pending: boolean }) {
  const roll = pending ? null : revealedRoll;
  return <div className="future-folds" aria-hidden="true" data-open-face={roll ?? undefined}>
    {Array.from({ length: 10 }, (_, i) => <div key={i} className={`future-fold ${roll !== null && Math.floor((roll - 1) / 10) === i ? "future-open" : ""}`}><span>{String(i * 10 + 1).padStart(2, "0")}—{(i + 1) * 10}</span></div>)}
    {roll !== null && <i className="future-selected" style={{ left: `${roll - 1}%` }}/>} 
  </div>;
}
