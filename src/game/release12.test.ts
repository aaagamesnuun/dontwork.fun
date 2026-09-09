import { describe, expect, it } from "vitest";
import {
  appendHistory,
  configure,
  defaultSettings,
  drawUpgrade,
  freshRun,
  purchase,
  purchaseMax,
  readSave,
  spin,
  upgradeDrawPool,
  upgradeDrawPrice,
  upgradeUnlocked,
  upgradePrice,
} from "./engine";
import { chartGeometry } from "../TradingViews";

describe("v1.2 progression", () => {
  it("starts Jackpot at twenty and unlocks both enhancements only after the first 100", () => {
    const s = {
      ...freshRun(),
      cash: 10000,
      peak: 10000,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    expect(s.settings.rushBase).toBe(20);
    for (const kind of ["trim", "rush"] as const) {
      expect(upgradeUnlocked(s, kind)).toBe(false);
      expect(purchase(s, kind)).toBe(s);
      expect(purchaseMax(s, kind)).toBe(s);
    }
    const hit = spin(s, 100);
    expect(hit.rushLeft).toBe(20);
    expect(spin(hit, 100).rushLeft).toBe(20);
    expect(purchase(hit, "trim").trim).toBe(1);
    expect(purchase(hit, "rush").rush).toBe(1);
    const ended = spin({ ...hit, rushLeft: 1 }, 51);
    expect(ended.rushLeft).toBe(0);
    expect(upgradeUnlocked(readSave(JSON.stringify(ended))!, "trim")).toBe(
      true,
    );
  });
  it("gacha draws only unlocked categories and reopens after Jackpot without resetting price", () => {
    let s = {
      ...freshRun("classic", {
        ...defaultSettings,
        upgradeMode: "gacha",
        fuelEnabled: true,
      }),
      cash: 1e24,
      peak: 1e24,
    };
    expect(upgradeDrawPool(s)).toEqual(["slots", "speed", "capacity"]);
    while (upgradeDrawPool(s).length) s = drawUpgrade(s, () => 0);
    expect(s.upgradeDraws).toBe(117);
    expect(upgradeDrawPrice(s)).toBeNull();
    expect(drawUpgrade(s)).toBe(s);
    const unlocked = { ...s, jackpots: 1 };
    expect(upgradeDrawPool(unlocked)).toEqual(["trim", "rush"]);
    expect(upgradeDrawPrice(unlocked)).toBeGreaterThan(25);
  });
  it("raises speed prices materially while keeping the first purchase accessible", () => {
    expect(upgradePrice(freshRun(), "speed")).toBe(25);
    expect(upgradePrice({ ...freshRun(), speed: 25 }, "speed")).toBe(2400);
    expect(upgradePrice({ ...freshRun(), speed: 50 }, "speed")).toBe(230000);
    expect(upgradePrice({ ...freshRun(), speed: 99 }, "speed")).toBe(
      1800000000,
    );
  });
  it("defaults old presentation to payoff without resetting imported game settings", () => {
    const old = JSON.parse(JSON.stringify(freshRun()));
    delete old.settings.reelStyle;
    old.settings.rushBase = 50;
    expect(readSave(JSON.stringify(old))?.settings).toMatchObject({
      reelStyle: "payoff",
      rushBase: 50,
    });
    expect(configure(freshRun(), { reelStyle: "number" }).debug).toBe(false);
    expect(
      readSave(JSON.stringify(configure(freshRun(), { reelStyle: "number" })))
        ?.settings.reelStyle,
    ).toBe("number");
  });
});
describe("whole-run wealth chart", () => {
  it("retains an isolated Jackpot peak, the start, and the newest point when compacting", () => {
    let history = Array.from({ length: 600 }, (_, i) => ({
      at: i * 1000,
      cash: i === 3 ? 1e8 : 0,
      kind: "spin",
    }));
    for (let i = 600; i < 10000; i++)
      history = appendHistory(history, { at: i * 1000, cash: i, kind: "spin" });
    expect(history.length).toBeLessThanOrEqual(1800);
    expect(history[0].at).toBe(0);
    expect(history.at(-1)?.at).toBe(9999000);
    expect(Math.max(...history.map((p) => p.cash))).toBe(1e8);
    expect(history.every((p, i) => i === 0 || p.at >= history[i - 1].at)).toBe(
      true,
    );
  });
  it("keeps a zero baseline and substantial headroom without overflowing at infinity", () => {
    const geometry = chartGeometry({
      ...freshRun(),
      cash: 1e200,
      peak: 1e200,
      activeMs: 2e7,
      settings: { ...defaultSettings, chartAxis: "time" },
      history: [
        { at: 0, cash: 0, spin: 0, kind: "start" },
        { at: 2e7, cash: 1e200, spin: 50000, kind: "spin" },
      ],
    });
    expect(geometry.ceiling).toBeGreaterThan(1.5e200);
    expect(geometry.end).toBe(2e7);
    expect(geometry.coords.at(-1)?.x).toBe(994);
    expect(
      geometry.coords.every(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
      ),
    ).toBe(true);
  });
});
