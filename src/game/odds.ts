import { t as _t } from "../i18n";
import type { Bet } from "./catalog";
import { resolve, rollFloor, stakeOf, rollWeights, settlePortfolio, supportActive, finiteMoney, type Run } from "./engine";
export const fraction = (numerator: number, denominator = 100): string => {
    const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
    const d = gcd(numerator, denominator) || 1;
    return `${numerator / d}/${denominator / d}`;
};
// The raw draw faces are equally likely. Multiple raw faces may map to 100.
export function betOdds(s: Run, b: Bet) {
    const weights = rollWeights(s), denominator = 101 - rollFloor(s), stake = stakeOf(b, s);
    const outcomes = weights.map((weight, i) => {
        if (!weight)
            return null;
        const settled = settlePortfolio(s, i + 1), row = settled.rows.find(row => row.id === b.id);
        const result = row?.result ?? resolve(s, b, i + 1);
        const payout = row || ["support", "work-income", "roll-shift"].includes(b.pattern) ? result.payout : finiteMoney(result.payout * settled.boost);
        const hit = b.pattern === "support" ? supportActive(s, b, i + 1) : payout > 0;
        return { hit, win: b.pattern === "support" ? hit : payout - result.penalty > stake, payout, penalty: result.penalty };
    });
    const hitProbability = outcomes.reduce((n, o, i) => n + (o?.hit ? weights[i] : 0), 0);
    const winProbability = outcomes.reduce((n, o, i) => n + (o?.win ? weights[i] : 0), 0);
    const expectedPayout = outcomes.reduce((n, o, i) => n + (o?.payout ?? 0) * weights[i], 0);
    const expectedPenalty = outcomes.reduce((n, o, i) => n + (o?.penalty ?? 0) * weights[i], 0);
    const payouts = [...new Set(outcomes.filter(o => o && o.payout > 0).map(o => o!.payout))];
    return { outcomes, hit: Number((hitProbability * 100).toFixed(10)), win: Number((winProbability * 100).toFixed(10)),
        hitFraction: fraction(Math.round(hitProbability * denominator), denominator),
        winFraction: fraction(Math.round(winProbability * denominator), denominator),
        expectedPayout, expectedPenalty, expectedNet: expectedPayout - stake - expectedPenalty,
        averagePayout: hitProbability > 0 ? expectedPayout / hitProbability : 0,
        multiplier: stake > 0 && hitProbability > 0 ? expectedPayout / hitProbability / stake : 0,
        variable: payouts.length > 1,
    };
}
export const percent = (n: number) => `${Number(n.toFixed(1))}%`;
export function hitFacesText(outcomes: ReturnType<typeof betOdds>["outcomes"]): string {
    const faces = outcomes.flatMap((outcome, i) => outcome?.hit ? [i + 1] : []);
    if (!faces.length)
        return _t("なし");
    if (faces.length > 2 && faces.every((n, i) => i === 0 || n === faces[i - 1] + 2))
        return `${faces[0] % 2 ? _t("奇数") : _t("偶数")} (${faces[0]}-${faces.at(-1)})`;
    const groups: number[][] = [];
    for (const n of faces) {
        const last = groups.at(-1);
        if (last && n === last[1] + 1)
            last[1] = n;
        else
            groups.push([n, n]);
    }
    return groups.map(([a, b]) => a === b ? String(a) : `${a}-${b}`).join("・");
}
