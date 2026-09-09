import type { Settings } from "./game/engine";

export const SPIN_REVEAL_DEFAULTS = {
  spinRevealRevision:1, revealPacing:"ratio", revealRatio:.8,
} as const satisfies Partial<Settings>;
export const COMMON_SOUND_EFFECTS = {
  ...SPIN_REVEAL_DEFAULTS,
  soundDensity:"all", shake:"strong", winVisual:"festival", jackpotVisual:"festival",
  chartBackdrop:"pulse", impactFlash:"bright", sweepMotion:"focus",
} as const satisfies Partial<Settings>;
export const soundPackSettings = (soundPack:Settings["soundPack"]) => ({...COMMON_SOUND_EFFECTS,soundPack});
export const CASH_RAIN_SETTINGS = soundPackSettings("arcade-coinop");
