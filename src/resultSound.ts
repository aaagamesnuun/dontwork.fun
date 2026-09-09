import { betById } from "./game/catalog";
import { isInfinite, mem, type Run } from "./game/engine";
import type { Cue } from "./audio";
import type { ResultAccent } from "./audioPalette";
export function resultSound(run: Run): {cue:Cue; power:number; accent?:ResultAccent} {
  const o=run.last!;
  const cue:Cue=o.infinity?"infinity":o.jackpot?(isInfinite(run)?"jackpot":o.rushBefore?"chain":"jackpot"):o.profit<=0?"loss":o.activated.length?"armed":isInfinite(run)?"pulse":o.maxStreak>=3?"streak":o.profit>=Math.max(100,o.wager*5)?"bigwin":"win";
  const growing=o.hits.filter(id=>betById(id).pattern==="ladder");
  const accent:ResultAccent|undefined=cue==="loss" && o.activated.length?{cue:"armed",power:1}:cue==="loss" && growing.length?{cue:"streak",power:Math.max(...growing.map(id=>mem(run,id).streak))}:undefined;
  return {cue,power:o.maxStreak,accent};
}
