import { describe, expect, it } from "vitest";
import { ALL_BETS, BASE_BETS, CATALOGS, LEGACY_BETS, betById } from "./catalog";
import {
  MONEY_CEILING,
  TARGET,
  availableBets,
  buyDraft,
  canSpin,
  chooseDraft,
  configure,
  freshRun,
  defaultSettings,
  fuelCapacity,
  interval,
  isInfinite,
  loadPreset,
  migrateLegacy,
  money,
  nextDistribution,
  purchase,
  readSave,
  resolve,
  rollFloor,
  savePreset,
  setCount,
  spin,
  status,
  switchCatalog,
  totalCost,
  unlocked,
  upgradePrice,
  work,
  type Run,
} from "./engine";
const funded = (id = "edge-50", cash = 1000): Run => ({
  ...freshRun(
    CATALOGS.find((c) => c.id === "curated")!.ids.includes(id)
      ? "curated"
      : CATALOGS.find((c) => c.ids.includes(id))!.id,
    { ...defaultSettings, fuelEnabled: true },
  ),
  cash,
  peak: Math.max(cash, betById(id).unlock),
  fuel: 5,
  portfolio: [{ id, count: 1 }],
  running: true,
});
describe("original seven and catalog boundaries", () => {
  it("preserves every original stake, payout, unlock and exact hit count", () => {
    expect(
      BASE_BETS.map((b) => [b.stake, b.payout, b.unlock, b.width]),
    ).toEqual([
      [10, 30, 0, 50],
      [100, 650, 200, 25],
      [1000, 18000, 2000, 10],
      [10000, 400000, 20000, 5],
      [100000, 5500000, 200000, 4],
      [1000000, 80000000, 2000000, 3],
      [10000000, 1400000000, 20000000, 2],
    ]);
    const s = freshRun("classic");
    for (const b of BASE_BETS)
      expect(
        Array.from(
          { length: 100 },
          (_, i) => resolve(s, b, i + 1).payout,
        ).filter((n) => n > 0),
      ).toHaveLength(b.width);
  });
  it("contains thirteen distinct complete rosters and exactly seven in classic", () => {
    expect(CATALOGS).toHaveLength(13);
    expect(availableBets(freshRun("classic")).map((b) => b.id)).toEqual(
      BASE_BETS.map((b) => b.id),
    );
    for (const c of CATALOGS) {
      expect(new Set(c.ids).size).toBe(c.ids.length);
      expect(c.ids.every((id) => ALL_BETS.some((b) => b.id === id))).toBe(true);
    }
    expect(LEGACY_BETS).toHaveLength(30);
  });
  it("unlocks from peak cash and retains unlocks after spending", () => {
    const s = { ...funded(), cash: 10, peak: 200 };
    expect(unlocked(s, betById("edge-25"))).toBe(true);
    expect(unlocked(s, betById("edge-10"))).toBe(false);
  });
  it("removes incompatible bets, offers and conditions when switching", () => {
    const s = {
      ...funded("streak-1"),
      rushLeft: 50,
      removed: 10,
      chain: 2,
      memory: {
        "streak-1": { streak: 8, misses: 0, previous: 90, armed: false },
      },
      offers: ["odd-job"],
    };
    const n = switchCatalog(s, "classic");
    expect(n.portfolio).toEqual([]);
    expect(n.offers).toEqual([]);
    expect(n.memory).toEqual({});
    expect(n.rushLeft).toBe(0);
    expect(n.cash).toBe(s.cash);
    expect(n.debug).toBe(true);
    expect(n.id).not.toBe(s.id);
  });
  it("tunes longgame separately from the original economy", () => {
    const s = freshRun("longgame");
    expect(upgradePrice(s, "slots")).toBe(9600);
    expect(upgradePrice(s, "speed")).toBe(25);
    expect(betById("long-edge-25").payout).toBe(450);
    expect(betById("edge-25").payout).toBe(650);
  });
});
describe("cash, work, slots and purchases", () => {
  it("starts at zero and never declares bankruptcy when cash or compute runs out", () => {
    let s = freshRun("classic");
    expect(status(s)).toBe("empty");
    s = setCount(s, "edge-50", 1);
    expect(status(s)).toBe("cash");
    for (let i = 0; i < 10; i++) s = work(s);
    expect(s.cash).toBe(10);
    s = spin(s, 1);
    expect(s.cash).toBe(0);
    expect(s.slots).toBe(1);
    expect(s.portfolio).toHaveLength(1);
    expect(spin(s, 100)).toBe(s);
  });
  it("settles copies against one roll and consumes only one compute", () => {
    const s = {
      ...funded(),
      slots: 3,
      portfolio: [
        { id: "edge-50", count: 2 },
        { id: "edge-25", count: 1 },
      ],
    };
    const n = spin(s, 80);
    expect(n.cash).toBe(1000 - 120 + 700);
    expect(n.fuel).toBe(4);
    expect(n.last?.roll).toBe(80);
  });
  it("retains Auto while waiting and permits Work to resume it", () => {
    let s = { ...funded(), fuel: 0 };
    expect(canSpin(s)).toBe(false);
    expect(status(s)).toBe("fuel");
    s = work(s);
    expect(s.running).toBe(true);
    expect(canSpin(s)).toBe(true);
  });
  it("restores capacity on purchase and caps Work replenishment", () => {
    let s = purchase(funded(), "capacity");
    expect(s.capacity).toBe(1);
    expect(s.fuel).toBe(12);
    s = work(s);
    expect(s.fuel).toBe(fuelCapacity(s));
  });
  it("does not allow unaffordable upgrades or overfilling slots", () => {
    const s = freshRun("classic");
    expect(purchase(s, "slots")).toBe(s);
    let n = setCount(s, "edge-50", 10);
    expect(totalCost(n)).toBe(10);
    n = setCount(n, "edge-50", -1);
    expect(n.running).toBe(false);
  });
  it("preserves signed cumulative profit", () => {
    const s = spin(spin(funded(), 1), 51);
    expect(s.cash).toBe(1005);
    expect(s.lifetimeProfit).toBe(5);
  });
  it("formats significant integer zeroes correctly", () => {
    expect(money(100000)).toBe("$100K");
    expect(money(650000)).toBe("$650K");
    expect(money(100000000)).toBe("$100M");
    expect(money(1500)).toBe("$1.5K");
  });
});
describe("jackpot chains and infinity", () => {
  it("consumes compute on the triggering roll, refills Rush after decrement, and stacks Trim", () => {
    let s = { ...funded(), trim: 3, rush: 2 };
    s = spin(s, 100);
    expect([s.fuel, s.rushLeft, s.removed, s.chain]).toEqual([4, 30, 3, 1]);
    s = spin(s, 100);
    expect([s.fuel, s.rushLeft, s.removed, s.chain]).toEqual([4, 30, 6, 2]);
    expect(rollFloor(s)).toBe(7);
  });
  it("resets Trim on natural chain completion and preserves it on pause or reload", () => {
    const s = { ...funded(), trim: 3, rushLeft: 1, removed: 30, chain: 10 };
    const saved = readSave(JSON.stringify(s));
    expect(saved?.rushLeft).toBe(1);
    expect(saved?.removed).toBe(30);
    expect(saved?.running).toBe(false);
    const n = spin(s, 51);
    expect([n.rushLeft, n.removed, n.chain, rollFloor(n)]).toEqual([
      0, 0, 0, 1,
    ]);
  });
  it("permits 100-only infinity without a forced stop and keeps numbers saveable", () => {
    let s = { ...funded("streak-1"), trim: 33 };
    s = spin(spin(spin(s, 100), 100), 100);
    expect(isInfinite(s)).toBe(true);
    expect(s.last?.infinity).toBe(true);
    const left = s.rushLeft;
    for (let i = 0; i < 1000; i++) s = spin(s, 100);
    expect(s.rushLeft).toBe(left);
    expect(s.cash).toBeGreaterThan(TARGET);
    expect(s.cash).toBeLessThanOrEqual(MONEY_CEILING);
    expect(Number.isFinite(s.cash)).toBe(true);
    expect(readSave(JSON.stringify(s))?.cash).toBe(s.cash);
    expect(s.running).toBe(true);
  });
  it("honors new upgrades at the next jackpot", () => {
    const s = { ...funded("edge-50", 100000), jackpots: 1, rushLeft: 10 };
    const n = spin(purchase(purchase(s, "trim"), "rush"), 100);
    expect(n.removed).toBe(1);
    expect(n.rushLeft).toBe(25);
  });
  it("supports hidden one-time assistance only before a natural jackpot", () => {
    let s = configure(funded(), { assist: true, assistAfter: 1 });
    s = spin(s);
    expect(s.last?.assisted).toBe(true);
    expect(s.last?.roll).toBe(100);
    expect(s.debug).toBe(true);
    const natural = spin(
      configure(funded(), { assist: true, assistAfter: 10 }),
      100,
    );
    expect(natural.assistUsed).toBe(false);
    expect(spin({ ...natural, spins: 20 }, undefined).last?.assisted).toBe(
      false,
    );
  });
  it("keeps legacy memory carryover exclusive to the legacy roster", () => {
    const s = {
      ...funded("edge-50", 1e6),
      catalog: "legacy" as const,
      slots: 2,
      owned: ["memory-leak"],
      portfolio: [
        { id: "edge-50", count: 1 },
        { id: "memory-leak", count: 1 },
      ],
      rushLeft: 1,
      removed: 40,
    };
    const n = spin(s, 51);
    expect(n.persistentRemoved).toBe(10);
    expect(rollFloor(n)).toBe(1);
    expect(spin(n, 100).removed).toBe(10);
  });
  it("rejects forced results outside the trimmed range", () => {
    expect(() => spin({ ...funded(), rushLeft: 5, removed: 70 }, 69)).toThrow();
  });
});
describe("stateful automatic gambles", () => {
  it("pays every streak win immediately and resets only the multiplier on loss", () => {
    let s = funded("streak-1");
    s = spin(s, 51);
    expect(s.cash).toBe(995);
    s = spin(s, 60);
    expect(s.cash).toBe(994);
    s = spin(s, 1);
    expect(s.cash).toBe(984);
    expect(s.memory["streak-1"].streak).toBe(0);
    s = spin(s, 51);
    expect(s.last?.payout).toBe(5);
  });
  it("requires 10% then 1% on the immediately following spin", () => {
    let s = funded("step-4", 1e7);
    s = spin(s, 91);
    expect(s.memory["step-4"].armed).toBe(true);
    expect(s.last?.payout).toBe(0);
    s = spin(s, 100);
    expect(s.last?.payout).toBe(100000000);
    let failed = spin(funded("step-4", 1e7), 91);
    failed = spin(failed, 50);
    failed = spin(failed, 100);
    expect(failed.last?.payout).toBe(0);
    expect(failed.memory["step-4"].armed).toBe(true);
  });
  it("removes new conditional memory on unequip, but preserves legacy memory", () => {
    let s = spin(funded("step-1"), 1);
    s = setCount(s, "step-1", -1);
    s = setCount(s, "step-1", 1);
    expect(spin(s, 90).last?.payout).toBe(0);
  });
  it("accumulates miss rewards and clears them on a paid win", () => {
    let s = spin(spin(funded("drought-1"), 1), 20);
    expect(resolve(s, betById("drought-1"), 76).payout).toBe(50);
    s = spin(s, 76);
    expect(s.last?.payout).toBe(50);
    expect(s.memory["drought-1"].misses).toBe(0);
  });
  it("evaluates previous-roll comparisons and isolated range shapes exactly", () => {
    let s = spin(funded("momentum-2"), 50);
    expect(s.last?.payout).toBe(0);
    s = spin(s, 74);
    expect(s.last?.payout).toBe(0);
    s = spin(s, 99);
    expect(s.last?.payout).toBe(620);
    expect(resolve(s, betById("shape-4"), 45).payout).toBe(0);
    expect(resolve(s, betById("shape-4"), 46).payout).toBe(65000);
  });
  it("shows the exact conditional next-spin distribution under Trim", () => {
    const s = {
      ...funded("step-4", 1e7),
      rushLeft: 10,
      removed: 90,
      memory: { "step-4": { streak: 0, misses: 0, previous: 91, armed: true } },
    };
    const d = nextDistribution(s);
    expect(d.slice(0, 90).every((v) => v === null)).toBe(true);
    expect(d[99]).toBe(99950000);
    expect(d[98]).toBe(-50000);
  });
  it("does not award rush-only payouts on the roll which starts Rush", () => {
    let s = funded("rush-1", 100000);
    s = spin(s, 100);
    expect(s.last?.payout).toBe(0);
    s = spin(s, 51);
    expect(s.last?.payout).toBe(4500);
  });
});
describe("save, draft, presets and clear continuity", () => {
  it("retains valid conditions and refuses corrupted or incompatible saves", () => {
    const s = spin(funded("step-1"), 1);
    expect(readSave(JSON.stringify(s))?.memory["step-1"].armed).toBe(true);
    expect(readSave("{")).toBeNull();
    expect(readSave(JSON.stringify({ ...s, catalog: "unknown" }))).toBeNull();
    expect(readSave(JSON.stringify({ ...s, capacity: -1 }))).toBeNull();
    expect(
      readSave(
        JSON.stringify({ ...s, portfolio: [{ id: "unknown", count: 1 }] }),
      ),
    ).toBeNull();
    expect(
      readSave(
        JSON.stringify({
          ...s,
          settings: { ...s.settings, spinSpeedScale: -1 },
        }),
      ),
    ).toBeNull();
  });
  it("offers three distinct legacy cards and does not auto equip the choice", () => {
    const s = { ...funded(), catalog: "legacy" as const };
    const n = buyDraft(s, () => 0.5);
    expect(n.offers).toHaveLength(3);
    expect(new Set(n.offers).size).toBe(3);
    expect(n.cash).toBe(975);
    expect(buyDraft(n)).toBe(n);
    const chosen = chooseDraft(n, n.offers[0]);
    expect(chosen.owned).toHaveLength(1);
    expect(chosen.portfolio).toEqual(s.portfolio);
    expect(chosen.offers).toEqual([]);
    const standard = funded();
    expect(buyDraft(standard)).toBe(standard);
  });
  it("validates presets against the current catalog and slots", () => {
    let s = savePreset(funded(), 0);
    s = { ...s, portfolio: [] };
    expect(loadPreset(s, 0).portfolio).toEqual([{ id: "edge-50", count: 1 }]);
    expect(loadPreset({ ...s, catalog: "longgame" }, 0).portfolio).toEqual([]);
  });
  it("imports old bank, upgrades, copies, presets, conditions and statistics", () => {
    const n = migrateLegacy(
      JSON.stringify({
        version: 7,
        bankroll: 1000,
        peakBankroll: 2000,
        fuel: 10,
        slotCount: 2,
        spinSpeedLevel: 4,
        fuelCapacityLevel: 1,
        portfolio: [
          { betId: "edge-50", count: 1 },
          { betId: "odd-job", count: 1 },
        ],
        ownedSpecialBets: ["odd-job"],
        drawCount: 3,
        deckPresets: [[{ betId: "edge-50", count: 2 }], null, null],
        statistics: { totalSpins: 44, totalProfit: 123, moneyClicks: 30 },
        contractMemory: { "buy-the-dip": { streak: 0, previousRoll: 11 } },
      }),
    );
    expect(n?.cash).toBe(1000);
    expect(n?.owned).toEqual(["odd-job"]);
    expect(n?.spins).toBe(44);
    expect(n?.presets[0]).toEqual([{ id: "edge-50", count: 2 }]);
    expect(n?.memory["buy-the-dip"].previous).toBe(11);
    expect(n?.debug).toBe(true);
  });
  it("records the first clear and continues the same run afterwards", () => {
    let s = funded("edge-2", 20000000);
    s = { ...s, activeMs: 123000 };
    s = spin(s, 99, 0);
    expect(s.clearActiveMs).toBe(123000);
    expect(s.running).toBe(true);
    expect(s.clearSpins).toBe(1);
    const clearAt = s.clearAt;
    s = spin(s, 99, 0);
    expect(s.clearAt).toBe(clearAt);
    expect(s.spins).toBe(2);
    expect(s.cash).toBe(2800000000);
  });
  it("uses the configured speed without affecting the shared 100ms Rush clock", () => {
    expect(interval(freshRun())).toBe(5000);
    expect(interval({ ...freshRun(), speed: 100 })).toBe(500);
    expect(interval({ ...freshRun(), rushLeft: 1 })).toBe(300);
  });
});
