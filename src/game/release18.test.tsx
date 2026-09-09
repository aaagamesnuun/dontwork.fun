import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../App";
import { INTRO_KEY, GameOverview } from "../Onboarding";
import { ruleset, snapshot } from "../api";
import { BASE_BETS, CATALOGS, LEGACY_BETS } from "./catalog";
import { guidance, unlockedSince, visibleBets } from "./guidance";
import {
  SAVE_KEY,
  canSpin,
  configure,
  defaultSettings,
  freshRun,
  interval,
  purchase,
  readSave,
  resolve,
  spin,
  status,
  upgradeDrawPool,
  upgradePrice,
  upgradeUnlocked,
  work,
  type Run,
} from "./engine";

afterEach(() => vi.unstubAllGlobals());
const ready = (): Run => ({
  ...freshRun(),
  cash: 10000,
  peak: 10000,
  fuel: 0,
  portfolio: [{ id: "edge-50", count: 1 }],
  running: true,
});
const htmlFor = (s: Run, seen = false) => {
  vi.stubGlobal("navigator", { standalone: true });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      key === SAVE_KEY
        ? JSON.stringify(s)
        : key === INTRO_KEY && seen
          ? "1"
          : null,
  });
  return renderToStaticMarkup(<App />);
};

describe("v1.8 standard play and optional capacity", () => {
  it("starts with classic, quiet music, no capacity, and assisted 300ms Jackpot", () => {
    const s = freshRun();
    expect(s.catalog).toBe("classic");
    expect(s.settings).toMatchObject({
      fuelEnabled: false,
      music: false,
      sound: true,
      assist: true,
      assistAfter: 32,
      jackpotSpinIntervalMs: 300,
      rushBase: 20,
      newsPosition: "top",
    });
    expect(s.debug).toBe(false);
    expect(visibleBets(s).map((b) => b.id)).toEqual(["edge-50"]);
    expect(BASE_BETS[0].payout).toBe(30);
  });
  it("allows repeated zero-capacity spins and excludes useless capacity upgrades from both purchase modes", () => {
    let s = ready();
    for (let i = 0; i < 20; i++) s = spin(s, 51);
    expect(s.spins).toBe(20);
    expect(s.fuel).toBe(0);
    expect(work(s).fuel).toBe(0);
    expect(status(s)).toBe("running");
    expect(upgradeUnlocked(s, "capacity")).toBe(false);
    expect(upgradePrice(s, "capacity")).toBeNull();
    expect(purchase(s, "capacity")).toBe(s);
    expect(
      upgradeDrawPool(configure(s, { upgradeMode: "gacha" })),
    ).not.toContain("capacity");
  });
  it("restores the capacity wait, Work refill, normal consumption and purchase in LAB", () => {
    let s = configure(ready(), { fuelEnabled: true });
    expect(canSpin(s)).toBe(false);
    expect(status(s)).toBe("fuel");
    expect(spin(s, 51)).toBe(s);
    expect(guidance(s)).toMatchObject({
      key: "fuel",
      target: "work",
      urgent: true,
    });
    s = work(s);
    expect(canSpin(s)).toBe(true);
    expect(spin(s, 51).fuel).toBe(s.fuel - 1);
    expect(upgradeUnlocked(s, "capacity")).toBe(true);
    expect(purchase(s, "capacity").capacity).toBe(1);
    expect(upgradeDrawPool(configure(s, { upgradeMode: "gacha" }))).toContain(
      "capacity",
    );
    expect(canSpin({ ...s, fuel: 0, rushLeft: 1 })).toBe(true);
  });
  it("does not grant fuel effects or low-capacity payouts while capacity is disabled", () => {
    const s = ready();
    for (const b of LEGACY_BETS.filter((b) => b.pattern === "fuel-return"))
      expect(resolve(s, b, 100).fuel).toBe(0);
    for (const b of LEGACY_BETS.filter((b) => b.pattern === "low-fuel")) {
      expect(resolve(configure(s, { fuelEnabled: true }), b, 100).payout).toBe(
        resolve(s, b, 100).payout * 3,
      );
    }
  });
  it("assists only an unfired first Jackpot from spin 50, grants 20, and remains ranked", () => {
    let s = ready();
    vi.stubGlobal("crypto", {
      randomUUID: () => "44444444-4444-4444-8444-444444444444",
      getRandomValues: (array: Uint32Array) => {
        array.fill(50);
        return array;
      },
    });
    for (let i = 0; i < 49; i++) s = spin(s, 51);
    expect(s.jackpots).toBe(0);
    const hit = spin(s);
    expect(hit.last).toMatchObject({ roll: 100, assisted: true });
    expect(hit.rushLeft).toBe(20);
    expect(interval(hit)).toBe(300);
    expect(hit.debug).toBe(false);
    expect(readSave(JSON.stringify(hit))?.debug).toBe(false);
    expect(spin(hit).last?.assisted).toBe(false);
    expect(spin({ ...s, jackpots: 1 }).last?.assisted).toBe(false);
    expect(snapshot(hit)).toMatchObject({
      fuelEnabled: false,
      assistUsed: true,
      rankedEligible: true,
    });
  });
  it("treats presentation changes and reapplying defaults as ranked, but records economic experiments", () => {
    const s = configure(freshRun(), {
      ...defaultSettings,
      newsPosition: "bottom",
      music: true,
    });
    expect(s.debug).toBe(false);
    expect(readSave(JSON.stringify(s))?.settings.newsPosition).toBe("bottom");
    expect(configure(s, { fuelEnabled: true }).debug).toBe(true);
    expect(configure(s, { assist: false }).debug).toBe(true);
  });
  it.each(CATALOGS)(
    "uses a distinct v5 cohort and forks old played $id saves once",
    (c) => {
      const current = { ...freshRun(c.id), work: 3, cash: 3, peak: 3 };
      const old = JSON.parse(
        JSON.stringify({ ...current, economyRevision: 4 }),
      );
      delete old.settings.fuelEnabled;
      old.settings.assist = false;
      old.settings.assistAfter = 80;
      old.settings.jackpotSpinIntervalMs = 100;
      old.settings.music = true;
      const migrated = readSave(JSON.stringify(old))!;
      expect(migrated).toMatchObject({
        cash: 3,
        work: 3,
        debug: true,
        economyRevision: 13,
      });
      expect(migrated.id).not.toBe(old.id);
      expect(migrated.settings).toMatchObject({
        fuelEnabled: true,
        assist: false,
        assistAfter: 80,
        jackpotSpinIntervalMs: 100,
        music: true,
      });
      expect(readSave(JSON.stringify(migrated))?.id).toBe(migrated.id);
      expect(ruleset(current)).toBe(`astra-v13:${c.id}`);
    },
  );
});

describe("v1.8 first-play guidance", () => {
  it("guides earning, equipping, auto, shortages and optional capacity to the matching control", () => {
    expect(guidance(freshRun()).target).toBe("work");
    expect(guidance({ ...freshRun(), cash: 10 }).target).toBe("equip");
    expect(guidance({ ...ready(), running: false }).target).toBe("auto");
    expect(guidance({ ...ready(), cash: 0 }).target).toBe("work");
    expect(
      guidance({
        ...ready(),
        cash: 20,
        portfolio: [{ id: "edge-25", count: 1 }],
      }).target,
    ).toBe("positions");
    expect(guidance(ready()).target).toBeNull();
    expect(guidance(configure(ready(), { fuelEnabled: true })).target).toBe(
      "work",
    );
    expect(guidance({ ...ready(), rushLeft: 20 }).label).toBe("JACKPOT");
  });
  it("rotates goals and tips without replacing a blocked-player instruction", () => {
    const s = { ...ready(), spins: 15, spent:25 };
    expect(guidance(s, 0).label).toBe("GOAL");
    expect(guidance(s, 1).label).toBe("TIP");
    expect(guidance(s, 1).text).not.toBe(guidance(s, 5).text);
    for (const tick of [0, 2, 5, 8])
      expect(guidance(freshRun(), tick).key).toBe("first-work");
  });
  it("notifies unlocks from Work and spins but not repeated updates, spending or catalog switching", () => {
    const before = { ...freshRun(), cash: 199, peak: 199 };
    const after = work(before);
    expect(unlockedSince(before, after).map((b) => b.id)).toEqual(["edge-25"]);
    expect(visibleBets(after).map((b) => b.id)).toEqual(["edge-50", "edge-25"]);
    const winBefore = { ...ready(), cash: 190, peak: 190 };
    expect(
      unlockedSince(winBefore, spin(winBefore, 51)).map((b) => b.id),
    ).toEqual(["edge-25"]);
    expect(unlockedSince(after, purchase(after, "speed"))).toEqual([]);
    expect(unlockedSince(after, after)).toEqual([]);
    expect(unlockedSince(after, { ...after, catalog: "curated" })).toEqual([]);
    expect(unlockedSince(after, freshRun())).toEqual([]);
  });
  it("shows the overview once for a new player and leaves returning play unobstructed", () => {
    expect(htmlFor(freshRun())).toContain("intro-pages");
    expect(htmlFor(freshRun(), true)).not.toContain("intro-pages");
    expect(htmlFor(work(freshRun()))).not.toContain("intro-pages");
    expect(renderToStaticMarkup(<GameOverview />)).not.toContain("スピン容量");
    expect(renderToStaticMarkup(<GameOverview fuelEnabled />)).not.toContain("WORKで補充");
  });
  it("uses one news row in either placement and removes the capacity widget by default", () => {
    const top = htmlFor(configure(freshRun(), { newsPosition: "top" }), true);
    const bottom = htmlFor(
      configure(freshRun(), { newsPosition: "bottom" }),
      true,
    );
    for (const html of [top, bottom]) {
      expect(html.match(/class="news-strip/g)).toHaveLength(1);
      expect(html).not.toContain('class="compute"');
      expect(html).toContain("work-button guide-target");
    }
    expect(top.indexOf('class="news-strip')).toBeLessThan(
      top.indexOf('class="balance-header'),
    );
    expect(bottom.indexOf('class="news-strip')).toBeGreaterThan(
      bottom.indexOf('class="main-tabs'),
    );
    expect(bottom.indexOf('class="news-strip')).toBeLessThan(
      bottom.indexOf('class="play-dock'),
    );
    expect(
      htmlFor(configure(freshRun(), { fuelEnabled: true }), true),
    ).toContain('class="compute"');
  });
});
