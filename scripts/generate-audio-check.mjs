import { writeFile } from "node:fs/promises";

// Both playback paths consume these exact PCM samples. A never creates an
// AudioContext; B uses one BufferSource so only the output path changes.
const rate = 48000, duration = 7;
const samples = new Float64Array(rate * duration);
const notes = [
  [0.3, 1.5, 440], [2.3, 1.5, 660],
  [4.3, 0.18, 440], [4.6, 0.18, 660], [4.9, 0.18, 880],
  [5.5, 0.18, 440], [5.8, 0.18, 660], [6.1, 0.3, 880],
];
for (const [start, length, frequency] of notes) {
  for (let i = 0; i < Math.round(length * rate); i++) {
    const t = i / rate;
    const envelope = Math.min(1, t / 0.012, (length - t) / 0.025);
    samples[Math.round(start * rate) + i] += 0.1 * envelope * Math.sin(2 * Math.PI * frequency * t);
  }
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
samples.forEach((v, i) => wav.writeInt16LE(Math.round(v * 32767), 44 + i * 2));
await writeFile(new URL("../public/audio-check-v1.wav", import.meta.url), wav);
