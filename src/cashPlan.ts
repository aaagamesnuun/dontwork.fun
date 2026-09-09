// Monetary bookkeeping stays independent of intensity, streaks and motion.
// A token can represent a bundle, keeping both pending work and DOM size bounded.
export const CASH_DENOMINATIONS = [100_000_000, 100_000, 10_000, 1_000, 100, 1] as const;
export type CashDenomination = (typeof CASH_DENOMINATIONS)[number]; // cents
export type CashToken = { denomination: CashDenomination; units: bigint };
export const MAX_CASH_TOKENS = 64;

export function cashCents(amount: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const value = Math.min(amount, 1e200);
  // Beyond cent-precise numbers, ignore floating-point dust in the small coins.
  return value > Number.MAX_SAFE_INTEGER / 100
    ? BigInt(Math.round(value / 1e6)) * 100_000_000n
    : BigInt(Math.round(value * 100));
}

export const tokenCents = (token: CashToken) => BigInt(token.denomination) * token.units;

export function compactCash(tokens: readonly CashToken[]): CashToken[] {
  const counts = new Map<CashDenomination, bigint>();
  for (const token of tokens) {
    if (token.units > 0n) counts.set(token.denomination, (counts.get(token.denomination) ?? 0n) + token.units);
  }
  const groups = CASH_DENOMINATIONS.filter(d => counts.has(d));
  const result: CashToken[] = [];
  for (const [index, denomination] of groups.entries()) {
    const units = counts.get(denomination)!;
    const available = MAX_CASH_TOKENS - result.length - (groups.length - index - 1);
    const slots = Number(units < BigInt(available) ? units : BigInt(available));
    const each = units / BigInt(slots), extra = units % BigInt(slots);
    for (let i = 0; i < slots; i++) result.push({ denomination, units: each + (BigInt(i) < extra ? 1n : 0n) });
  }
  return result;
}

export function cashRainPlan(amount = 0, coinsOnly = false) {
  const totalCents = cashCents(amount);
  let remaining = totalCents;
  const groups: CashToken[] = [];
  const largest = amount < 100 ? totalCents : totalCents / 10n;
  for (const denomination of CASH_DENOMINATIONS) {
    if (coinsOnly && denomination > 100) continue;
    if (BigInt(denomination) > largest && denomination !== 1) continue;
    const units = remaining / BigInt(denomination);
    if (units > 0n) groups.push({ denomination, units });
    remaining %= BigInt(denomination);
  }
  const tokens = compactCash(groups);
  return { tokens, totalCents, notes: tokens.length, tier: amount >= 1e8 ? 2 : amount >= 1e7 ? 1 : 0 };
}
