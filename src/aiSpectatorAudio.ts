import type { AiSnapshot } from "./aiApi";
import type { Cue } from "./audio";
import type { ResultAccent } from "./audioPalette";
import { defaultSettings, type Run, type Settings } from "./game/engine";
import { resultSound } from "./resultSound";

export function spectatorSoundSettings(enabled: boolean, pack: Settings["soundPack"]): Settings {
  return {
    ...defaultSettings,
    soundPack: pack,
    sound: enabled,
    music: false,
    jackpotMusic: "off",
    backgroundPlay: false,
    soundDensity: "all",
  };
}

export type AiSpectatorCue = {
  cue: Cue;
  power: number;
  accent?: ResultAccent;
  kind: "result" | "action";
};

export type AiLandingResult = { key: string; run: Run };

/** Presentation owns arrival time; an accepted result is heard only on landing. */
export class AiResultSoundCursor {
  private key: string | null = null;

  sync(result: AiLandingResult | null): void {
    if (result) this.key = result.key;
  }

  next(result: AiLandingResult | null, audible: boolean): AiSpectatorCue | null {
    if (!result || result.key === this.key) return null;
    this.sync(result);
    if (!audible || !result.run.last) return null;
    // The captured Run belongs to this landing, even if newer WORK/spins have
    // arrived or the animation outlasted the network cursor's freshness window.
    return { ...resultSound(result.run), kind: "result" };
  }
}

type Cursor = { id: string; version: number; spins: number; observedAt: number };

/** Consumes observed events even while muted; never queues past gameplay. */
export class AiSoundCursor {
  private cursor: Cursor | null = null;

  reset(): void {
    this.cursor = null;
  }

  sync(snapshot: AiSnapshot | null, now = Date.now()): void {
    if (!snapshot) {
      this.reset();
      return;
    }
    // A delayed poll must not make already heard events eligible again.
    if (this.cursor?.id === snapshot.id && snapshot.version < this.cursor.version) return;
    this.cursor = { id: snapshot.id, version: snapshot.version, spins: snapshot.run.spins, observedAt: now };
  }

  next(snapshot: AiSnapshot, audible: boolean, now = Date.now()): AiSpectatorCue | null {
    const before = this.cursor;
    if (before?.id === snapshot.id && snapshot.version < before.version) return null;
    this.sync(snapshot, now);
    if (!before || before.id !== snapshot.id || snapshot.version === before.version) return null;
    if (!audible || now < before.observedAt || now - before.observedAt >= 5000) return null;

    // Both timestamps come from the server. Comparing them avoids muting every
    // event on spectators whose device clock differs from the server clock.
    const fresh = snapshot.log.filter(entry =>
      entry.version > before.version && entry.version <= snapshot.version &&
      entry.at >= snapshot.updatedAt - 3000,
    );
    if (snapshot.run.spins > before.spins && snapshot.run.last && fresh.some(entry => entry.type === "spin")) {
      // Polling may combine several spins. Only the latest has a complete result
      // in the snapshot, so never infer earlier payouts or replay them in a burst.
      return { ...resultSound(snapshot.run), kind: "result" };
    }
    for (const cue of ["upgrade", "equip", "work"] as const) {
      if (fresh.some(entry => entry.type === cue)) return { cue, power: 1, kind: "action" };
    }
    return null;
  }
}
