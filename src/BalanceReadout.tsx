import { t } from "./i18n";
import { money, finiteMoney, type Run } from "./game/engine";
import { useMoneyStyle } from "./moneyPreferences";

/** Receives the presented run and published wallet change, never a hidden result. */
export function BalanceReadout({ s, amount, serial }: { s: Run; amount: number; serial: number }) {
  const style = useMoneyStyle();
  const cash = money(s.cash);
  const assets = s.trial ? money(finiteMoney(s.cash + s.spent)) : null;
  const latest = (amount > 0 ? "+" : "") + money(amount);
  const goal = <span className="balance-goal">{s.trial ? t("30分モード") : s.clearAt !== null ? "GOAL CLEARED" : t("クリア目標:{0}$", style === "full" ? "1,000,000,000" : "1B")}</span>;
  const summary = <>{assets !== null && <span className="balance-trial-assets" aria-label={`${t("総資産")}: ${assets}`}><small>{t("総資産")}</small><strong>{assets}</strong></span>}{goal}</>;
  const change = <div className="balance-result" aria-label={`${t("最新の資産変化")}: ${latest}`}><div className={`pnl ${amount < 0 ? "negative" : "positive"}`} key={serial}>{latest}</div></div>;
  return <div className={`balance-money-line ${s.trial ? "trial-balance" : ""} ${s.settings.balanceChangeInline ? "change-inline" : ""}`}>
    <h1 aria-label={`${t(s.trial ? "現金" : "総資産")}: ${cash}`}>{cash}</h1>
    {s.settings.balanceChangeInline ? <>{change}{summary}</> : <>{summary}{change}</>}
  </div>;
}
