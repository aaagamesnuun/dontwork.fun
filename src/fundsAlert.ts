import { totalCost, type Run } from "./game/engine";
// Compare only presented wallets. Reserving a spin must not reveal its loss.
export function fundsBecameLow(before:Run,after:Run) {
  return before.id===after.id && after.cash<before.cash && totalCost(after)>0 && before.cash>=totalCost(before) && after.cash<totalCost(after);
}
export function jackpotEndedForFunds(before: Run, after: Run) {
  return before.id === after.id && after.rushLeft === 0 && after.cash < totalCost(after) &&
    (before.rushLeft > 0 || (before.last?.id !== after.last?.id && !!after.last?.jackpot));
}
