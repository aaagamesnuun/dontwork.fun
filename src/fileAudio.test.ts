import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "./game/engine";
import { resultTones, type Tone } from "./audioPalette";
import { renderFileTones, renderFileMusic } from "./fileAudioPcm";
const tone: Tone = { frequency: 440, offset: .1, duration: .5, gain: .1, wave: "sine", attack: "linear" };
const pcm = (wav: ArrayBuffer) => new Int16Array(wav.slice(44));
class FakeAudio {
  static all: FakeAudio[] = [];
  src = ""; loop = false; preload = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn(); load = vi.fn();
  removeAttribute = vi.fn(() => { this.src = ""; });
  constructor() { FakeAudio.all.push(this); }
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); FakeAudio.all = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("AudioContext", vi.fn(() => { throw new Error("Must not open audio hardware"); }));
  vi.stubGlobal("OfflineAudioContext", vi.fn(() => { throw new Error("No context is needed"); }));
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("location", { search: "?recordingAudio=file" });
  let serial = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test-${++serial}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("recording file PCM", () => {
  it("writes a valid 48kHz mono WAV with the requested timing and frequency", () => {
    const wav = renderFileTones([tone]); const view = new DataView(wav), data = pcm(wav);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(40, true)).toBe(data.byteLength);
    expect(data.length / 48000).toBeCloseTo(.625, 4);
    expect(data.slice(0, 4800).every(value => value === 0)).toBe(true);
    let crossings = 0;
    for (let i = 6001; i < 25200; i++) if (data[i - 1] <= 0 && data[i] > 0) crossings++;
    expect(crossings / .4).toBeCloseTo(440, 0);
    expect(data.every(Number.isFinite)).toBe(true);
  });
  it("bakes volume into PCM, preserves muted loss, and bounds intense celebrations", () => {
    const full = pcm(renderFileTones([tone]));
    const quiet = pcm(renderFileTones([{ ...tone, gain: .05 }]));
    expect(Math.max(...quiet)).toBeLessThan(Math.max(...full) * .52);
    const loss = pcm(renderFileTones(resultTones("loss", { ...defaultSettings, lossVolume: 0 })));
    expect(loss.every(value => value === 0)).toBe(true);
    const huge = pcm(renderFileTones(resultTones("infinity", { ...defaultSettings, soundVolume: 1, effectIntensity: 5, jackpotVisual: "festival" })));
    expect(huge.some(value => value !== 0)).toBe(true);
    expect(huge.every(value => Math.abs(value) <= 32767)).toBe(true);
  });
  it.each(["night", "pulse", "arcade"] as const)("renders a complete %s loop with PCM volume and no contexts", musicPack => {
    const settings = { ...defaultSettings, musicPack, musicVolume: .5 };
    const data = pcm(renderFileMusic(settings, false));
    expect(data.length / 48000).toBeCloseTo(32 * 60 / (musicPack === "night" ? 72 : musicPack === "arcade" ? 124 : 104) / 2, 4);
    expect(data.some(value => Math.abs(value) > 100)).toBe(true);
    expect(pcm(renderFileMusic({ ...settings, musicVolume: 0 }, false)).every(value => value === 0)).toBe(true);
    expect(AudioContext).not.toHaveBeenCalled(); expect(OfflineAudioContext).not.toHaveBeenCalled();
  });
});

describe("file playback lifecycle", () => {
  it("lets the explicit recording URL open on iPhone while normal visits still require installation", async () => {
    vi.stubGlobal("navigator", { userAgent: "iPhone", platform: "iPhone", maxTouchPoints: 5 });
    const { needsPwa } = await import("./Pwa");
    expect(needsPwa()).toBe(false);
    vi.stubGlobal("location", { search: "" }); expect(needsPwa()).toBe(true);
    vi.stubGlobal("location", { search: "?recordingAudio=unknown" }); expect(needsPwa()).toBe(true);
  });
  it("times out a stuck playback promise without replaying the cue later", async () => {
    const { FileAudioPlayer } = await import("./fileAudio"); const p = new FileAudioPlayer();
    p.prime(); await Promise.resolve();
    FakeAudio.all[9].play.mockImplementationOnce(() => new Promise(() => {}));
    p.music({ ...defaultSettings, music: true }, false, true);
    await vi.advanceTimersByTimeAsync(1600);
    expect(FakeAudio.all[9].src).toBe("");
    const calls = FakeAudio.all[9].play.mock.calls.length;
    p.music({ ...defaultSettings, music: true }, false, true);
    expect(FakeAudio.all[9].play).toHaveBeenCalledTimes(calls); p.destroy();
  });
  it("requires a gesture prime and reuses a bounded pool for overlapping results and music", async () => {
    const { FileAudioPlayer } = await import("./fileAudio"); const p = new FileAudioPlayer();
    expect(p.tones([tone], "result", vi.fn())).toBeNull();
    p.prime(); await Promise.resolve();
    const ui = vi.fn(), oldest = vi.fn();
    p.tones([tone], "ui", ui); p.tones([tone], "result", oldest);
    p.music({ ...defaultSettings, music: true }, false, true);
    for (let i = 0; i < 20; i++) p.tones([tone], "result", vi.fn());
    expect(FakeAudio.all).toHaveLength(10); expect(oldest).toHaveBeenCalledOnce(); expect(ui).not.toHaveBeenCalled();
    const music = FakeAudio.all[9]; expect(music.loop).toBe(true);
    const calls = music.play.mock.calls.length; p.music({ ...defaultSettings, music: true }, false, true);
    expect(music.play).toHaveBeenCalledTimes(calls);
    p.destroy(); expect(ui).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(24);
  });
  it("does not resurrect a stopped cue when play resolves late, and retries rejection only on gesture", async () => {
    const { FileAudioPlayer } = await import("./fileAudio"); const p = new FileAudioPlayer();
    p.prime(); await Promise.resolve();
    const slot = FakeAudio.all[6]; let reject!: (reason: Error) => void;
    slot.play.mockImplementationOnce(() => new Promise<void>((_, r) => { reject = r; }));
    const first = vi.fn(); const stop = p.tones([tone], "ui", first)!;
    stop(); p.tones([tone], "ui", vi.fn());
    const src = slot.src; reject(new Error("stale")); await Promise.resolve();
    expect(slot.src).toBe(src); expect(first).toHaveBeenCalledOnce();
    p.stop(); slot.play.mockRejectedValueOnce(new Error("blocked"));
    p.tones([tone], "ui", vi.fn()); await Promise.resolve();
    expect(p.tones([tone], "ui", vi.fn())).toBeNull();
    p.prime(); await Promise.resolve();
    expect(p.tones([tone], "ui", vi.fn())).not.toBeNull(); p.destroy();
  });
  it("cancels an in-flight unlock on stop and releases every URL on destroy", async () => {
    const { FileAudioPlayer } = await import("./fileAudio"); const p = new FileAudioPlayer();
    p.prime(); p.stop(); await Promise.resolve();
    expect(p.tones([tone], "ui", vi.fn())).toBeNull();
    p.prime(); await Promise.resolve();
    p.tones([tone], "charge", vi.fn()); p.destroy();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
  it("expires missing ended events and stops music when Jackpot override ends", async () => {
    const { FileAudioPlayer } = await import("./fileAudio"); const p = new FileAudioPlayer();
    p.prime(); await Promise.resolve(); const end = vi.fn(); p.tones([tone], "result", end);
    const s = { ...defaultSettings, music: false, jackpotMusic: "on" as const };
    p.music(s, true, true); expect(FakeAudio.all[9].src).toMatch(/^blob:/);
    p.music(s, false, true); expect(FakeAudio.all[9].src).toBe("");
    await vi.advanceTimersByTimeAsync(1800); expect(end).toHaveBeenCalledOnce(); p.destroy();
  });
  it("routes every game audio entry point without constructing Web Audio and obeys mute/visibility", async () => {
    const a = await import("./audio"); const s = { ...defaultSettings, music: true, sweepSound: true, chargeSound: "ticks" as const };
    const dispose = a.installAudioRecovery(() => s);
    a.wakeAudio(true); await Promise.resolve();
    a.sound("jackpot", s); a.uiSound("ui", s); a.spinCharge(.2, 1000, s); a.sweepMotionSound(12, s); a.musicPulse(s, true, true);
    expect(AudioContext).not.toHaveBeenCalled(); expect(OfflineAudioContext).not.toHaveBeenCalled();
    expect(FakeAudio.all.filter(x => x.play.mock.calls.length > 1)).toHaveLength(5);
    a.musicPulse({ ...s, sound: false }, false, true);
    expect(FakeAudio.all.slice(0, 9).every(x => !x.src || x.src === "blob:test-1")).toBe(true);
    expect(FakeAudio.all[9].src).not.toBe("");
    Object.assign(document, { hidden: true }); document.dispatchEvent(new Event("visibilitychange"));
    expect(FakeAudio.all[9].src).toBe("");
    a.setAudioEnabled(false); a.wakeAudio(true); dispose();
    expect(AudioContext).not.toHaveBeenCalled();
  });
});
