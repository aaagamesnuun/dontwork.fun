import { t as _t } from "../i18n";
import { availableBets, firstBet, isInfinite, money, stakeOf, status, totalCost, unlocked, UPGRADES, upgradePrice, upgradeUnlocked, upgradeDrawPrice, type Upgrade, type Run, } from "./engine";
import { betById } from "./catalog";
export type GuideTarget = "work" | "positions" | "equip" | "spin" | "auto" | "upgrades" | "purchase" | null;
export interface Guidance {
    key: string;
    label: string;
    text: string;
    target: GuideTarget;
    urgent: boolean;
    upgrade?: Upgrade | "gacha";
}
export const visibleBets = (s: Run) => availableBets(s).filter((b) => unlocked(s, b));
export function jackpotCondition(rule: Run["settings"]["jackpotRule"]) {
    return rule === "combined" ? _t("100、または91以上が2回連続でジャックポット。") :
        rule === "double-high" ? _t("91以上が2回連続でジャックポット。90以下でリセット。") : _t("100が出るとジャックポット。");
}
export function unlockedSince(before: Run, after: Run) {
    if (before.id !== after.id || before.catalog !== after.catalog)
        return [];
    const previous = new Set(visibleBets(before).map((b) => b.id));
    return visibleBets(after).filter((b) => !previous.has(b.id));
}
export function guidance(s: Run, tick = 0, tab: "spin" | "positions" | "upgrades" = "spin"): Guidance {
    const result = (key: string, text: string, target: GuideTarget = null, label = "NEXT MOVE", urgent = target !== null): Guidance => ({ key, text, target, label, urgent });
    if (s.trial?.paused)
        return result("trial", s.trial.result ? _t("30分終了。上の「結果を見る」から記録とランキングへ。") : !s.trial.started ? _t("AUTOをONにして30分スタート。まずはWORKで資金を作ろう。") : _t("ポーズ中。ポジションの入れ替え・強化はできます。AUTOをONにすると時計もスピンも再開。"), null, "30 MIN", false);
    const desk = s.settings.workspaceMode === "desk";
    if (desk && tab === "spin")
        tab = "positions";
    const opening = stakeOf(betById(firstBet(s)), s), current = status(s);
    if (s.settings.workMode === "gamble" && (current === "empty" || current === "cash"))
        return result("work-gamble", tab === "positions" ? _t("賭け金が足りないときは、他を外してWORKをセット。コスト$0で毎スピン$5増える。") : _t("「ポジション」でWORKをセットしよう。コスト$0で毎スピン$5稼げる。"), tab === "positions" ? "equip" : "positions");
    if (s.spins === 0 && s.cash < opening)
        return result("first-work", _t("まずWORKを連打して{0}貯めよう。1回で$1増える。", money(opening)), "work");
    if (current === "empty")
        return result("equip", s.spins === 0 ? (tab === "positions" ? _t("{0}の＋を押して、最初のポジションをセットしよう。",betById(firstBet(s)).name) : _t("「ポジション」タブを開いて、最初のギャンブルを選ぼう。")) : _t("ポジションをセットしよう。"), tab === "positions" ? "equip" : "positions");
    if (current === "cash") {
        const minimum = Math.min(...visibleBets(s).map((b) => stakeOf(b, s)));
        const cheaper = visibleBets(s).some((b) => stakeOf(b, s) <= s.cash && stakeOf(b, s) < totalCost(s));
        return cheaper
            ? result("cheaper", _t("賭け金が足りない。「ポジション」で安いギャンブルに替えるか、セットする数を減らそう。"), "positions")
            : minimum < totalCost(s)
                ? result("recover-cheaper", _t("WORKであと{0}貯めると、安いギャンブルに替えて再開できる。", money(Math.max(0, minimum - s.cash))), "work")
                : result("cash", _t("賭け金が足りない。WORKで補充しよう。あと{0}で回せる。", money(Math.max(0, totalCost(s) - s.cash))), "work");
    }
    if (current === "fuel")
        return result("fuel", _t("スピン容量が空。WORKを押して補充しよう。{0}", s.running ? _t("補充するとAUTOが再開する。") : _t("補充してからAUTOをONにしよう。")), "work");
    if (!desk && s.spins === 0 && !s.running && tab !== "spin")
        return result("first-spin-tab", _t("セットできた！ 「チャート」タブを押して、資産の動きを見よう。"), "spin");
    if (s.rushLeft > 0)
        return result("jackpot", _t("{0}連鎖 · 残り{1}スピン{2}", s.chain, isInfinite(s) ? "∞" : s.rushLeft, !s.running ? _t(" · AUTOで再開") : ""), null, "JACKPOT", false);
    if (!s.running)
        return result("auto", s.rushLeft > 0
            ? _t("{0}が待機中。AUTOをONにして再開しよう。", isInfinite(s) ? "INFINITY JACKPOT" : "JACKPOT") : s.spins === 0
            ? _t("準備完了。AUTOをONにすると、セットしたギャンブルが自動で回る。") : _t("AUTOが停止中。ONにするとスピンを再開できる。"), "auto");
    if (s.jackpotHigh && s.settings.jackpotRule !== "hundred")
        return result("jackpot-ready", _t("91以上が出た！ 次も91以上ならジャックポット。90以下でリセット。"), null, "JACKPOT", false);
    if (s.jackpots > 0 && s.spinsSinceJackpot !== null && s.spinsSinceJackpot <= 3)
        return result("jackpot-recap", jackpotCondition(s.settings.jackpotRule), null, "JACKPOT", false);
    if (s.spent === 0 && s.spins > 0 && (s.settings.upgradeTutorial === "scripted" ? s.spins >= 5 : s.peak >= 100)) {
        const upgrade = s.settings.upgradeMode === "gacha" ? "gacha" :
            (["speed", ...UPGRADES.filter(u => u !== "speed")] as Upgrade[]).find(u => upgradeUnlocked(s, u) && upgradePrice(s, u) !== null);
        const price = upgrade === "gacha" ? upgradeDrawPrice(s) : upgrade ? upgradePrice(s, upgrade) : null;
        if (upgrade && price !== null) {
            const action = upgrade === "speed" ? _t("「スピン周期」を強化して、スピンを速くしよう。") :
                upgrade === "gacha" ? _t("強化ガチャを引いて、最初のアップグレードを手に入れよう。") : _t("光っている強化を購入しよう。");
            return { ...result("first-upgrade", tab === "upgrades" ? (s.cash >= price ? action : _t("あと{0}で{1}。AUTOで貯めよう。", money(price - s.cash), upgrade === "speed" ? _t("スピン周期を強化できる") : upgrade === "gacha" ? _t("強化ガチャを引ける") : _t("最初の強化を購入できる"))) :
                    upgrade === "speed" ? desk ? _t("WORKとAUTOの間の「アップグレード」を開いて、スピン周期を強化しよう。") : _t("「アップグレード」を開いて、まずスピン周期を強化しよう。") : desk ? _t("WORKとAUTOの間の「アップグレード」を開こう。") : _t("「アップグレード」を開いて、最初の強化を試そう。"), tab !== "upgrades" ? "upgrades" : s.cash >= price ? "purchase" : null), upgrade };
        }
    }
    const next = availableBets(s)
        .filter((b) => !unlocked(s, b))
        .sort((a, b) => a.unlock - b.unlock)[0];
    if (s.jackpots === 0 && s.spins >= 5 && s.spins < 10)
        return result("jackpot-intro", jackpotCondition(s.settings.jackpotRule), null, "JACKPOT", false);
    if (next && tick % 2 === 0)
        return result("goal", _t("次の目標は総資産{0}。到達すると、新しいギャンブルが使える。", money(next.unlock)), null, "GOAL", false);
    const tips = [
        s.settings.payoffStyle === "net" ? _t("青い箱は利益、赤い箱は損失。箱の大きさが金額を表している。") : _t("青い棒は配当、赤い棒は支払い。配当が支払いを超えると資産が増える。"),
        desk ? _t("下の「アップグレード」でスピン周期を短くできる。強化した効果はずっと残る。") : _t("「アップグレード」でスピン周期を短くできる。強化した効果はずっと残る。"),
        _t("同じギャンブルを重ねると、賭け金と配当もその数だけ増える。"),
        s.settings.jackpotRule === "combined" ? _t("100、または91以上が2回連続でJackpot。カット量を強化すると、連鎖中は低い出目をカット。") : s.settings.jackpotRule === "double-high" ? _t("91以上を2回連続で引くとJackpot。") : _t("100が出るとJackpot。カット量を強化すると、連鎖中の低い出目が減る。"),
        _t("ギャンブルの付け外しは無料。スピン中の変更は次のスピンから反映。"),
    ];
    const index = (next ? Math.floor(tick / 2) : tick) %
        Math.min(tips.length, s.spins < 10 ? 2 : tips.length);
    return result(`tip-${index}`, tips[index], null, "TIP", false);
}
