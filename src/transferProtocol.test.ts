import { describe, expect, it } from "vitest";
import {
  BACKUP_KEY,
  decodeTransfer,
  MAX_SAVE_LENGTH,
  persistTransfer,
  PREVIOUS_SITE,
  TRANSFER_PROTOCOL,
  trustedTransfer,
} from "./transferProtocol";
import { startBackground } from "./backgroundPlay";
import { freshRun, configure, SAVE_KEY } from "./game/engine";
describe("cross-version save continuity", () => {
  it("imports background progress paused, without replaying its old clock",()=>{
    const run=startBackground({...configure(freshRun(),{backgroundPlay:true}),cash:1000,portfolio:[{id:"edge-50",count:1}],running:true},1000);
    expect(run.background).not.toBeNull();
    const imported=decodeTransfer(JSON.stringify(run),freshRun(),true,"2.5.0")!;
    expect(imported).toMatchObject({cash:1000,running:false,background:null,debug:false});
  });
  it("requires the exact popup, source origin, nonce and message protocol", () => {
    const popup = {} as Window;
    const event = {
      origin: PREVIOUS_SITE,
      source: popup,
      data: { protocol: TRANSFER_PROTOCOL, nonce: "abc", type: "save" },
    };
    expect(trustedTransfer(event, popup, PREVIOUS_SITE, "abc")).toBe(true);
    for (const other of [
      { ...event, origin: PREVIOUS_SITE + ".example" },
      { ...event, source: {} as Window },
      { ...event, data: { ...event.data, nonce: "def" } },
      { ...event, data: { ...event.data, protocol: "other" } },
    ])
      expect(trustedTransfer(other, popup, PREVIOUS_SITE, "abc")).toBe(false);
  });
  it("retains economy and Jackpot progress, replaces identity once and preserves standard eligibility", () => {
    const s = {
      ...freshRun("streak80"),
      cash: 10000,
      peak: 12000,
      spins: 60,
      work: 10,
      activeMs: 123456,
      rushLeft: 17,
      chain: 2,
      removed: 2,
      jackpots: 2,
      portfolio: [{ id: "flow-1", count: 1 }],
      memory: {
        "flow-1": { streak: 6, misses: 0, previous: 80, armed: false },
      },
    };
    const n = decodeTransfer(JSON.stringify(s), freshRun(), true)!;
    expect(n).toMatchObject({
      cash: 10000,
      peak: 12000,
      spins: 60,
      work: 10,
      activeMs: 123456,
      rushLeft: 17,
      chain: 2,
      removed: 2,
      jackpots: 2,
      debug: false,
      running: false,
      last: null,
      entryKind: "transfer",
    });
    expect(n.memory).toEqual(s.memory);
    expect(n.portfolio).toEqual(s.portfolio);
    expect(n.settings).toEqual(s.settings);
    expect(n.id).not.toBe(s.id);
    expect(
      decodeTransfer(JSON.stringify({ ...s, debug: true }), freshRun(), true)
        ?.debug,
    ).toBe(true);
    expect(decodeTransfer(JSON.stringify(s), freshRun(), false)?.debug).toBe(
      true,
    );
  });
  it("preserves cleared/submitted state and respects either side opting out of telemetry", () => {
    const s = {
      ...freshRun(),
      cash: 1e8,
      peak: 1e8,
      clearAt: 123,
      clearActiveMs: 100,
      clearSpins: 500,
      submitted: true,
    };
    expect(decodeTransfer(JSON.stringify(s), freshRun(), true)).toMatchObject({
      submitted: true,
      clearAt: 123,
      clearActiveMs: 100,
      clearSpins: 500,
    });
    expect(
      decodeTransfer(
        JSON.stringify({ ...s, telemetry: false }),
        freshRun(),
        true,
      )?.telemetry,
    ).toBe(false);
    expect(
      decodeTransfer(
        JSON.stringify(s),
        { ...freshRun(), telemetry: false },
        true,
      )?.telemetry,
    ).toBe(false);
  });
  it("rejects corrupt and oversized payloads before changing saved data", () => {
    for (const raw of ["null", "{}", "broken", "x".repeat(MAX_SAVE_LENGTH + 1)])
      expect(decodeTransfer(raw, freshRun(), true)).toBeNull();
  });
  it("backs up the destination and surfaces storage failures without replacing the current save", () => {
    const values = new Map([[SAVE_KEY, "original"]]);
    const next = freshRun();
    const storage = {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (k === SAVE_KEY) throw new Error("Quota");
        values.set(k, v);
      },
    };
    expect(() => persistTransfer(storage, next)).toThrow("Quota");
    expect(values.get(SAVE_KEY)).toBe("original");
    expect(values.get(BACKUP_KEY)).toBe("original");
    persistTransfer(
      {
        ...storage,
        setItem: (k, v) => {
          values.set(k, v);
        },
      },
      next,
    );
    expect(JSON.parse(values.get(SAVE_KEY)!).id).toBe(next.id);
  });
});

it("preserves cloud completion metadata across versions and never upgrades manual imports to ranked", () => {
  const source = {
    ...freshRun(),
    clearAt: 123,
    clearActiveMs: 123456,
    clearSpins: 30,
    completion: {
      id: crypto.randomUUID(),
      appVersion: "1.10.0",
      rulesetVersion: "astra-v6:classic",
      catalog: "classic" as const,
      timeMs: 123456,
      spins: 30,
      ranked: true,
    },
  };
  expect(
    decodeTransfer(JSON.stringify(source), freshRun(), true, "1.10.0")
      ?.completion,
  ).toEqual(source.completion);
  expect(
    decodeTransfer(JSON.stringify(source), freshRun(), false)?.completion
      ?.ranked,
  ).toBe(false);
  const previous = { ...source, completion: null, economyRevision: 6 };
  expect(
    decodeTransfer(JSON.stringify(previous), freshRun(), true)?.completion,
  ).toMatchObject({
    appVersion: "1.10.0",
    rulesetVersion: "astra-v6:classic",
    timeMs: 123456,
    ranked: true,
  });
});
