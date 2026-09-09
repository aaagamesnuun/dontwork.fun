import type { Settings } from "./game/engine";
import type { WinImpact } from "./ResultVisuals";
export const boundedIntensity=(s:Settings)=>Math.max(.25,Math.min(2,s.effectIntensity??1));
export function effectEnergy(s:Settings,{streak=0,milestone=false}:WinImpact={}) {
  return Math.min(4,boundedIntensity(s)*(1+(s.streakEffects?Math.min(30,streak)*.06:0)+(milestone?.4:0)));
}
