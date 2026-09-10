import { t } from "./i18n";
import { isInfinite, rollFloor, type Run } from "./game/engine";
import { guidance, jackpotCondition, type Guidance } from "./game/guidance";

export function JackpotNews({ s, tick, guide = guidance(s, tick) }: { s: Run; tick: number; guide?: Guidance }) {
  const explanation = guide.key !== "jackpot" ? guide.text : s.chain <= 1 || tick % 2 === 0
    ? jackpotCondition(s.settings.jackpotRule)
    : t("再発動すると残り回数を最大まで補充。連鎖が続く！");
  return <div className="jackpot-news-body">
    <p className="rush-remaining"><strong>{isInfinite(s) ? "∞" : s.rushLeft.toLocaleString()}</strong><span>{t("スピン残り")}</span><small><span>{t("{0}連鎖{1}", s.chain, s.running ? "" : s.trial ? t(" · 砂時計で再開") : s.settings.autoAlwaysOn ? t(" · 停止中") : t(" · AUTOで再開"))}</span><span>{rollFloor(s) > 1 ? t("1〜{0}をカット", rollFloor(s) - 1) : t("カットなし")}</span></small></p>
    <p className="jackpot-news-rule">{explanation}</p>
  </div>;
}
