import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings as currentSettings } from "./game/engine";
const defaultSettings={...currentSettings,soundPack:"terminal" as const};
const param = () => ({
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
});
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  onstatechange: null | (() => void) = null;
  resume = vi.fn(async () => {
    this.state = "running";
    this.onstatechange?.();
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
    this.onstatechange?.();
  });
  createDynamicsCompressor = vi.fn(() => ({
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  }));
  createGain = vi.fn(() => ({
    gain: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  constructor() {
    FakeAudioContext.instances.push(this);
  }
}

describe("v1.6 UI and independent music", () => {
  it("keeps result scheduling independent of rapid UI cues", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const s = { ...defaultSettings, soundDensity: "balanced" as const };
    for (let i = 0; i < 20; i++) a.uiSound("equip", s);
    a.sound("win", s);
    expect(a.drainAudioHealth()).toMatchObject({
      scheduled: 21,
      throttledSkips: 0,
      voiceLimitSkips: 0,
    });
    const ctx = FakeAudioContext.instances[0];
    expect(
      ctx.createOscillator.mock.results.filter(
        (r) => !r.value.disconnect.mock.calls.length,
      ),
    ).toHaveLength(8);
  });
  it("preserves a pending Jackpot when navigation happens during recovery", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    ctx.state = "suspended";
    let complete!: () => void;
    ctx.resume.mockImplementation(async () => {
      await new Promise<void>((r) => {
        complete = r;
      });
      ctx.state = "running";
      ctx.onstatechange?.();
    });
    a.wakeAudio(true);
    a.sound("jackpot", defaultSettings);
    a.uiSound("ui", defaultSettings);
    complete();
    await vi.advanceTimersByTimeAsync(10);
    expect(a.drainAudioHealth().scheduled).toBe(2);
    expect(
      ctx.createOscillator.mock.results.map(
        (r) => r.value.frequency.setValueAtTime.mock.calls[0][0],
      ),
    ).toEqual(expect.arrayContaining([260, 1040]));
  });
  it.each(["pulse", "night", "arcade"] as const)(
    "plays %s with effects muted and keeps at most twelve music voices",
    async (musicPack) => {
      const a = await import("./audio");
      const m = await import("./music");
      a.wakeAudio(true);
      await vi.advanceTimersByTimeAsync(10);
      const ctx = FakeAudioContext.instances[0],
        s = { ...defaultSettings, sound: false, music: true, musicPack };
      for (let i = 0; i < 240; i++) {
        ctx.currentTime = i * 0.05;
        a.musicPulse(s, i > 120, true);
        await vi.advanceTimersByTimeAsync(50);
        expect(
          ctx.createOscillator.mock.results.filter(
            (r) => !r.value.disconnect.mock.calls.length,
          ).length,
        ).toBeLessThanOrEqual(12);
      }
      expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(12);
      expect(m.musicActive()).toBe(true);
      const bus = ctx.createGain.mock.results[0].value;
      expect(bus.gain.setValueAtTime.mock.calls.length).toBeLessThanOrEqual(2);
      a.musicPulse({ ...s, music: false }, false, true);
      expect(m.musicActive()).toBe(false);
      expect(
        ctx.createOscillator.mock.results.every(
          (r) => r.value.disconnect.mock.calls.length > 0,
        ),
      ).toBe(true);
      a.sound("win", { ...s, sound: true, music: false });
      expect(a.drainAudioHealth().scheduled).toBe(1);
    },
  );
  it("recovers music transport after voices expire on a frozen clock", async () => {
    const doc = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", new EventTarget());
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const s = { ...defaultSettings, sound: false, music: true };
    const cleanup = a.installAudioRecovery(() => s);
    a.musicPulse(s, false, true);
    await vi.advanceTimersByTimeAsync(8500);
    expect(FakeAudioContext.instances[0].suspend).toHaveBeenCalled();
    cleanup();
  });
  it("stops music while hidden and restarts without past-note bursts", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    a.musicPulse({ ...defaultSettings, music: true }, false, true);
    vi.stubGlobal("document", { hidden: true });
    a.musicPulse({ ...defaultSettings, music: true }, false, true);
    expect(
      ctx.createOscillator.mock.results.every(
        (r) => r.value.disconnect.mock.calls.length > 0,
      ),
    ).toBe(true);
    ctx.currentTime = 3000;
    vi.stubGlobal("document", { hidden: false });
    const count = ctx.createOscillator.mock.calls.length;
    a.musicPulse({ ...defaultSettings, music: true }, true, true);
    expect(ctx.createOscillator.mock.calls.length - count).toBeLessThanOrEqual(
      3,
    );
    expect(
      ctx.createOscillator.mock.results.at(-1)?.value.start.mock.calls[0][0],
    ).toBeGreaterThan(3000);
  });
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("document", { hidden: false });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("audio recovery", () => {
  it("keeps bass-heavy results bounded and Jackpot music independent of effects mute", async () => {
    const a = await import("./audio"),
      m = await import("./music");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    const s = {
      ...defaultSettings,
      bassMode: true,
      jackpotMusic: "on" as const,
    };
    a.musicPulse(s, false, true);
    expect(m.musicActive()).toBe(false);
    for (let i = 0; i < 50; i++) {
      ctx.currentTime = i * 0.1;
      a.sound(i % 2 ? "jackpot" : "loss", s);
      await vi.advanceTimersByTimeAsync(100);
      expect(
        ctx.createOscillator.mock.results.filter(
          (r) => !r.value.disconnect.mock.calls.length,
        ).length,
      ).toBeLessThanOrEqual(28);
    }
    a.musicPulse(s, true, true);
    expect(m.musicActive()).toBe(true);
    const muted = { ...s, sound: false };
    a.setAudioEnabled(a.audioEnabled(muted));
    a.musicPulse(muted, true, true);
    expect(m.musicActive()).toBe(true);
    a.musicPulse(muted, false, true);
    expect(m.musicActive()).toBe(false);
    const count = ctx.createOscillator.mock.calls.length;
    a.sound("jackpot", muted);
    a.sound("loss", { ...s, lossVolume: 0 });
    expect(ctx.createOscillator.mock.calls.length).toBe(count);
  });
  it("recovers the loss and its accent as one result packet", async () => {
    const a = await import("./audio");
    a.sound("loss", defaultSettings, 1, { cue: "streak", power: 6 });
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    expect(a.drainAudioHealth().scheduled).toBe(1);
    const frequencies = ctx.createOscillator.mock.results.map(
      (r) => r.value.frequency.setValueAtTime.mock.calls[0][0],
    );
    expect(frequencies).toContain(440);
    expect(frequencies[0]).toBeLessThan(120);
    expect(frequencies).toContain(165);
    expect(frequencies).toHaveLength(6);
  });
  it("keeps every result at fast pace within 28 voices without cutting UI sounds", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    a.uiSound("equip", defaultSettings);
    const ui = ctx.createOscillator.mock.results
      .slice(0, 3)
      .map((r) => r.value);
    for (let i = 0; i < 30; i++) {
      ctx.currentTime = i * 0.05;
      a.sound(i % 2 ? "win" : "loss", defaultSettings);
      expect(
        ctx.createOscillator.mock.results.filter(
          (r) => !r.value.disconnect.mock.calls.length,
        ).length,
      ).toBeLessThanOrEqual(31);
    }
    expect(ui.every((o) => o.disconnect.mock.calls.length === 0)).toBe(true);
    expect(a.drainAudioHealth()).toMatchObject({
      scheduled: 31,
      voiceLimitSkips: 0,
      throttledSkips: 0,
    });
  });
  it("does not create even an attack voice when loss strength is zero", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    a.sound("loss", { ...defaultSettings, lossVolume: 0 });
    expect(
      FakeAudioContext.instances[0].createOscillator,
    ).not.toHaveBeenCalled();
  });
  it("queues one recent cue while resuming and recovers an interrupted context", async () => {
    const a = await import("./audio");
    a.sound("win", defaultSettings);
    await Promise.resolve();
    await Promise.resolve();
    const ctx = FakeAudioContext.instances[0];
    expect(a.drainAudioHealth().scheduled).toBe(1);
    ctx.state = "interrupted";
    ctx.onstatechange?.();
    await vi.advanceTimersByTimeAsync(900);
    a.sound("jackpot", defaultSettings);
    await Promise.resolve();
    await Promise.resolve();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
    expect(a.drainAudioHealth()).toMatchObject({
      scheduled: 1,
      interruptedStates: 1,
    });
  });
  it("recreates a closed context and resets old clock-based throttling", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await Promise.resolve();
    await Promise.resolve();
    const old = FakeAudioContext.instances[0];
    old.currentTime = 900;
    a.sound("win", defaultSettings);
    old.state = "closed";
    a.wakeAudio(true);
    await Promise.resolve();
    await Promise.resolve();
    a.sound("win", defaultSettings);
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(
      FakeAudioContext.instances[1].createDynamicsCompressor,
    ).toHaveBeenCalledOnce();
    expect(a.drainAudioHealth().scheduled).toBe(2);
  });
  it("disposes stale voices even if the platform never fires onended", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 0; i < 16; i++) a.sound("equip", defaultSettings);
    expect(a.drainAudioHealth().voiceLimitSkips).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(3000);
    a.sound("jackpot", defaultSettings);
    expect(a.drainAudioHealth().scheduled).toBe(1);
  });
  it("keeps a loss after Work in all-spin mode and stops active voices at zero volume", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await Promise.resolve();
    await Promise.resolve();
    const ctx = FakeAudioContext.instances[0];
    a.sound("work", defaultSettings);
    ctx.currentTime = 0.01;
    a.sound("loss", defaultSettings);
    expect(a.drainAudioHealth()).toMatchObject({
      scheduled: 2,
      throttledSkips: 0,
    });
    const voice = ctx.createOscillator.mock.results[0].value;
    a.sound("jackpot", { ...defaultSettings, soundVolume: 0 });
    expect(voice.disconnect).toHaveBeenCalled();
    expect(a.drainAudioHealth()).toMatchObject({ scheduled: 0, mutedSkips: 1 });
  });
  it("reserves room for a new Jackpot when ordinary voices are full", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await Promise.resolve();
    await Promise.resolve();
    for (let i = 0; i < 14; i++) a.sound("equip", defaultSettings);
    a.drainAudioHealth();
    a.sound("jackpot", defaultSettings);
    expect(a.drainAudioHealth()).toMatchObject({
      scheduled: 1,
      voiceLimitSkips: 0,
    });
  });
  it("clears a pending cue when volume reaches zero during resume", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    ctx.state = "suspended";
    let complete!: () => void;
    ctx.resume.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      ctx.state = "running";
      ctx.onstatechange?.();
    });
    a.wakeAudio(true);
    a.sound("jackpot", defaultSettings);
    a.sound("loss", { ...defaultSettings, soundVolume: 0 });
    complete();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(a.drainAudioHealth().scheduled).toBe(0);
  });
  it.each([0, 0.12])(
    "keeps balanced result sounds after a spin-start cue with %s seconds delay",
    async (delay) => {
      const a = await import("./audio");
      a.wakeAudio(true);
      await vi.advanceTimersByTimeAsync(10);
      const ctx = FakeAudioContext.instances[0],
        settings = { ...defaultSettings, soundDensity: "balanced" as const };
      a.sound("spin", settings);
      ctx.currentTime += delay;
      a.sound("loss", settings);
      expect(a.drainAudioHealth()).toMatchObject({
        scheduled: 2,
        throttledSkips: 0,
      });
    },
  );
  it("bounds charge to eight stages and one live voice, stopping at settlement or WAIT", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    for (let i = 1; i < 100; i++) {
      ctx.currentTime = i * 0.05;
      a.spinCharge(i / 100, 5000, { ...defaultSettings, chargeSound: "ticks" });
    }
    expect(a.drainAudioHealth().scheduled).toBe(8);
    expect(
      ctx.createOscillator.mock.results
        .slice(0, -1)
        .every((r) => r.value.disconnect.mock.calls.length > 0),
    ).toBe(true);
    a.stopSpinCharge();
    expect(
      ctx.createOscillator.mock.results.at(-1)?.value.disconnect,
    ).toHaveBeenCalled();
    a.spinCharge(0.5, 100, { ...defaultSettings, chargeSound: "ticks" });
    a.spinCharge(0.9, 100, { ...defaultSettings, chargeSound: "ticks" });
    expect(a.drainAudioHealth().scheduled).toBe(1);
    a.spinCharge(1, 100, { ...defaultSettings, chargeSound: "ticks" });
    expect(
      ctx.createOscillator.mock.results.at(-1)?.value.disconnect,
    ).toHaveBeenCalled();
  });
  it("does not let charging replace a pending Jackpot or suppress a balanced result", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    ctx.state = "suspended";
    let complete!: () => void;
    ctx.resume.mockImplementation(async () => {
      await new Promise<void>((r) => {
        complete = r;
      });
      ctx.state = "running";
      ctx.onstatechange?.();
    });
    a.wakeAudio(true);
    a.sound("jackpot", defaultSettings);
    a.spinCharge(0.3, 1000, { ...defaultSettings, chargeSound: "ticks" });
    complete();
    await vi.advanceTimersByTimeAsync(10);
    expect(a.drainAudioHealth().scheduled).toBe(1);
    expect(
      ctx.createOscillator.mock.results.map(
        (r) => r.value.frequency.setValueAtTime.mock.calls[0][0],
      ),
    ).toEqual(expect.arrayContaining([260, 1040]));
    ctx.currentTime = 1;
    a.spinCharge(0.7, 1000, { ...defaultSettings, chargeSound: "ticks" });
    a.sound("win", { ...defaultSettings, soundDensity: "balanced" });
    expect(a.drainAudioHealth()).toMatchObject({
      scheduled: 2,
      throttledSkips: 0,
    });
  });
  it("charge respects OFF, volume zero and hidden state without catch-up bursts", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    a.spinCharge(0.1, 5000, { ...defaultSettings, chargeSound: "ticks" });
    a.spinCharge(0.99, 5000, { ...defaultSettings, chargeSound: "ticks" });
    expect(a.drainAudioHealth().scheduled).toBe(2);
    a.spinCharge(0.5, 5000, { ...defaultSettings, chargeSound: "off" });
    expect(
      ctx.createOscillator.mock.results.at(-1)?.value.disconnect,
    ).toHaveBeenCalled();
    a.spinCharge(0.6, 5000, {
      ...defaultSettings,
      chargeSound: "ticks",
      chargeVolume: 0,
    });
    vi.stubGlobal("document", { hidden: true });
    a.spinCharge(0.7, 5000, { ...defaultSettings, chargeSound: "ticks" });
    expect(a.drainAudioHealth().scheduled).toBe(0);
  });
  it("rebuilds a context after repeated resume failures on the next explicit gesture", async () => {
    const a = await import("./audio");
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    const ctx = FakeAudioContext.instances[0];
    ctx.state = "interrupted";
    ctx.resume.mockRejectedValue(new Error("interrupted"));
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(a.drainAudioHealth().resumeFailures).toBe(2);
    a.wakeAudio(true);
    await vi.advanceTimersByTimeAsync(10);
    a.sound("jackpot", defaultSettings);
    expect(FakeAudioContext.instances).toHaveLength(2);
    expect(a.drainAudioHealth().scheduled).toBe(1);
  });
  it("handles missing audio APIs and respects mute without throwing", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const a = await import("./audio");
    expect(() => a.sound("win", defaultSettings)).not.toThrow();
    a.sound("jackpot", { ...defaultSettings, sound: false, music: true });
    expect(a.drainAudioHealth()).toMatchObject({
      contextMissing: 1,
      mutedSkips: 1,
      scheduled: 0,
    });
  });
});


describe("background audio LAB",()=>{
  it("allows real hidden results only when enabled and suppresses hidden UI sounds",async()=>{
    const a=await import("./audio");const audioSession={type:"auto"};vi.stubGlobal("navigator",{audioSession});
    a.wakeAudio(true);await vi.advanceTimersByTimeAsync(10);
    vi.stubGlobal("document",{hidden:true});
    a.sound("win",defaultSettings);expect(a.drainAudioHealth().scheduled).toBe(0);
    a.setBackgroundAudio(true);expect(audioSession.type).toBe("playback");
    a.sound("loss",defaultSettings);expect(a.drainAudioHealth().scheduled).toBe(1);
    a.uiSound("work",defaultSettings);expect(a.drainAudioHealth().scheduled).toBe(0);
    a.setBackgroundAudio(false);expect(audioSession.type).toBe("auto");
    a.sound("jackpot",defaultSettings);expect(a.drainAudioHealth().scheduled).toBe(0);
  });
});

it("only plays sweep movement sound when explicitly enabled in LAB",async()=>{
  const a=await import("./audio");a.wakeAudio(true);await vi.advanceTimersByTimeAsync(10);
  const context=FakeAudioContext.instances[0];
  a.sweepMotionSound(95,{...defaultSettings,sweepSound:false});expect(context.createOscillator).not.toHaveBeenCalled();
  a.sweepMotionSound(95,{...defaultSettings,sweepSound:true});expect(context.createOscillator).toHaveBeenCalledTimes(1);
  expect(context.createOscillator.mock.results[0].value.frequency.setValueAtTime).toHaveBeenCalledWith(750,expect.any(Number));
  a.stopSweepAudio();expect(context.createOscillator.mock.results[0].value.disconnect).toHaveBeenCalled();
});
