import { totalCost, type Run } from "./game/engine";
// Compare only presented wallets. Reserving a spin must not reveal its loss.
export function fundsBecameLow(before:Run,after:Run) {
  return before.id===after.id && after.cash<before.cash && totalCost(after)>0 && before.cash>=totalCost(before) && after.cash<totalCost(after);
}
