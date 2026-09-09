import { t } from "./i18n";
import { money, trialAssets, type Run } from "./game/engine";
import { useMoneyStyle } from "./moneyPreferences";

/** Receives the presented run and published wallet change, never a hidden result. */
export function BalanceReadout({ s, amount, serial }: { s: Run; amount: number; serial: number }) {
  const style = useMoneyStyle();
  const total = money(s.trial ? trialAssets(s) : s.cash);
  const latest = (amount > 0 ? "+" : "") + money(amount);
  const goal = <span className="balance-goal">{s.trial ? "30 MIN CHALLENGE" : s.clearAt !== null ? "GOAL CLEARED" : t("クリア目標:{0}$", style === "full" ? "1,000,000,000" : "1B")}</span>;
  const change = <div className="balance-result" aria-label={`${t("最新の資産変化")}: ${latest}`}><div className={`pnl ${amount < 0 ? "negative" : "positive"}`} key={serial}>{latest}</div></div>;
  return <div className={`balance-money-line ${s.settings.balanceChangeInline ? "change-inline" : ""}`}>
    <h1 aria-label={`${t("総資産")}: ${total}`}>{total}</h1>
    {s.settings.balanceChangeInline ? <>{change}{goal}</> : <>{goal}{change}</>}
  </div>;
}
