import { describe, expect, it } from "vitest";
import {
  UPGRADES,
  configure,
  defaultSettings,
  drawUpgrade,
  freshRun,
  fuelCapacity,
  purchase,
  purchaseMax,
  readSave,
  switchCatalog,
  upgradeDrawPool,
  upgradeDrawPrice,
} from "./engine";

const run = () => ({
  ...freshRun("classic", {
    ...defaultSettings,
    upgradeMode: "gacha",
    fuelEnabled: true,
  }),
  jackpots: 1,
  cash: 1000,
  peak: 1000,
});

describe("upgrade-only gacha progression", () => {
  it.each(UPGRADES)(
    "grants one %s level for the shared price, without the direct price",
    (upgrade) => {
      const s = run(),
        index = UPGRADES.indexOf(upgrade);
      const n = drawUpgrade(s, () => (index + 0.5) / 5);
      expect(n.cash).toBe(975);
      expect(n.spent).toBe(25);
      expect(n.upgradeDraws).toBe(1);
      expect(n[upgrade]).toBe(s[upgrade] + 1);
      expect(n.lastUpgradeDraw).toEqual({
        upgrade,
        price: 25,
        level: s[upgrade] + 1,
      });
      for (const other of UPGRADES.filter((u) => u !== upgrade))
        expect(n[other]).toBe(s[other]);
      expect(n.draws).toBe(0);
    },
  );
  it("refills Compute when its capacity is drawn", () => {
    const s = { ...run(), fuel: 0 },
      n = drawUpgrade(s, () => 0.5);
    expect(n.capacity).toBe(1);
    expect(n.fuel).toBe(fuelCapacity(n));
  });
  it("raises the common price on every completed draw until every upgrade is MAX", () => {
    let s = { ...run(), cash: 1e24, peak: 1e24 };
    let previous = 0,
      draws = 0;
    while (upgradeDrawPool(s).length) {
      const price = upgradeDrawPrice(s)!;
      expect(price).toBeGreaterThan(previous);
      previous = price;
      s = drawUpgrade(s, () => 0);
      draws++;
      expect(draws).toBeLessThanOrEqual(246);
    }
    expect(draws).toBe(246);
    expect(s.upgradeDraws).toBe(246);
    expect(UPGRADES.map((u) => s[u])).toEqual([12, 100, 6, 99, 30]);
    expect(upgradeDrawPrice(s)).toBeNull();
    expect(drawUpgrade(s)).toBe(s);
  });
  it("excludes capped upgrades and normalizes over the remaining choices", () => {
    const s = { ...run(), slots: 12, speed: 100, capacity: 6, trim: 99 };
    expect(upgradeDrawPool(s)).toEqual(["rush"]);
    expect(drawUpgrade(s, () => 0.999).rush).toBe(1);
  });
  it("does not charge or advance a draw with insufficient funds or an invalid random input", () => {
    const s = { ...run(), cash: 24 };
    expect(drawUpgrade(s)).toBe(s);
    const funded = run();
    expect(drawUpgrade(funded, () => 1)).toBe(funded);
    expect(drawUpgrade(funded, () => NaN)).toBe(funded);
  });
  it("blocks both direct purchase paths in gacha mode and blocks gacha in direct mode", () => {
    const s = run();
    for (const u of UPGRADES) {
      expect(purchase(s, u)).toBe(s);
      expect(purchaseMax(s, u)).toBe(s);
    }
    const direct = { ...freshRun(), cash: 1000 };
    expect(drawUpgrade(direct)).toBe(direct);
    expect(purchase(direct, "slots").slots).toBe(2);
  });
  it("keeps draw count and price across saves, upgrade modes, and catalogs", () => {
    const drawn = drawUpgrade(run(), () => 0),
      saved = readSave(JSON.stringify(drawn))!;
    const switched = switchCatalog(
      configure(configure(saved, { upgradeMode: "direct" }), {
        upgradeMode: "gacha",
      }),
      "curated",
    );
    expect(switched.upgradeDraws).toBe(1);
    expect(upgradeDrawPrice(switched)).toBe(30);
    expect(switched.lastUpgradeDraw).toEqual(drawn.lastUpgradeDraw);
    expect(switched.debug).toBe(true);
    const restarted = freshRun("curated", switched.settings);
    expect(restarted.upgradeDraws).toBe(0);
    expect(restarted.settings.upgradeMode).toBe("gacha");
    expect(restarted.debug).toBe(true);
  });
  it("migrates v1.0 saves to direct purchase with zero upgrade draws", () => {
    const old = JSON.parse(JSON.stringify(freshRun()));
    delete old.upgradeDraws;
    delete old.lastUpgradeDraw;
    delete old.settings.upgradeMode;
    const n = readSave(JSON.stringify(old));
    expect(n?.settings.upgradeMode).toBe("direct");
    expect(n?.upgradeDraws).toBe(0);
    expect(n?.lastUpgradeDraw).toBeNull();
    expect(readSave(JSON.stringify({ ...old, upgradeDraws: -1 }))).toBeNull();
    expect(readSave(JSON.stringify({ ...old, upgradeDraws: 1.5 }))).toBeNull();
  });
  it("does not mix legacy special-card draws with upgrade draws", () => {
    const s = { ...run(), catalog: "legacy" as const, draws: 17 };
    const n = drawUpgrade(s, () => 0);
    expect(n.draws).toBe(17);
    expect(n.upgradeDraws).toBe(1);
  });
});
