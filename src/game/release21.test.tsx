import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../App";
import { INTRO_KEY, GameOverview } from "../Onboarding";
import { detectStandalone } from "../Pwa";
import { shouldFollowJackpot } from "../spinTiming";
import { snapshot } from "../api";
import { resultTones } from "../audioPalette";
import { shouldPlayMusic } from "../music";
import { ALL_BETS, CATALOGS, betById } from "./catalog";
import oldPrices from "./fixtures/v20-prices.json";
import { betOdds } from "./odds";
import {
  SAVE_KEY,
  defaultSettings,
  freshRun,
  mem,
  configure,
  priceProfile,
  readSave,
  spin,
  work,
  upgradePrice,
  upgradeDrawPrice,
  type Upgrade,
  type Run,
} from "./engine";

afterEach(() => vi.unstubAllGlobals());
const ready = (): Run => ({
  ...freshRun(),
  cash: 1e7,
  peak: 1e7,
  portfolio: [{ id: "edge-50", count: 1 }],
  running: true,
});

describe("v2.1 continuity and onboarding", () => {
  it("restores every v2.0 price and reduces growth without reducing first prices", () => {
    for (const catalog of CATALOGS) {
      const s = {
        ...freshRun(catalog.id),
        jackpots: 1,
        settings: { ...defaultSettings, fuelEnabled: true },
      };
      const old = configure(s, priceProfile("v20"));
      for (const [name, rows] of Object.entries(oldPrices.upgrades)) {
        const u = name as Upgrade;
        let previous = 0;
        for (const [i, row] of rows.entries()) {
          const factor =
            catalog.id === "longgame" && ["slots", "trim", "rush"].includes(u)
              ? 80
              : 1;
          const expected = catalog.id === "curated" && u === "speed" ? null : row.price === null ? null : row.price * factor;
          const level = u === "trim" && row.price !== null ? row.level - 1 : row.level;
          const original = upgradePrice({ ...old, [u]: level }, u);
          const current = upgradePrice({ ...s, [u]: level }, u);
          expect(original, `${catalog.id} ${u} ${row.level}`).toBe(expected);
          if (current !== null) {
            expect(current).toBeGreaterThanOrEqual(previous);
            expect(current).toBeLessThanOrEqual(original!);
            if (i === 0) expect(current).toBe(original);
            previous = current;
          } else expect(original).toBeNull();
        }
      }
      for (const row of oldPrices.upgradeDrawPrices) {
        expect(upgradeDrawPrice({ ...old, upgradeDraws: row.draws })).toBe(
          row.price,
        );
        expect(
          upgradeDrawPrice({ ...s, upgradeDraws: row.draws })!,
        ).toBeLessThanOrEqual(row.price!);
      }
    }
  });
  it("adopts the new baseline once without losing progress or an old clear", () => {
    const saved = {
      ...work(ready()),
      economyRevision: 6,
      spent: 12345,
      speed: 14,
      trim: 3,
      rush: 4,
      rushLeft: 19,
      removed: 12,
      completion: {
        id: crypto.randomUUID(),
        appVersion: "2.0.0",
        rulesetVersion: "astra-v6:classic",
        catalog: "classic",
        timeMs: 123000,
        spins: 42,
        ranked: true,
      },
      settings: { ...defaultSettings, speedPriceMultiplier: 1.25 },
    };
    delete (saved.settings as Partial<typeof saved.settings>).economyProfile;
    const restored = readSave(JSON.stringify(saved))!;
    expect(restored).toMatchObject({
      spent: 12345,
      speed: 14,
      trim: 2,
      rush: 4,
      rushLeft: 19,
      removed: 12,
      running: false,
      debug: true,
      completion: saved.completion,
    });
    expect(restored.cash).toBe(saved.cash);
    expect(restored.id).not.toBe(saved.id);
    expect(restored.settings.speedPriceMultiplier).toBe(1.2);
    expect(readSave(JSON.stringify(restored))?.id).toBe(restored.id);
    expect(
      readSave(
        JSON.stringify({
          ...saved,
          settings: { ...saved.settings, speedPriceMultiplier: 1.33 },
        }),
      )?.settings.speedPriceMultiplier,
    ).toBe(1.33);
    expect(
      configure(freshRun(), {
        bassMode: true,
        jackpotMusic: "on",
        jackpotAutoTab: false,
      }).debug,
    ).toBe(false);
    const old = configure(restored, priceProfile("v20"));
    expect(old.spent).toBe(restored.spent);
    expect(readSave(JSON.stringify(old))?.settings).toEqual(old.settings);
    for (const patch of [
      { bassMode: 1 },
      { jackpotAutoTab: "no" },
      { jackpotMusic: "bad" },
      { economyProfile: "bad" },
    ])
      expect(
        readSave(
          JSON.stringify({
            ...freshRun(),
            settings: { ...defaultSettings, ...patch },
          }),
        ),
      ).toBeNull();
  });
  it("requires installation on mobile browsers and skips it on desktop or installed apps", () => {
    const s = freshRun();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === SAVE_KEY ? JSON.stringify(s) : null),
    });
    vi.stubGlobal("navigator", { userAgent: "iPhone CriOS/143", platform: "iPhone", maxTouchPoints: 5, standalone: false });
    const browser = renderToStaticMarkup(<App />);
    expect(browser).toContain("install-welcome");
    expect(browser).not.toContain("intro-pages");
    for (const navigator of [
      { userAgent: "Macintosh Chrome", platform: "MacIntel", maxTouchPoints: 0 },
      { userAgent: "Windows Chrome", platform: "Win32", maxTouchPoints: 10 },
    ]) {
      vi.stubGlobal("navigator", navigator);
      const desktop = renderToStaticMarkup(<App />);
      expect(desktop).toContain("intro-pages");
      expect(desktop).not.toContain("install-welcome");
    }
    vi.stubGlobal("navigator", { standalone: true });
    expect(detectStandalone()).toBe(true);
    const pwa = renderToStaticMarkup(<App />);
    expect(pwa).toContain("intro-pages");
    expect(pwa).not.toContain("install-welcome");
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === INTRO_KEY ? "1" : JSON.stringify(s)),
    });
    expect(renderToStaticMarkup(<App />)).not.toContain("intro-pages");
    vi.stubGlobal("navigator", { userAgent: "Windows Chrome", platform: "Win32", maxTouchPoints: 0 });
    const returningDesktop = renderToStaticMarkup(<App />);
    expect(returningDesktop).not.toContain("install-welcome");
    expect(returningDesktop).not.toContain("intro-pages");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked storage");
      },
    });
    expect(renderToStaticMarkup(<App />)).toContain("intro-pages");
    const overview = renderToStaticMarkup(<GameOverview />);
    expect(overview).toContain("1ビリオン");
    expect(overview).not.toContain("WORKで補充");
  });
});

describe("v2.1 result-following and odds", () => {
  it("follows only a current Jackpot reveal and leaves infinity navigation free", () => {
    const before = ready(),
      jp = spin(before, 100, 0);
    expect(shouldFollowJackpot(before, jp, jp)).toBe(true);
    expect(
      shouldFollowJackpot(before, jp, configure(jp, { jackpotAutoTab: false })),
    ).toBe(false);
    expect(shouldFollowJackpot(before, jp, jp, true)).toBe(false);
    expect(shouldFollowJackpot(before, jp, freshRun())).toBe(false);
    expect(shouldFollowJackpot(before, jp, { ...jp, last: null })).toBe(false);
    const normal = spin(before, 60, 0);
    expect(shouldFollowJackpot(before, normal, normal)).toBe(false);
    const near = { ...before, rushLeft: 20, removed: 98, trim: 1 };
    const infinite = spin(near, 100, 0);
    expect(shouldFollowJackpot(near, infinite, infinite)).toBe(true);
    const pulse = spin(infinite, 100, 0);
    expect(shouldFollowJackpot(infinite, pulse, pulse)).toBe(false);
  });
  it("distinguishes a small ladder hit from a profitable win and respects current cuts", () => {
    const s = freshRun();
    expect(betOdds(s, betById("edge-50"))).toMatchObject({ hit: 50, win: 50 });
    expect(betOdds(s, betById("flow-1"))).toMatchObject({ hit: 80, win: 0 });
    const memory = { "flow-1": { ...mem(s, "flow-1"), streak: 7 } };
    expect(betOdds({ ...s, memory }, betById("flow-1"))).toMatchObject({
      hit: 80,
      win: 80,
    });
    expect(betOdds(s, betById("step-4"))).toMatchObject({ hit: 0, win: 0 });
    expect(
      betOdds(
        { ...s, memory: { "step-4": { ...mem(s, "step-4"), armed: true } } },
        betById("step-4"),
      ),
    ).toMatchObject({ hit: 1, win: 1 });
    expect(
      betOdds({ ...s, rushLeft: 20, removed: 50 }, betById("edge-50")),
    ).toMatchObject({ hit: 100, win: 100 });
    expect(
      betOdds(
        { ...s, memory: { "risk-1": { ...mem(s, "risk-1"), misses: 1 } } },
        betById("risk-1"),
      ),
    ).toMatchObject({ hit: 80, win: 0 });
    expect(betOdds(s, betById("linear-1"))).toMatchObject({
      hit: 100,
      win: 62,
    });
    const prior = JSON.stringify(s);
    for (const b of ALL_BETS) {
      const odds = betOdds(s, b);
      expect(odds.win).toBeGreaterThanOrEqual(0);
      expect(odds.win).toBeLessThanOrEqual(odds.hit);
      expect(odds.hit).toBeLessThanOrEqual(100);
    }
    expect(JSON.stringify(s)).toBe(prior);
  });
});

describe("v2.1 sound choices", () => {
  it("keeps bass bounded and respects zero gain for losses and global volume", () => {
    const s = { ...defaultSettings, bassMode: true };
    expect(resultTones("win", s).some((t) => t.frequency < 100)).toBe(true);
    expect(
      resultTones("loss", { ...s, lossVolume: 0 }).every((t) => t.gain === 0),
    ).toBe(true);
    expect(
      resultTones("jackpot", { ...s, soundVolume: 0 }).every(
        (t) => t.gain === 0,
      ),
    ).toBe(true);
    expect(
      resultTones("jackpot", s, 1e8).every(
        (t) => Number.isFinite(t.gain) && t.gain < 0.1,
      ),
    ).toBe(true);
    expect(
      snapshot(
        configure(freshRun(), {
          bassMode: true,
          jackpotMusic: "on",
          jackpotAutoTab: false,
        }),
      ),
    ).toMatchObject({
      bassMode: true,
      jackpotMusic: "on",
      jackpotAutoTab: false,
      economyProfile: "v24",
    });
  });
  it("can play only during Jackpot or suppress Jackpot music while retaining normal BGM", () => {
    expect(shouldPlayMusic(defaultSettings, true)).toBe(false);
    const only = { ...defaultSettings, jackpotMusic: "on" as const };
    expect(shouldPlayMusic(only, false)).toBe(false);
    expect(shouldPlayMusic(only, true)).toBe(true);
    const outside = {
      ...defaultSettings,
      music: true,
      jackpotMusic: "off" as const,
    };
    expect(shouldPlayMusic(outside, false)).toBe(true);
    expect(shouldPlayMusic(outside, true)).toBe(false);
  });
});
