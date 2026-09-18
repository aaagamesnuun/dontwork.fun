import { describe, expect, it } from "vitest";
import type { AiSnapshot } from "./aiApi";
import { AiResultSoundCursor, AiSoundCursor, spectatorSoundSettings } from "./aiSpectatorAudio";
import { aiChoices, newAiRun } from "./game/ai";
import { defaultSettings, spin, type Run } from "./game/engine";
import { resultSound } from "./resultSound";

const SERVER_TIME = 1_800_000_000_000;
const action = (version: number, type = "work", at = SERVER_TIME): AiSnapshot["log"][number] =>
  ({ version, type, at, reason: "", cash: 0 });
function snapshot(version = 0, overrides: Partial<AiSnapshot> = {}): AiSnapshot {
  const run = newAiRun();
  return {
    id: "first-game", nickname: "Player", agentName: "AI", ruleset: "ai-v1-astra-13", version,
    createdAt: SERVER_TIME, expiresAt: SERVER_TIME + 86400000, startedAt: SERVER_TIME, updatedAt: SERVER_TIME,
    status: "active", elapsedMs: 0, nextWorkAt: SERVER_TIME, nextSpinAt: SERVER_TIME,
    strategy: "", run, choices: aiChoices(run), log: [], ...overrides,
  };
}
function spinRun(roll: number, before?: Run): Run {
  return spin(before ?? { ...newAiRun(), cash: 10000, peak: 10000, portfolio: [{ id: "edge-50", count: 1 }] }, roll, 0);
}

describe("spectator sound settings", () => {
  it("enables local effects independently from the silent server run without changing either", () => {
    const defaults = structuredClone(defaultSettings), server = newAiRun(), before = structuredClone(server);
    const settings = spectatorSoundSettings(true, "terminal");
    expect(server.settings.sound).toBe(false);
    expect(settings).toMatchObject({ sound: true, soundPack: "terminal", music: false, jackpotMusic: "off", backgroundPlay: false, soundDensity: "all" });
    expect(spectatorSoundSettings(false, "retro-arcade")).toMatchObject({ sound: false, soundPack: "retro-arcade" });
    expect(settings).not.toBe(defaultSettings);
    expect(defaultSettings).toEqual(defaults);
    expect(server).toEqual(before);
  });
});

describe("AI result sounds follow presentation landings", () => {
  it.each([1, 80, 100])("classifies the captured result for roll %i only when it lands", roll => {
    const cursor = new AiResultSoundCursor(), run = spinRun(roll), result = { key: `first:${run.last!.id}`, run };
    expect(cursor.next(null, true)).toBeNull();
    expect(cursor.next(result, true)).toEqual({ ...resultSound(run), kind: "result" });
    expect(cursor.next(result, true)).toBeNull();
    expect(cursor.next({ ...result }, true)).toBeNull();
  });

  it("consumes inaudible landings instead of replaying them after unmuting or returning", () => {
    const cursor = new AiResultSoundCursor(), first = { key: "first:1", run: spinRun(100) };
    expect(cursor.next(first, false)).toBeNull();
    expect(cursor.next(first, true)).toBeNull();
    const second = { key: "first:2", run: spinRun(1) };
    cursor.sync(second);
    expect(cursor.next(second, true)).toBeNull();
    const third = { key: "first:3", run: spinRun(80) };
    expect(cursor.next(third, true)?.cue).toBe(resultSound(third.run).cue);
  });

  it("does not forget a consumed result when presentation temporarily has no landing", () => {
    const cursor = new AiResultSoundCursor(), result = { key: "first:1", run: spinRun(100) };
    cursor.sync(result);
    cursor.sync(null);
    expect(cursor.next(null, true)).toBeNull();
    expect(cursor.next(result, true)).toBeNull();
  });

  it("treats equal spin numbers in separate sessions as different landing keys", () => {
    const cursor = new AiResultSoundCursor(), run = spinRun(80);
    expect(cursor.next({ key: "first:1", run }, true)?.kind).toBe("result");
    expect(cursor.next({ key: "second:1", run }, true)?.kind).toBe("result");
  });

  it("plays a delayed captured result even after newer WORK or spins advance the live state", () => {
    const network = new AiSoundCursor(), landing = new AiResultSoundCursor(), captured = spinRun(100);
    network.sync(snapshot(), 0);
    const received = snapshot(1, { run: captured, log: [action(1, "spin")] });
    expect(network.next(received, true, 1000)?.kind).toBe("result");
    const latest = snapshot(2, { run: captured, updatedAt: SERVER_TIME + 4000, log: [action(1, "spin"), action(2, "work", SERVER_TIME + 4000)] });
    expect(network.next(latest, true, 5000)?.cue).toBe("work");
    const differentResult = spinRun(1, captured);
    expect(network.next(snapshot(3, { run: differentResult, log: [action(3, "spin")] }), true, 11000)).toBeNull();
    expect(landing.next({ key: "first:1", run: captured }, true)).toEqual({ ...resultSound(captured), kind: "result" });
    expect(landing.next({ key: "first:2", run: differentResult }, true)).toEqual({ ...resultSound(differentResult), kind: "result" });
  });

  it("ignores a landing without a result and never changes the captured Run", () => {
    const cursor = new AiResultSoundCursor(), run = spinRun(100), before = structuredClone(run);
    expect(cursor.next({ key: "first:0", run: newAiRun() }, true)).toBeNull();
    expect(cursor.next({ key: "first:1", run }, true)?.kind).toBe("result");
    expect(run).toEqual(before);
  });
});

describe("AI spectator audio cursor", () => {
  it("uses the initial snapshot as a silent baseline even when it contains a jackpot", () => {
    const cursor = new AiSoundCursor(), run = spinRun(100);
    expect(cursor.next(snapshot(8, { run, log: [action(8, "spin")] }), true, 0)).toBeNull();
    expect(cursor.next(snapshot(9, { run, log: [action(8, "spin"), action(9)] }), true, 1000)).toEqual({ cue: "work", power: 1, kind: "action" });
  });

  it.each([1, 80, 100])("reuses the normal loss, win and jackpot classification for roll %i", roll => {
    const cursor = new AiSoundCursor(), run = spinRun(roll);
    cursor.sync(snapshot(), 0);
    expect(cursor.next(snapshot(1, { run, log: [action(1, "spin")] }), true, 1000)).toEqual({ ...resultSound(run), kind: "result" });
  });

  it("plays only the latest result when a poll contains several spins and other actions", () => {
    const cursor = new AiSoundCursor(), run = spinRun(1, spinRun(100));
    cursor.sync(snapshot(), 0);
    expect(cursor.next(snapshot(4, { run, log: [action(1, "spin"), action(2, "upgrade"), action(3, "spin"), action(4)] }), true, 1000)).toEqual({ ...resultSound(run), kind: "result" });
    expect(cursor.next(snapshot(4, { run, log: [action(3, "spin")] }), true, 2000)).toBeNull();
  });

  it("does not replay a result on owner operations or unchanged and out-of-order responses", () => {
    const cursor = new AiSoundCursor(), run = spinRun(100);
    cursor.sync(snapshot(), 0);
    const first = snapshot(2, { run, log: [action(2, "spin")] });
    expect(cursor.next(first, true, 1000)?.kind).toBe("result");
    expect(cursor.next(first, true, 2000)).toBeNull();
    expect(cursor.next(snapshot(1, { run, log: [action(1, "spin")] }), true, 2100)).toBeNull();
    expect(cursor.next(snapshot(3, { run, status: "paused", log: first.log }), true, 2200)).toBeNull();
    expect(cursor.next(snapshot(4, { run, log: [action(4, "strategy")] }), true, 2300)).toBeNull();
  });

  it("consumes updates while muted so enabling sound never replays them", () => {
    const cursor = new AiSoundCursor(), run = spinRun(100);
    cursor.sync(snapshot(), 0);
    const muted = snapshot(1, { run, log: [action(1, "spin")] });
    expect(cursor.next(muted, false, 1000)).toBeNull();
    expect(cursor.next(muted, true, 1100)).toBeNull();
    expect(cursor.next(snapshot(2, { run, log: [action(1, "spin"), action(2)] }), true, 1200)?.cue).toBe("work");
  });

  it("silently synchronizes after hidden periods, resets and session changes", () => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(), 0);
    const hidden = snapshot(8, { run: spinRun(100), log: [action(8, "spin")] });
    cursor.sync(hidden, 1000);
    expect(cursor.next(hidden, true, 1100)).toBeNull();
    const other = snapshot(1, { id: "another-game", log: [action(1)] });
    expect(cursor.next(other, true, 1200)).toBeNull();
    cursor.reset();
    expect(cursor.next(other, true, 1300)).toBeNull();
    cursor.sync(null);
    expect(cursor.next(other, true, 1400)).toBeNull();
  });

  it("does not rewind its baseline when an older snapshot is explicitly synchronized", () => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(4), 0);
    cursor.sync(snapshot(1), 100);
    expect(cursor.next(snapshot(4, { log: [action(4)] }), true, 200)).toBeNull();
    expect(cursor.next(snapshot(5, { log: [action(5)] }), true, 300)?.cue).toBe("work");
  });

  it.each([5000, 9000])("discards the first batch after a %i ms polling gap", gap => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(), 0);
    expect(cursor.next(snapshot(1, { log: [action(1)] }), true, gap)).toBeNull();
    expect(cursor.next(snapshot(2, { log: [action(2)] }), true, gap + 1000)?.cue).toBe("work");
  });

  it("keeps quiet polls current, and accepts fresh events up to the gap boundary", () => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(), 0);
    expect(cursor.next(snapshot(), true, 4000)).toBeNull();
    expect(cursor.next(snapshot(), true, 8000)).toBeNull();
    expect(cursor.next(snapshot(1, { log: [action(1)] }), true, 12999)?.cue).toBe("work");
  });

  it("rebases silently if the spectator device clock moves backwards", () => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(), 10000);
    expect(cursor.next(snapshot(1, { log: [action(1)] }), true, 1000)).toBeNull();
    expect(cursor.next(snapshot(2, { log: [action(2)] }), true, 2000)?.cue).toBe("work");
  });

  it("filters event age on the server clock without depending on the device clock", () => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(), 0);
    const first = snapshot(2, { log: [action(1, "upgrade", SERVER_TIME - 3001), action(2, "work", SERVER_TIME - 3000)] });
    expect(cursor.next(first, true, 1000)).toEqual({ cue: "work", power: 1, kind: "action" });
    expect(cursor.next(snapshot(3, { log: [action(3, "upgrade", SERVER_TIME - 3001)] }), true, 2000)).toBeNull();
  });

  it("does not replay a stale spin or a result whose log fell out of the server window", () => {
    const cursor = new AiSoundCursor(), run = spinRun(100);
    cursor.sync(snapshot(), 0);
    expect(cursor.next(snapshot(4, { run, log: [action(1, "spin", SERVER_TIME - 3001), action(4)] }), true, 1000)?.cue).toBe("work");
    const next = spinRun(100, run);
    expect(cursor.next(snapshot(40, { run: next, log: [action(40)] }), true, 2000)?.cue).toBe("work");
  });

  it.each([
    ["upgrade", ["work", "equip", "upgrade"]],
    ["equip", ["work", "equip", "work"]],
    ["work", ["work", "work", "work"]],
  ] as const)("coalesces a poll to one %s action cue", (expected, types) => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(), 0);
    expect(cursor.next(snapshot(3, { log: types.map((type, index) => action(index + 1, type)) }), true, 1000)).toEqual({ cue: expected, power: 1, kind: "action" });
  });

  it("ignores logs outside the newly observed version range and spin logs without a result", () => {
    const cursor = new AiSoundCursor();
    cursor.sync(snapshot(5), 0);
    expect(cursor.next(snapshot(6, { log: [action(4, "upgrade"), action(7, "equip"), action(6, "strategy")] }), true, 1000)).toBeNull();
    expect(cursor.next(snapshot(7, { run: { ...newAiRun(), spins: 1 }, log: [action(7, "spin")] }), true, 2000)).toBeNull();
  });

  it("includes the finishing spin without modifying ranking, save or snapshot state", () => {
    const cursor = new AiSoundCursor(), run = spinRun(100);
    cursor.sync(snapshot(), 0);
    const finished = snapshot(1, { status: "finished", run, log: [action(1, "spin")] }), before = structuredClone(finished);
    expect(cursor.next(finished, true, 1000)).toEqual({ ...resultSound(run), kind: "result" });
    expect(finished).toEqual(before);
  });
});
