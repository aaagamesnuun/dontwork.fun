import type { Settings } from "./game/engine";
type Note = {
  midi: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
};
const roots = [45, 41, 48, 43];
const chords = [
  [0, 3, 7, 10],
  [0, 4, 7, 11],
  [0, 4, 7, 11],
  [0, 4, 7, 10],
];
export function musicNotes(
  pack: Settings["musicPack"],
  step: number,
  rush: boolean,
): Note[] {
  const bar = Math.floor(step / 8) % 4,
    beat = step % 8,
    root = roots[bar],
    chord = chords[bar];
  const notes: Note[] = [];
  const add = (
    midi: number,
    duration: number,
    gain: number,
    wave: OscillatorType = "sine",
  ) => notes.push({ midi, duration, gain, wave });
  if (pack === "night") {
    if (beat === 0)
      for (const interval of chord.slice(0, 3))
        add(root + 12 + interval, 2.7, 0.02);
    if (beat === 4) add(root + 24 + chord[3], 0.85, 0.022);
  } else {
    if (beat === 0 || beat === 4) add(root, 0.22, 0.045, "sine");
    if (pack === "arcade" || ![1, 5].includes(beat))
      add(
        root + 24 + chord[[0, 1, 2, 1, 0, 2, 3, 2][beat]],
        pack === "arcade" ? 0.09 : 0.17,
        pack === "arcade" ? 0.018 : 0.034,
        pack === "arcade" ? "square" : "triangle",
      );
  }
  if (rush && [3, 7].includes(beat))
    add(root + 36 + chord[beat === 3 ? 2 : 3], 0.12, 0.021);
  return notes;
}
let ctx: AudioContext | null = null,
  bus: GainNode | null = null;
let pack: Settings["musicPack"] | null = null,
  next = 0,
  step = 0;
const voices = new Set<() => void>();
let busVolume = -1;
export const musicActive = () => bus !== null;
export function stopMusic() {
  for (const dispose of [...voices]) dispose();
  bus?.disconnect();
  bus = null;
  busVolume = -1;
  ctx = null;
  pack = null;
  next = 0;
  step = 0;
}
function note(context: AudioContext, output: GainNode, at: number, n: Note) {
  if (voices.size >= 12) return;
  let oscillator: OscillatorNode | null = null,
    gain: GainNode | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined,
    stopped = false;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(expiry);
    voices.delete(cleanup);
    try {
      oscillator?.stop();
    } catch {
      /* Already ended. */
    }
    oscillator?.disconnect();
    gain?.disconnect();
  };
  try {
    oscillator = context.createOscillator();
    gain = context.createGain();
    oscillator.type = n.wave;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((n.midi - 69) / 12), at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(
      n.gain,
      at + Math.min(0.025, n.duration / 4),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + n.duration);
    oscillator.connect(gain);
    gain.connect(output);
    voices.add(cleanup);
    oscillator.onended = cleanup;
    oscillator.start(at);
    oscillator.stop(at + n.duration + 0.03);
    expiry = setTimeout(
      cleanup,
      Math.max(0, at - context.currentTime + n.duration + 0.25) * 1000,
    );
  } catch {
    cleanup();
  }
}
export const shouldPlayMusic = (settings: Settings, rush: boolean) =>
  rush && settings.jackpotMusic !== "follow"
    ? settings.jackpotMusic === "on"
    : settings.music;

export function updateMusic(
  context: AudioContext | null,
  settings: Settings,
  active: boolean,
  rush: boolean,
) {
  if (
    !active ||
    !shouldPlayMusic(settings, rush) ||
    settings.musicVolume <= 0 ||
    context?.state !== "running"
  ) {
    stopMusic();
    return;
  }
  try {
    if (ctx !== context || pack !== settings.musicPack || !bus) {
      stopMusic();
      ctx = context;
      pack = settings.musicPack;
      bus = context.createGain();
      bus.connect(context.destination);
      next = context.currentTime + 0.04;
    }
    // Music owns a separate bus and voice budget; result effects always have headroom.
    const volume = settings.musicVolume * (rush ? 0.85 : 1);
    if (volume !== busVolume) {
      bus.gain.setValueAtTime(volume, context.currentTime);
      busVolume = volume;
    }
    const stepSeconds =
      60 / (pack === "night" ? 72 : pack === "arcade" ? 124 : 104) / 2;
    if (next < context.currentTime - 0.15) next = context.currentTime + 0.04;
    for (
      let count = 0;
      count < 8 && next < context.currentTime + 0.12;
      count++
    ) {
      for (const n of musicNotes(settings.musicPack, step, rush))
        note(context, bus, next, n);
      step = (step + 1) % 32;
      next += stepSeconds;
    }
  } catch {
    stopMusic();
  }
}
