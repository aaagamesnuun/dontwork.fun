import { betById, catalogById } from "./catalog";
import type { Run } from "./engine";

export type SecondBetTutorial = "waiting" | "active" | "done";
// These sets share the introductory threshold ladder. Experimental sets may
// unlock a stateful bet second, whose first roll cannot necessarily pay out.
export function introductoryBets(s: Pick<Run, "catalog" | "trial" | "settings">) {
  if (s.trial || !["classic", "billion", "longgame"].includes(s.catalog) || s.settings.workMode !== "click") return null;
  const [first, second] = catalogById(s.catalog).ids.slice(0,2).map(betById);
  return { first, second };
}
export function secondBetStep(s: Run) {
  const bets = introductoryBets(s);
  if (!bets || s.secondBetTutorial !== "active" || s.rushLeft > 0 || s.spins === 0 || s.clearAt !== null) return null;
  if (s.portfolio.some(row => row.id === bets.second.id && row.count > 0)) return { ...bets, action: "spin" as const, id: bets.second.id };
  const first = s.portfolio.find(row => row.id === bets.first.id && row.count > 0);
  const occupied = s.portfolio.reduce((n, row) => n + row.count, 0);
  const remove = first ?? (occupied >= s.slots ? s.portfolio.find(row => row.count > 0) : undefined);
  return { ...bets, action: remove ? "remove" as const : "equip" as const, id: remove?.id ?? bets.second.id };
}
export function activatePositionTutorial(s: Run): Run {
  if (s.secondBetTutorial !== "waiting") return s;
  const bets = introductoryBets(s);
  return bets && s.peak >= bets.second.unlock ? { ...s, secondBetTutorial: "active" } : s;
}
