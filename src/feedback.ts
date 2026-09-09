import type { Settings } from "./game/engine";
export type HapticCue =
  | "work"
  | "equip"
  | "win"
  | "upgrade"
  | "armed"
  | "bigwin"
  | "jackpot"
  | "infinity";
const patterns: Record<HapticCue, number | number[]> = {
  work: 8,
  equip: 10,
  win: 12,
  upgrade: [15, 30, 25],
  armed: [10, 40, 10],
  bigwin: [20, 35, 35],
  jackpot: [30, 35, 45, 35, 80],
  infinity: [35, 45, 55, 45, 90],
};
let last = -Infinity,
  lastMajor = -Infinity;
export function stopHaptics() {
  try {
    if (typeof navigator !== "undefined") navigator.vibrate?.(0);
  } catch {
    /* Unsupported device. */
  }
}
export function haptic(
  cue: HapticCue,
  settings: Pick<Settings, "haptics"> & Partial<Pick<Settings,"effectIntensity">>,
): boolean {
  if (
    !settings.haptics ||
    typeof navigator === "undefined" ||
    typeof document === "undefined" ||
    document.hidden ||
    !navigator.vibrate
  )
    return false;
  const now = Date.now(),
    delay =
      cue === "win" ? 450 : cue === "jackpot" || cue === "infinity" ? 1800 : 60;
  const major = cue === "jackpot" || cue === "infinity";
  if (
    major
      ? cue !== "infinity" && now - lastMajor < delay
      : now - last < delay || now - lastMajor < 500
  )
    return false;
  try {
    const amount=Math.sqrt(settings.effectIntensity??1),base=patterns[cue];
    const pattern=Array.isArray(base)?base.map((value,i)=>i%2?value:Math.round(value*amount)):Math.round(base*amount);
    const accepted = navigator.vibrate(pattern);
    if (accepted) {
      last = now;
      if (major) lastMajor = now;
    }
    return accepted;
  } catch {
    return false;
  }
}
