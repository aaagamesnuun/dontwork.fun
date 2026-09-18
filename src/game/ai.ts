import { availableBets, canSpin, defaultSettings, ECONOMY_REVISION, endUnfundedJackpot, freshRun, interval, mem, purchase, setCount, spin, stakeOf, payoutOf, totalCost, unlocked, upgradePrice, upgradeUnlocked, UPGRADES, work, type Run, type Upgrade } from "./engine";

export const AI_RULESET = `ai-v1-astra-${ECONOMY_REVISION}`;
export const AI_WORKS_PER_SECOND = 5;
export const AI_WORK_INTERVAL = 1000 / AI_WORKS_PER_SECOND;
export interface AiAction {
  version: number;
  type: "work" | "spin" | "equip" | "upgrade" | "strategy";
  betId?: string;
  delta?: number;
  upgrade?: Upgrade;
  text?: string;
  reason?: string;
}
export class AiActionError extends Error {
  constructor(public code: string, public status = 400, public retryAfterMs = 0) { super(code); }
}
export function newAiRun(): Run {
  // The shared economy is fixed for this cohort; LAB and imported saves are not inputs.
  return { ...freshRun("classic", { ...defaultSettings, language: "ja", sound: false, music: false, backgroundPlay: false }), telemetry: false, debug: true };
}
export function parseAiAction(body: unknown): AiAction {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AiActionError("invalid_action");
  const a = body as AiAction;
  const allowed: Record<string, string[]> = { work: [], spin: [], equip: ["betId", "delta"], upgrade: ["upgrade"], strategy: ["text"] };
  if (typeof a.type !== "string" || !Object.hasOwn(allowed, a.type) || !Number.isSafeInteger(a.version) || a.version < 0) throw new AiActionError("invalid_action");
  if (Object.keys(a).some(key => !["type", "version", "reason", ...allowed[a.type]].includes(key))) throw new AiActionError("unknown_argument");
  if (a.reason !== undefined && (typeof a.reason !== "string" || a.reason.length > 280)) throw new AiActionError("invalid_reason");
  if (a.type === "equip" && (typeof a.betId !== "string" || a.betId.length > 80 || !Number.isInteger(a.delta) || ![-1, 1].includes(a.delta!))) throw new AiActionError("invalid_equip");
  if (a.type === "upgrade" && !UPGRADES.includes(a.upgrade!)) throw new AiActionError("invalid_upgrade");
  if (a.type === "strategy" && (typeof a.text !== "string" || !a.text.trim() || a.text.length > 1200)) throw new AiActionError("invalid_strategy");
  return a;
}
export function performAiAction(run: Run, action: AiAction, now: number, startedAt: number): Run {
  const current = { ...run, activeMs: Math.max(0, now - startedAt), startedAt };
  let next: Run = current;
  switch (action.type) {
    case "work": next = work(current); break;
    case "spin":
      if (!canSpin(current)) throw new AiActionError("cannot_spin");
      next = spin(current, undefined, 0); break;
    case "equip":
      if (!availableBets(current).some(b => b.id === action.betId)) throw new AiActionError("unknown_bet");
      next = setCount(current, action.betId!, action.delta!); break;
    case "upgrade": next = purchase(current, action.upgrade!); break;
    case "strategy": break;
  }
  if (action.type !== "strategy" && next === current) throw new AiActionError("action_unavailable");
  next = endUnfundedJackpot(next);
  return { ...next, running: false, debug: true, telemetry: false, completion: next.completion ? { ...next.completion, ranked: false, rulesetVersion: AI_RULESET } : null };
}
export function aiChoices(run: Run) {
  return {
    workIntervalMs: AI_WORK_INTERVAL, spinIntervalMs: interval(run), canSpin: canSpin(run), wager: totalCost(run),
    bets: availableBets(run).map(b => ({ id: b.id, name: b.name, description: b.description, unlocked: unlocked(run, b), unlockAt: b.unlock, stake: stakeOf(b, run), payout: payoutOf(b, run), count: run.portfolio.find(p => p.id === b.id)?.count ?? 0, memory: mem(run, b.id), pattern: b.pattern, start: b.start, width: b.width })),
    upgrades: UPGRADES.map(id => ({ id, level: run[id], price: upgradePrice(run, id), unlocked: upgradeUnlocked(run, id) })),
  };
}
