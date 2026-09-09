import type { SweepFrame } from "./TradingViews";
import type { Settings } from "./game/engine";
// A cosmetic route independent of the random draw and the charge clock.
export function roamingCursor(
  progress: number,
  duration: number,
  values: (number | null)[],
  motion: string,
  cycle: number,
) {
  const allowed = values.flatMap((v, i) => (v === null ? [] : [i + 1]));
  if (!allowed.length) return 50;
  const p = Math.max(0, Math.min(1, progress));
  const tail = Math.max(0, (p - 0.68) / 0.32);
  const travel =
    motion === "slow" && p > 0.68
      ? 0.68 + (0.32 * (1 - (1 - tail) ** 3)) / 3
      : p;
  const beat = travel * Math.max(5, duration / 70);
  const pick = (step: number) => {
    const n = Math.sin((step + 1) * 127.1 + cycle * 311.7) * 43758.5453;
    return allowed[Math.floor((n - Math.floor(n)) * allowed.length)];
  };
  const index = Math.floor(beat),
    fraction = beat - index;
  // All current cuts remove a contiguous low range, so the entire route stays valid.
  return pick(index) + (pick(index + 1) - pick(index)) * fraction;
}

const settling = ["focus", "recoil", "lock"] as const;
export function chosenMotion(motion: Settings["sweepMotion"], id: number) {
  return motion === "mix"
    ? settling[Math.abs(Math.trunc(id)) % settling.length]
    : motion;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * smooth(Math.max(0, Math.min(1, t)));

export function settlingCursor(
  progress: number,
  frame: SweepFrame,
  motion: Settings["sweepMotion"],
) {
  const p = Math.max(0, Math.min(1, progress));
  const allowed = frame.values.flatMap((v, i) => (v === null ? [] : [i + 1]));
  if (p === 1 || allowed.length <= 1) return frame.roll;
  const low = allowed[0],
    high = allowed.at(-1)!,
    target = frame.roll;
  const roam = (t: number) =>
    roamingCursor(t, frame.duration, frame.values, "roam", frame.id);
  if (p <= 0.25) return roam(p);
  const q = (p - 0.25) / 0.75,
    start = roam(0.25);
  const mode = chosenMotion(motion, frame.id);
  if (mode === "focus") return target + (1 - q) ** 2 * (roam(p) - target);
  if (mode === "recoil") {
    const width = high - low;
    const raw =
      target +
      (start - target) *
        (1 - q) ** 2 *
        Math.cos((frame.duration < 180 ? 1 : 3) * Math.PI * q);
    // Reflect at the ends instead of sticking to 1/100 during overshoot.
    const r = (((raw - low) % (2 * width)) + 2 * width) % (2 * width);
    return low + (r <= width ? r : 2 * width - r);
  }
  const center = (width: number) => {
    const a = low + Math.floor((target - low) / width) * width;
    return (a + Math.min(high, a + width - 1)) / 2;
  };
  const wide = center(20),
    narrow = center(5);
  if (frame.duration < 180) {
    if (q < 0.5) return lerp(start, wide, q / 0.5);
    return lerp(wide, target, (q - 0.5) / 0.5);
  }
  if (q < 0.35) return lerp(start, wide, q / 0.35);
  if (q < 0.48) return wide;
  if (q < 0.73) return lerp(wide, narrow, (q - 0.48) / 0.25);
  if (q < 0.84) return narrow;
  return lerp(narrow, target, (q - 0.84) / 0.16);
}

export function startSweep(
  frame: SweepFrame | null,
  motion: Settings["sweepMotion"],
  reduced: boolean,
  update: (cursor: number | null, moving: boolean, slowing: boolean) => void,
) {
  if (!frame) {
    update(null, false, false);
    return () => {};
  }
  const remaining = Math.max(0, frame.duration - (Date.now() - frame.at));
  if (frame.settled || reduced || remaining === 0) {
    update(frame.roll, false, false);
    return () => {};
  }
  const allowed = frame.values.flatMap((v, i) => (v === null ? [] : [i + 1]));
  const mode = chosenMotion(motion, frame.id);
  const tick = () => {
    const phase = Math.max(
      0,
      Math.min(1, (Date.now() - frame.at) / frame.duration),
    );
    const cursor =
      mode === "classic"
        ? (allowed[Math.floor(Math.random() * allowed.length)] ?? frame.roll)
        : mode === "slow" || mode === "roam"
          ? roamingCursor(phase, frame.duration, frame.values, mode, frame.id)
          : settlingCursor(phase, frame, mode);
    update(
      cursor,
      true,
      mode === "slow"
        ? phase > 0.68
        : settling.includes(mode as (typeof settling)[number]) && phase > 0.65,
    );
  };
  tick();
  const timer = setInterval(tick, 36);
  const end = setTimeout(() => {
    clearInterval(timer);
    update(frame.roll, false, false);
  }, remaining);
  return () => {
    clearInterval(timer);
    clearTimeout(end);
  };
}
