import type { Tone } from "./audioPalette";
import type { Settings } from "./game/engine";
import { shouldPlayMusic } from "./music";
import { encodeWav, renderFileMusic, renderFileTones } from "./fileAudioPcm";

// Opt-in for device acceptance testing. Choose once on page load: never switch
// from a live AudioContext to this path midway through a screen recording.
export const fileAudioRequested = () => typeof location !== "undefined"
  && new URLSearchParams(location.search).get("recordingAudio") === "file";
type Slot = {
  audio: HTMLAudioElement; ready: boolean; priming: boolean; token: number;
  dispose: (() => void) | null; started: number;
  primeDeadline?: ReturnType<typeof setTimeout>;
};
type Channel = "result" | "ui" | "charge" | "sweep";
const cache = new Map<string, ArrayBuffer>();
let cacheBytes = 0;
function cached(key: string, render: () => ArrayBuffer) {
  const prior = cache.get(key);
  if (prior) { cache.delete(key); cache.set(key, prior); return prior; }
  const data = render();
  while (cache.size && (cacheBytes + data.byteLength > 16 * 1024 * 1024 || cache.size >= 128)) {
    const oldest = cache.keys().next().value!;
    cacheBytes -= cache.get(oldest)!.byteLength;
    cache.delete(oldest);
  }
  cache.set(key, data); cacheBytes += data.byteLength;
  return data;
}

export class FileAudioPlayer {
  private slots: Slot[] = [];
  private musicKey = "";
  private silent: string | null = null;
  private serial = 0;
  private ensure() {
    if (this.slots.length) return;
    // Six independent result/effect packets plus dedicated UI, charge, sweep,
    // and music elements. Unlock these same elements in a user gesture.
    for (let i = 0; i < 10; i++) {
      const audio = new Audio();
      audio.preload = "auto";
      this.slots.push({ audio, ready: false, priming: false, token: 0, dispose: null, started: 0 });
    }
  }
  prime() {
    this.ensure();
    this.silent ??= URL.createObjectURL(new Blob([encodeWav(new Float32Array(2400))], { type: "audio/wav" }));
    for (const slot of this.slots) {
      if (slot.ready || slot.priming || slot.dispose) continue;
      slot.priming = true;
      const token = ++slot.token;
      slot.audio.src = this.silent;
      const finish = (ok: boolean) => {
        if (slot.token !== token) return;
        clearTimeout(slot.primeDeadline); slot.primeDeadline = undefined;
        slot.priming = false; slot.ready = ok;
        slot.audio.pause();
      };
      slot.primeDeadline = setTimeout(() => { finish(false); if (slot.token === token) slot.token++; }, 1500);
      try { void slot.audio.play().then(() => finish(true), () => finish(false)); }
      catch { finish(false); }
    }
  }
  private play(slot: Slot, data: ArrayBuffer, loop: boolean, ended: () => void) {
    if (!slot.ready) return null;
    slot.dispose?.();
    const token = ++slot.token;
    const url = URL.createObjectURL(new Blob([data], { type: "audio/wav" }));
    let stopped = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let startup: ReturnType<typeof setTimeout> | undefined;
    const dispose = () => {
      if (stopped) return;
      stopped = true; clearTimeout(deadline); clearTimeout(startup);
      if (slot.token === token) {
        slot.token++; slot.dispose = null;
        slot.audio.onended = null; slot.audio.onerror = null;
        slot.audio.pause(); slot.audio.removeAttribute("src"); slot.audio.load();
      }
      URL.revokeObjectURL(url); ended();
    };
    slot.dispose = dispose;
    slot.started = ++this.serial;
    slot.audio.src = url; slot.audio.loop = loop;
    slot.audio.onended = dispose;
    slot.audio.onerror = () => { slot.ready = false; dispose(); };
    // No old cue is replayed after a rejected/blocked play. Retry unlocking on
    // the next gesture, and let future game events provide their own sounds.
    const fail = () => { if (slot.token === token) { slot.ready = false; dispose(); } };
    startup = setTimeout(fail, 1500);
    try { void slot.audio.play().then(() => clearTimeout(startup), fail); } catch { fail(); }
    if (!loop && !stopped) deadline = setTimeout(dispose, (data.byteLength - 44) / 96000 * 1000 + 1000);
    return stopped ? null : dispose;
  }
  tones(tones: Tone[], channel: Channel, ended: () => void) {
    const available = tones.filter(tone => tone.gain > 0);
    if (!available.length || !this.slots.length) return null;
    const group = channel === "result" ? this.slots.slice(0, 6)
      : [this.slots[channel === "ui" ? 6 : channel === "charge" ? 7 : 8]];
    const slot = group.find(s => s.ready && !s.dispose) ?? group.filter(s => s.ready).sort((a, b) => a.started - b.started)[0];
    if (!slot) return null;
    return this.play(slot, cached(JSON.stringify(available), () => renderFileTones(available)), false, ended);
  }
  music(settings: Settings, rush: boolean, active: boolean) {
    if (!active || !shouldPlayMusic(settings, rush) || settings.musicVolume <= 0) { this.stopMusic(); return; }
    const slot = this.slots[9];
    if (!slot?.ready) return;
    const key = `music/${settings.musicPack}/${rush}/${settings.musicVolume}`;
    if (this.musicKey === key && slot.dispose) return;
    this.stopMusic();
    this.musicKey = key;
    this.play(slot, cached(key, () => renderFileMusic(settings, rush)), true, () => { this.musicKey = ""; });
  }
  stopMusic() { this.slots[9]?.dispose?.(); this.musicKey = ""; }
  stop() {
    for (const slot of this.slots) {
      slot.dispose?.();
      if (slot.priming) {
        clearTimeout(slot.primeDeadline); slot.primeDeadline = undefined;
        slot.token++; slot.priming = false; slot.audio.pause();
      }
    }
    this.musicKey = "";
  }
  destroy() {
    this.stop();
    for (const slot of this.slots) { slot.audio.removeAttribute("src"); slot.audio.load(); }
    this.slots = [];
    if (this.silent) URL.revokeObjectURL(this.silent);
    this.silent = null;
  }
}
