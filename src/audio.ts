import { recordedTrack, playRecordedMusic, stopRecordedMusic } from "./recordedMusic";
import {
  cueTones,
  resultTones,
  isResultCue,
  isClassicPack,
  type ResultAccent,
  type Tone,
} from "./audioPalette";
import type { Settings } from "./game/engine";
import { updateMusic, stopMusic as stopWebMusic, musicActive } from "./music";
import { FileAudioPlayer, fileAudioRequested } from "./fileAudio";
const fileMode = fileAudioRequested();
const filePlayer = fileMode ? new FileAudioPlayer() : null;
function stopMusic() { stopRecordedMusic(); stopWebMusic(); filePlayer?.stopMusic(); }
export type Cue =
  | "ui"
  | "toggle-on"
  | "toggle-off"
  | "spin"
  | "work"
  | "equip"
  | "upgrade"
  | "win"
  | "bigwin"
  | "loss"
  | "armed"
  | "streak"
  | "jackpot"
  | "infinity"
  | "chain"
  | "pulse"
  | "cash-low";
let context: AudioContext | null = null;
let compressor: DynamicsCompressorNode | null = null;
let chargeVoice: (() => void) | null = null;
let chargeStage = -1,
  chargeProgress = -1;
let backgroundAllowed = false;
export function setBackgroundAudio(value: boolean) {
  backgroundAllowed=value;
  try {
    const session=(typeof navigator!=="undefined" ? navigator : undefined) as (Navigator & {audioSession?:{type:string}})|undefined;
    if(session?.audioSession)session.audioSession.type=value?"playback":"auto";
  } catch { /* Experimental AudioSession is best-effort. */ }
  if(!value && typeof document!=="undefined" && document.hidden){stopSounds();stopMusic();}
}
let enabled = true,
  lastResultSound = -Infinity,
  lastResume = -Infinity;
let resuming: Promise<void> | null = null;
let attemptId = 0,
  failures = 0,
  needsRebuild = false;
type PendingCue = {
  cue: Cue;
  settings: Settings;
  power: number;
  accent?: ResultAccent;
  at: number;
};
let pending: PendingCue | null = null;
let pendingUI: PendingCue | null = null;
const uiVoices = new Set<() => void>();
export const audioEnabled = (s: Settings) =>
  (s.sound && s.soundVolume > 0) ||
  ((s.music || s.jackpotMusic === "on") && s.musicVolume > 0);
export function musicPulse(s: Settings, rush: boolean, active: boolean) {
  setAudioEnabled(audioEnabled(s));
  if (!s.sound || s.soundVolume <= 0) stopSounds();
  if(recordedTrack(s.musicPack)){stopWebMusic();filePlayer?.stopMusic();playRecordedMusic(s,active&&visible(),rush);return;}
  stopRecordedMusic();
  if (filePlayer) filePlayer.music(s, rush, active && visible());
  else updateMusic(context, s, active && visible(), rush);
}
const voices = new Set<() => void>();
const counters = () => ({
  requests: 0,
  scheduled: 0,
  mutedSkips: 0,
  throttledSkips: 0,
  voiceLimitSkips: 0,
  contextMissing: 0,
  contextFailures: 0,
  resumeFailures: 0,
  interruptedStates: 0,
});
let health = counters();
export function drainAudioHealth() {
  const result = health;
  health = counters();
  return result;
}
function disposeVoices() {
  stopSweepAudio();
  stopSpinCharge();
  for (const dispose of [...voices, ...uiVoices]) dispose();
}
function visible() {
  return backgroundAllowed || typeof document === "undefined" || !document.hidden;
}
export function stopSounds() {
  pending = null;
  pendingUI = null;
  disposeVoices();
}
export function setAudioEnabled(value: boolean) {
  enabled = value;
  if (!value) {
    pending = null;
    pendingUI = null;
    disposeVoices();
    stopMusic();
    filePlayer?.stop();
  }
}
function playPending() {
  if (context?.state !== "running" || !enabled || !visible()) return;
  const p = pending;
  pending = null;
  if (p && Date.now() - p.at < 600)
    schedule(p.cue, p.settings, p.power, p.accent);
  const u = pendingUI;
  pendingUI = null;
  if (u && Date.now() - u.at < 250) scheduleUI(u.cue, u.settings);
}
export function wakeAudio(force = false) {
  if (!enabled || !visible()) return;
  if (filePlayer) {
    // Priming must happen synchronously in the gesture, never in a timer or
    // by silently creating a real-time AudioContext as a fallback.
    if (force) { try { filePlayer.prime(); } catch { health.contextFailures++; } }
    return;
  }
  try {
    if (force && needsRebuild && context) {
      const old = context;
      context = null;
      resuming = null;
      attemptId++;
      old.onstatechange = null;
      disposeVoices();
      stopMusic();
      try {
        void old.close().catch(() => {});
      } catch {
        /* Already unavailable. */
      }
    }
    if (!context || context.state === "closed") {
      failures = 0;
      needsRebuild = false;
      attemptId++;
      disposeVoices();
      stopMusic();
      lastResultSound = -Infinity;
      lastResume = -Infinity;
      resuming = null;
      const AudioCtor =
        globalThis.AudioContext ??
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) {
        health.contextMissing++;
        return;
      }
      const ctx = new AudioCtor();
      context = ctx;
      compressor = null;
      ctx.onstatechange = () => {
        if (context !== ctx) return;
        if ((ctx.state as string) === "interrupted") health.interruptedStates++;
        if (ctx.state === "running") playPending();
        else if (ctx.state !== "closed") wakeAudio();
      };
    }
    const ctx = context;
    if (ctx.state === "running") {
      playPending();
      return;
    }
    if (resuming || (!force && Date.now() - lastResume < 750)) return;
    lastResume = Date.now();
    let timedOut = false;
    const attempt = ++attemptId;
    const fail = () => {
      if (context !== ctx || attempt !== attemptId) return;
      health.resumeFailures++;
      failures++;
      if (failures >= 2) needsRebuild = true;
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      fail();
      if (context === ctx && attempt === attemptId) resuming = null;
    }, 1800);
    resuming = ctx
      .resume()
      .then(() => {
        if (context !== ctx || attempt !== attemptId || timedOut) return;
        if (ctx.state === "running") {
          failures = 0;
          needsRebuild = false;
          playPending();
        } else fail();
      })
      .catch(() => {
        if (!timedOut) fail();
      })
      .finally(() => {
        clearTimeout(timeout);
        if (context === ctx && attempt === attemptId) resuming = null;
      });
  } catch {
    health.contextFailures++;
  }
}
export function installAudioRecovery(getSettings: () => Settings) {
  const gesture = () => wakeAudio(true);
  const restore = () => {
    if (visible()) {
      setAudioEnabled(audioEnabled(getSettings()));
      wakeAudio();
    } else {
      pending = null;
      pendingUI = null;
      disposeVoices();
      stopMusic();
      filePlayer?.stop();
    }
  };
  for (const event of ["pointerup", "click", "keydown"])
    window.addEventListener(event, gesture, { passive: true });
  window.addEventListener("pageshow", restore);
  window.addEventListener("focus", restore);
  document.addEventListener("visibilitychange", restore);
  let previousTime = -1,
    lastRequest = 0;
  const watchdog = setInterval(() => {
    if (!enabled || !visible() || !context) return;
    if (context.state !== "running") {
      wakeAudio();
      return;
    }
    // A few Safari versions can report running while their clock is frozen.
    if (
      (health.requests > lastRequest || musicActive()) &&
      previousTime === context.currentTime
    ) {
      const ctx = context;
      health.interruptedStates++;
      let finished = false;
      const deadline = setTimeout(() => {
        if (!finished && context === ctx) {
          needsRebuild = true;
          health.resumeFailures++;
        }
        finished = true;
      }, 1800);
      void ctx
        .suspend()
        .then(() => {
          if (context === ctx && !finished) wakeAudio();
        })
        .catch(() => {
          if (context === ctx && !finished) {
            needsRebuild = true;
            health.resumeFailures++;
          }
        })
        .finally(() => {
          finished = true;
          clearTimeout(deadline);
        });
    }
    previousTime = context.currentTime;
    lastRequest = health.requests;
  }, 4000);
  return () => {
    clearInterval(watchdog);
    for (const event of ["pointerup", "click", "keydown"])
      window.removeEventListener(event, gesture);
    window.removeEventListener("pageshow", restore);
    window.removeEventListener("focus", restore);
    document.removeEventListener("visibilitychange", restore);
    disposeVoices();
    stopMusic();
    setBackgroundAudio(false);
    filePlayer?.destroy();
  };
}
export function sound(
  cue: Cue,
  settings: Settings,
  power = 1,
  accent?: ResultAccent,
) {
  health.requests++;
  setAudioEnabled(audioEnabled(settings));
  if (!settings.sound || settings.soundVolume === 0 || !visible()) {
    stopSounds();
    health.mutedSkips++;
    return;
  }
  if (!filePlayer && (!context || context.state !== "running")) {
    pending = { cue, settings, power, accent, at: Date.now() };
    wakeAudio();
    return;
  }
  schedule(cue, settings, power, accent);
}
// UI has its own pending slot and bounded voices. It never replaces a result
// waiting for context recovery or consumes the result-density timestamp.
export function uiSound(cue: Cue, settings: Settings) {
  if(typeof document!=="undefined" && document.hidden)return;
  health.requests++;
  setAudioEnabled(audioEnabled(settings));
  if (!settings.sound || settings.soundVolume === 0 || !visible()) {
    stopSounds();
    return;
  }
  if (!filePlayer && (!context || context.state !== "running")) {
    pendingUI = { cue, settings, power: 1, at: Date.now() };
    wakeAudio(true);
    return;
  }
  scheduleUI(cue, settings);
}
function scheduleUI(cue: Cue, settings: Settings) {
  if (!filePlayer && (!context || context.state !== "running")) return;
  uiVoices.forEach((dispose) => dispose());
  uiVoices.clear();
  if (filePlayer) {
    if (playFilePacket(cueTones(cue, settings).slice(0, 3), "ui", uiVoices)) health.scheduled++;
    return;
  }
  if (!context) return;
  const output = audioOutput(context, settings);
  for (const tone of cueTones(cue, settings).slice(0, 3)) {
    playTone(context, output, tone, uiVoices);
  }
  if (uiVoices.size) health.scheduled++;
}
function schedule(
  cue: Cue,
  settings: Settings,
  power: number,
  accent?: ResultAccent,
) {
  const ctx = context;
  if (!enabled || (!filePlayer && (!ctx || ctx.state !== "running"))) return;
  const now = filePlayer ? performance.now() / 1000 : ctx!.currentTime;
  const minor = cue === "loss" || cue === "win" || cue === "pulse";
  if (settings.soundDensity === "highlights" && minor) {
    health.throttledSkips++;
    return;
  }
  if (
    minor &&
    settings.soundDensity === "balanced" &&
    now - lastResultSound < 0.22
  ) {
    health.throttledSkips++;
    return;
  }
  const tones = resultTones(cue, settings, power, accent).filter(
    (tone) => tone.gain > 0,
  );
  if (voices.size + tones.length > 28) {
    if (isResultCue(cue)) {
      // Keep this spin's attack audible even when previous celebration tails
      // fill the pool. Discard the oldest tails, never the incoming result.
      while (voices.size + tones.length > 28) voices.values().next().value?.();
    } else {
      health.voiceLimitSkips++;
      return;
    }
  }
  if (!["spin", "work", "equip", "upgrade"].includes(cue))
    lastResultSound = now;
  if (filePlayer) {
    if (playFilePacket(tones, "result", voices)) health.scheduled++;
    return;
  }
  if (!ctx) return;
  const output = audioOutput(ctx, settings);
  let scheduled = false;
  for (const tone of tones) if (playTone(ctx, output, tone)) scheduled = true;
  if (scheduled) health.scheduled++;
}
function playFilePacket(tones: Tone[], channel: "result" | "ui" | "charge" | "sweep", pool: Set<() => void>) {
  let dispose: (() => void) | null = null;
  try {
    dispose = filePlayer!.tones(tones, channel, () => { if (dispose) pool.delete(dispose); });
    if (dispose) pool.add(dispose);
  } catch { health.contextFailures++; }
  return dispose;
}
function audioOutput(ctx: AudioContext, settings: Settings): AudioNode {
  if (!isClassicPack(settings.soundPack) && !settings.bassMode)
    return ctx.destination;
  if (!compressor) {
    try {
      compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 10;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      compressor.connect(ctx.destination);
    } catch {
      return ctx.destination;
    }
  }
  return compressor;
}
function playTone(
  ctx: AudioContext,
  output: AudioNode,
  tone: Tone,
  pool = voices,
): (() => void) | null {
  let oscillator: OscillatorNode | null = null,
    gain: GainNode | null = null;
  let dispose: (() => void) | null = null;
  try {
    const start = ctx.currentTime + tone.offset;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    oscillator = o;
    gain = g;
    o.type = tone.wave;
    o.frequency.setValueAtTime(tone.frequency, start);
    if (tone.pitchEnd)
      o.frequency.exponentialRampToValueAtTime(
        tone.frequency * tone.pitchEnd,
        start + 0.045,
      );
    g.gain.setValueAtTime(tone.attack === "exponential" ? 0.0001 : 0, start);
    if (tone.attack === "exponential")
      g.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, tone.gain),
        start + 0.006,
      );
    else
      g.gain.linearRampToValueAtTime(
        Math.max(0.0001, tone.gain),
        start + 0.004,
      );
    g.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
    let disposed = false;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(expiry);
      pool.delete(cleanup);
      if (chargeVoice === cleanup) chargeVoice = null;
      try {
        o.stop();
      } catch {
        /* Already ended. */
      }
      o.disconnect();
      g.disconnect();
    };
    dispose = cleanup;
    const expiry = setTimeout(
      cleanup,
      (tone.offset + tone.duration + 0.25) * 1000,
    );
    pool.add(cleanup);
    o.onended = cleanup;
    o.connect(g);
    g.connect(output);
    o.start(start);
    o.stop(start + tone.duration + 0.02);
    return cleanup;
  } catch {
    if (dispose) dispose();
    else {
      try {
        oscillator?.disconnect();
        gain?.disconnect();
      } catch {
        /* Partially created voice. */
      }
    }
    health.contextFailures++;
    return null;
  }
}
export function stopSpinCharge() {
  chargeVoice?.();
  chargeVoice = null;
  chargeStage = -1;
  chargeProgress = -1;
}
// Called only while the real game clock advances. No pending queue or catch-up
// playback: charging must never replace a result waiting for context recovery.
export function spinCharge(
  progress: number,
  intervalMs: number,
  settings: Settings,
) {
  if (
    !Number.isFinite(progress) ||
    progress <= 0 ||
    progress >= 1 ||
    !settings.sound ||
    settings.soundVolume <= 0 ||
    settings.chargeSound === "off" ||
    settings.chargeVolume <= 0 ||
    !visible()
  ) {
    stopSpinCharge();
    return;
  }
  if (progress < chargeProgress) {
    chargeStage = -1;
    chargeVoice?.();
  }
  chargeProgress = progress;
  const steps = Math.max(1, Math.min(8, Math.floor(intervalMs / 160)));
  const stage = Math.min(steps - 1, Math.floor(progress * steps));
  if (stage === chargeStage) return;
  chargeStage = stage;
  health.requests++;
  if (!filePlayer && (!context || context.state !== "running")) {
    wakeAudio();
    return;
  }
  // Leave capacity and the result throttle clock exclusively to settlement.
  if (voices.size >= 20) {
    health.voiceLimitSkips++;
    return;
  }
  chargeVoice?.();
  const tone = cueTones("spin", settings)[0];
  tone.frequency *=
    settings.chargeSound === "rise"
      ? Math.pow(2, progress * 1.6)
      : 1 + stage * 0.035;
  tone.gain *= settings.chargeVolume;
  tone.duration = 0.045;
  tone.offset = 0;
  tone.pitchEnd = undefined;
  chargeVoice = filePlayer ? playFilePacket([tone], "charge", voices)
    : playTone(context!, audioOutput(context!, settings), tone);
  if (chargeVoice) health.scheduled++;
}

const sweepVoices=new Set<()=>void>();
export function stopSweepAudio(){for(const dispose of [...sweepVoices])dispose();}
export function sweepMotionSound(cursor:number,settings:Settings){
  if((!filePlayer && (!context || context.state!=="running")) || !settings.sound || !settings.sweepSound || settings.soundVolume<=0 || document.hidden)return;
  stopSweepAudio();
  const gain=settings.soundVolume*Math.sqrt(settings.effectIntensity??1);
  if(filePlayer){
    playFilePacket([{frequency:180+cursor*6,offset:0,duration:.055,wave:"sine",gain:gain*.027,attack:"linear"}],"sweep",sweepVoices);
    return;
  }
  if(!context)return;
  const output=audioOutput(context,settings);
  playTone(context,output,{frequency:180+cursor*6,offset:0,duration:.055,wave:"sine",gain:gain*.027,attack:"linear"},sweepVoices);
}
