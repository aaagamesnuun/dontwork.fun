import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(new URL("../public/audio-check-v1.js", import.meta.url), "utf8");
const wav = await readFile(new URL("../public/audio-check-v1.wav", import.meta.url));
const bytes = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
function harness() {
  const elements = new Map(), contexts = [], media = [], requests = [], timers = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { disabled: false, hidden: false, listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
    return elements.get(id);
  };
  const document = { getElementById: element, hidden: false, addEventListener() {} };
  class Audio {
    constructor(url) { this.url = url; this.currentTime = 0; this.playing = false; media.push(this); }
    async play() { this.playing = true; }
    pause() { this.playing = false; }
  }
  class AudioContext {
    constructor() { this.state = "suspended"; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; this.nodes = []; contexts.push(this); }
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
    async decodeAudioData(data) { this.decoded = data; return { duration: 7, decodedBytes: data }; }
    createBufferSource() {
      const node = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } };
      this.nodes.push(node); return node;
    }
  }
  const env = { document, window: { addEventListener() {} }, Audio, AudioContext,
    location: { reload() {} }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); },
    fetch: async url => { requests.push(url); return { ok: true, arrayBuffer: async () => bytes }; },
  };
  vm.runInNewContext(script, env);
  const click = id => element(id).listeners.click();
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return { env, contexts, media, requests, timers, element, click, flush };
}

// A must not create Web Audio before or during the entire baseline.
const normal = harness();
assert.equal(normal.contexts.length, 0);
normal.click("play-a"); await normal.flush();
assert.equal(normal.contexts.length, 0);
assert.equal(normal.media[0].playing, true);
assert.equal(normal.element("play-b").disabled, true);
normal.media[0].onended();
assert.equal(normal.element("play-b").disabled, false);

// B uses the exact same PCM file, and the native output has stopped.
normal.click("play-b"); await normal.flush();
assert.equal(normal.contexts.length, 1);
assert.equal(normal.media[0].playing, false);
assert.equal(normal.requests[0], normal.media[0].url);
assert.equal(normal.contexts[0].decoded, bytes);
assert.equal(normal.contexts[0].nodes[0].started, true);
normal.contexts[0].nodes[0].onended();
assert.equal(normal.contexts[0].state, "closed");
assert.equal(normal.element("play-a").disabled, true);
assert.equal(normal.element("restart").hidden, false);
assert.equal(normal.timers.size, 0);

// Cancellation during loading must not let an old async request start sound.
const cancelled = harness();
cancelled.click("play-a"); await cancelled.flush(); cancelled.media[0].onended();
let resolveLoad;
cancelled.env.fetch = () => new Promise(resolve => { resolveLoad = resolve; });
cancelled.click("play-b"); cancelled.click("stop");
resolveLoad({ ok: true, arrayBuffer: async () => bytes });
await cancelled.flush();
assert.equal(cancelled.contexts[0].nodes.length, 0);
assert.equal(cancelled.contexts[0].state, "closed");

// Loading failures and hangs need a visible retry, not a falsely completed test.
const failed = harness();
failed.click("play-a"); await failed.flush(); failed.media[0].onended();
failed.env.fetch = async () => ({ ok: false });
failed.click("play-b"); await failed.flush();
assert.equal(failed.contexts[0].state, "closed");
assert.match(failed.element("label").textContent, /再生できません/);
assert.equal(failed.element("restart").hidden, false);
const stalled = harness();
stalled.media[0].play = () => new Promise(() => {});
stalled.click("play-a");
[...stalled.timers.values()][0]();
assert.equal(stalled.media[0].playing, false);
assert.equal(stalled.element("play-a").disabled, false);

// Validate the independent reference audio's format, duration and steady tone.
assert.equal(wav.toString("ascii", 0, 4), "RIFF");
assert.equal(wav.readUInt32LE(24), 48000);
assert.equal(wav.readUInt32LE(40), 7 * 48000 * 2);
let crossings = 0, zeros = 0, peak = 0;
for (let i = 24000; i < 72000; i++) {
  const value = wav.readInt16LE(44 + i * 2), previous = wav.readInt16LE(44 + (i - 1) * 2);
  if (previous <= 0 && value > 0) crossings++;
  if (value === 0) zeros++;
  peak = Math.max(peak, Math.abs(value));
}
assert.ok(Math.abs(crossings - 440) <= 1);
assert.ok(zeros / 48000 < 0.01);
assert.ok(peak <= 3277);
console.log("PASS: native-only A; identical PCM for B; mutually exclusive output; cancellation; retry/timeout; 7-second 48kHz reference waveform.");
