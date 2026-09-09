import { t as _t } from "../i18n";
import { betById } from "./catalog";
import { expandedMatch, finiteMoney, settlePortfolio, rollWeights, mem, money, resolve, rollFloor, stakeOf, type Run, } from "./engine";
export interface SweepBar {
    payout: number;
    cost: number;
}
export interface GrowthStatus {
    id: string;
    name: string;
    detail: string;
    next: string;
    kind: "wins" | "losses";
}
export interface SweepSnapshot {
    bars: (SweepBar | null)[];
    scale: number;
    growth: GrowthStatus[];
}
function amounts(s: Run, roll: number): SweepBar {
    const result = settlePortfolio(s, roll);
    return { payout: result.payout, cost: result.cost };
}
export function sweepSnapshot(s: Run): SweepSnapshot {
    // The unevolved portfolio defines the unit. Wins, losses and Jackpot never zoom it.
    const baseline: Run = {
        ...s,
        memory: {},
        fuel: 1500,
        rushLeft: 0,
        removed: 0,
    };
    const baseStake = baseline.portfolio.reduce((sum, r) => sum + stakeOf(betById(r.id), baseline) * r.count, 0);
    const initial = Array.from({ length: 100 }, (_, i) => amounts(baseline, i + 1));
    const scale = Math.max(1, baseStake * 4, ...initial.flatMap((v) => [v.payout * 1.25, v.cost * 1.25]));
    const growth = s.portfolio.flatMap((row) => {
        const b = betById(row.id), m = mem(s, b.id);
        if (b.pattern === "support")
            return [{ id: b.id, name: b.name, kind: "wins" as const, detail: s.settings.probabilityUpgrades && (s.betLevels[b.id] ?? 0) > 0 ? (m.armed ? _t("次の発動確率を強化中") : _t("チャンスの確率を強化中")) : m.armed ? _t("次に{0}以上で発動", b.second?.[0]) : _t("{0}以上で次のスピンにチャンス", b.first?.[0]), next: _t("他の当たり ×{0}", b.multiplier) }];
        if (b.pattern === "roll-shift")
            return [{ id: b.id, name: b.name, kind: "wins" as const, detail: _t("あと{0}スピンで補正", (b.target ?? 5) - s.spins % (b.target ?? 5)), next: _t("共通の出目 +{0} · 上限100", (b.effect ?? 10) * row.count) }];
        if (b.pattern !== "ladder" && b.pattern !== "loss-ladder")
            return [];
        const low = rollFloor(s), probability = rollWeights(s).reduce((sum, w, i) => sum + (expandedMatch(s, b, i + 1, face => face >= b.start) ? w : 0), 0) * 100;
        const payout = finiteMoney(resolve(s, b, Math.max(low, b.start)).payout * row.count);
        return [
            {
                id: b.id,
                name: b.name,
                kind: b.pattern === "ladder" ? ("wins" as const) : ("losses" as const),
                detail: b.pattern === "ladder"
                    ? _t("継続{0}% · {1}連勝 · 当たるたび×{2}", Math.round(probability), m.streak, b.multiplier) : _t("{0}連敗 · 外すたび次の賭け金×{1}（最大32倍）", m.misses, b.multiplier),
                next: b.pattern === "ladder"
                    ? _t("次の配当 {0}", money(payout)) : _t("次の賭け金 {0} · 当たりで戻る", money(stakeOf(b, s) * row.count)),
            },
        ];
    });
    return {
        scale,
        growth,
        bars: Array.from({ length: 100 }, (_, i) => rollWeights(s)[i] === 0 ? null : amounts(s, i + 1)),
    };
}
export const barFraction = (value: number, scale: number) => Math.min(1, Math.max(0, value / Math.max(1, scale)));
export const framePending = (frame: {
    at: number;
    duration: number;
} | null, reduced: boolean, now = Date.now()) => !!frame && !reduced && now < frame.at + frame.duration;
