import type { Tone } from "./audioPalette";
import type { Settings } from "./game/engine";
import { musicNotes } from "./music";

// Pure PCM rendering: neither AudioContext nor OfflineAudioContext is created.
// Keep volume in the samples because iOS can ignore HTMLMediaElement.volume.
export const FILE_AUDIO_RATE = 48000;
const tables = new Map<string, Float32Array>();
function table(wave: OscillatorType, frequency: number) {
  const harmonics = Math.max(1, Math.min(128, Math.floor(23000 / frequency)));
  const key = `${wave}/${wave === "sine" ? 1 : harmonics}`;
  let values = tables.get(key);
  if (values) return values;
  values = new Float32Array(2049);
  for (let i = 0; i < 2048; i++) {
    const phase = i / 2048 * Math.PI * 2;
    if (wave === "sine") values[i] = Math.sin(phase);
    else for (let h = 1; h <= harmonics; h++) {
      if (wave === "square" && h % 2) values[i] += 4 / Math.PI / h * Math.sin(h * phase);
      if (wave === "sawtooth") values[i] += 2 / Math.PI * (h % 2 ? 1 : -1) / h * Math.sin(h * phase);
      if (wave === "triangle" && h % 2) values[i] += 8 / Math.PI ** 2 * (-1) ** ((h - 1) / 2) / h ** 2 * Math.sin(h * phase);
    }
  }
  values[2048] = values[0];
  tables.set(key, values);
  return values;
}

function addTone(samples: Float32Array, tone: Tone, wrap = false, music = false) {
  if (!Number.isFinite(tone.frequency) || tone.frequency <= 0 || !Number.isFinite(tone.gain) || tone.gain <= 0) return;
  const rate = FILE_AUDIO_RATE;
  const endPitch = tone.pitchEnd && tone.pitchEnd > 0 ? tone.pitchEnd : 1;
  const wave = table(tone.wave, tone.frequency * Math.max(1, endPitch));
  const attack = music ? Math.min(.025, tone.duration / 4) : tone.attack === "exponential" ? .006 : .004;
  const start = Math.round(tone.offset * rate);
  let phase = 0;
  for (let i = 0; i < Math.ceil((tone.duration + .02) * rate); i++) {
    const t = i / rate;
    let gain: number;
    if (t < attack) {
      gain = !music && tone.attack === "exponential"
        ? .0001 * (Math.max(.0001, tone.gain) / .0001) ** (t / attack)
        : tone.gain * t / attack;
    } else if (t < tone.duration) {
      gain = Math.max(.0001, tone.gain) * (.0001 / Math.max(.0001, tone.gain)) ** ((t - attack) / (tone.duration - attack));
    } else gain = .0001 * Math.max(0, 1 - (t - tone.duration) / .02);
    const at = phase * 2048, index = Math.floor(at), mix = at - index;
    const sample = (wave[index] * (1 - mix) + wave[index + 1] * mix) * gain;
    const target = wrap ? (start + i) % samples.length : start + i;
    if (target >= 0 && target < samples.length) samples[target] += sample;
    phase = (phase + tone.frequency * endPitch ** Math.min(1, t / .045) / rate) % 1;
  }
}

export function encodeWav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true);
  text(8, "WAVEfmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, FILE_AUDIO_RATE, true); view.setUint32(28, FILE_AUDIO_RATE * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, samples.length * 2, true);
  let peak = 1;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(samples[i] / peak * 32767), true);
  return buffer;
}

export function renderFileTones(tones: Tone[]): ArrayBuffer {
  const duration = Math.min(4, Math.max(.04, ...tones.map(t => t.offset + t.duration + .025)));
  const samples = new Float32Array(Math.ceil(duration * FILE_AUDIO_RATE));
  for (const tone of tones) addTone(samples, tone);
  return encodeWav(samples);
}

export function renderFileMusic(settings: Settings, rush: boolean): ArrayBuffer {
  const seconds = 60 / (settings.musicPack === "night" ? 72 : settings.musicPack === "arcade" ? 124 : 104) / 2;
  const samples = new Float32Array(Math.round(32 * seconds * FILE_AUDIO_RATE));
  for (let step = 0; step < 32; step++) {
    for (const note of musicNotes(settings.musicPack, step, rush)) {
      addTone(samples, {
        frequency: 440 * 2 ** ((note.midi - 69) / 12), offset: step * seconds,
        duration: note.duration, gain: note.gain * settings.musicVolume * (rush ? .85 : 1),
        wave: note.wave, attack: "linear",
      }, true, true);
    }
  }
  return encodeWav(samples);
}
