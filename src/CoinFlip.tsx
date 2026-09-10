import { t as _t } from "./i18n";
import { COIN_STAKES, COIN_UNLOCK_PEAK, money, coinUnlocked, type Run } from "./game/engine";
import { NativeSwitch } from "./NativeSwitch";
export type DockPanel = "spin" | "positions" | "upgrades" | "coin";
export const nextDockPanel = (panel: DockPanel, unlocked: boolean): DockPanel => panel === "upgrades" ? "positions" : panel === "positions" && unlocked ? "coin" : "upgrades";
export const dockLabel = (panel: DockPanel) => panel === "upgrades" ? _t("アップグレード") : panel === "coin" ? _t("コインフリップ") : _t("ギャンブル");
export function CoinFlip({ s, budget, onChange, result = s.coinResult }: {
    s: Run;
    budget: number;
    result?: Run["coinResult"];
    onChange: (patch: Pick<Run, "coinEnabled"> | Pick<Run, "coinStake">) => void;
}) {
    if (!s.settings.coinFlip) return null;
    return <section className="coin-panel" aria-label={_t("コインフリップ")}>
    {!coinUnlocked(s) ? <p className="coin-locked">{_t("最高資産が{0}を超えるとコインフリップ解禁", money(COIN_UNLOCK_PEAK))}</p> : <>
    <div className="workspace-heading"><h2>{_t("コインフリップ")}</h2><label className="setting-row coin-switch"><span>{_t("WORKをFLIPにする")}</span><NativeSwitch label={_t("FLIPを有効にする")} checked={s.coinEnabled} onChange={coinEnabled => onChange({ coinEnabled })} tactile={s.settings.haptics}/></label></div>
    <div className="coin-stakes" role="group" aria-label={_t("コインの賭け金")}>{COIN_STAKES.map(wager => <button key={wager} aria-pressed={s.coinStake === wager} className={s.coinStake === wager ? "selected" : ""} onClick={() => onChange({ coinStake: wager })}>{money(wager).replace("$", "")}</button>)}</div>
    <div className="coin-summary"><strong>{money(s.coinStake)}</strong><span>{_t("当たり")}{money(s.coinStake * 2)}<small>{_t("1/2で2倍 · ハズレは0")}</small></span><output className={result?.won ? "positive" : "negative"} aria-live="polite">{result ? `${result.won ? "+" : ""}${money(result.profit)}` : "—"}</output></div>
    {budget < s.coinStake && <p className="setting-note">{_t("賭け金が足りません。金額を下げるか、WORKで稼ごう。")}</p>}
    </>}
  </section>;
}
