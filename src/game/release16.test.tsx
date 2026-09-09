import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../App";
import { chartGeometry, PayoffSweep, WealthChart } from "../TradingViews";
import { ruleset, snapshot } from "../api";
import { cueTones } from "../audioPalette";
import { roamingCursor } from "../sweepMotion";
import { spinTiming } from "../spinTiming";
import { MusicSettings } from "../MusicSettings";
import { CATALOGS, betById } from "./catalog";
import {
  appendHistory,
  configure,
  defaultSettings,
  drawUpgrade,
  firstBet,
  freshRun,
  nextDistribution,
  payoutOf,
  purchase,
  readSave,
  spin,
  work,
  type Run,
} from "./engine";
afterEach(() => vi.unstubAllGlobals());
describe("v1.6 opening and save continuity", () => {
  it.each(CATALOGS)(
    "uses the intended opening payout and ruleset for $id",
    (c) => {
      const base = freshRun(c.id),
        b = betById(firstBet(base));
      const s = {
        ...base,
        cash: 100,
        peak: 100,
        portfolio: [{ id: b.id, count: 1 }],
      };
      const original = ["classic", "legacy"].includes(c.id),
        payout = original ? 30 : 25;
      expect(payoutOf(b, s)).toBe(payout);
      expect(
        nextDistribution(s).reduce<number>((n, p) => n + (p ?? 0), 0) / 100,
      ).toBe(original ? 5 : 2.5);
      expect(spin(s, 51).last?.payout).toBe(payout);
      expect(ruleset(s)).toBe(`astra-v13:${c.id}`);
      expect(payoutOf(b, configure(s, { opening: 20 }))).toBe(50);
    },
  );
  it("keeps the two-win route to the first new gamble in House Mix", () => {
    const s = {
      ...freshRun("curated"),
      cash: 10,
      peak: 10,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    expect(spin(spin(s, 51), 51).cash).toBe(40);
  });
  it("persists music/motion without marking experiments and respects old muted saves", () => {
    const s = configure(freshRun(), {
      music: true,
      musicPack: "night",
      musicVolume: 0.25,
      sweepMotion: "roam",
    });
    expect(readSave(JSON.stringify(s))?.settings).toEqual(s.settings);
    expect(s.debug).toBe(false);
    expect(snapshot(s)).toMatchObject({
      music: true,
      musicPack: "night",
      musicVolume: 0.25,
      sweepMotion: "roam",
    });
    const old = JSON.parse(JSON.stringify(s));
    delete old.settings.music;
    old.economyRevision = 4;
    old.settings.sound = true;
    expect(readSave(JSON.stringify(old))?.settings.music).toBe(false);
    old.settings.sound = false;
    expect(readSave(JSON.stringify(old))?.settings.music).toBe(false);
    for (const patch of [
      { musicVolume: -1 },
      { musicVolume: 2 },
      { musicPack: "bad" },
      { sweepMotion: "bad" },
    ])
      expect(
        readSave(
          JSON.stringify({ ...s, settings: { ...s.settings, ...patch } }),
        ),
      ).toBeNull();
  });
  it("marks imported progress from the previous payout as a comparison run", () => {
    const old = JSON.parse(
      JSON.stringify({ ...freshRun(), spins: 10, cash: 100 }),
    );
    delete old.economyRevision;
    expect(readSave(JSON.stringify(old))?.debug).toBe(true);
    expect(
      readSave(JSON.stringify({ ...old, catalog: "classic" }))?.debug,
    ).toBe(true);
    expect(readSave(JSON.stringify({ ...old, spins: 0 }))?.debug).toBe(false);
  });
});
describe("v1.6 right-edge chart and spending", () => {
  it.each(["spins", "time"] as const)(
    "keeps the latest point at the right edge on %s",
    (chartAxis) => {
      let s = {
        ...freshRun(),
        cash: 200,
        peak: 200,
        settings: { ...defaultSettings, chartAxis },
        portfolio: [{ id: "edge-50", count: 1 }],
      };
      s = spin(s, 51, 1000);
      const geometry = chartGeometry(s);
      expect(geometry.coords.at(-1)?.x).toBe(994);
      expect(chartGeometry(work(s))).toEqual(geometry);
      s = purchase({ ...s, activeMs: 2500 }, "speed");
      const chart = chartGeometry(s);
      expect(chart.upgrades[0]).toMatchObject({
        x: 994,
        spent: 25,
        cash: s.cash,
      });
      expect(chart.upgrades[0].top).toBeLessThan(chart.upgrades[0].y);
      expect(chart.end).toBe(chartAxis === "time" ? 2500 : 1);
      const html = renderToStaticMarkup(<WealthChart s={s} />);
      expect(html).toContain("upgrade-marker");
      expect(html).not.toContain("chart-caption");
      expect(html).not.toContain("wealth-y-axis");
    },
  );
  it("records gacha spending and retains upgrade markers through long-run compression", () => {
    const s = drawUpgrade(
      {
        ...freshRun(),
        cash: 1000,
        peak: 1000,
        settings: { ...defaultSettings, upgradeMode: "gacha" },
      },
      () => 0,
    );
    expect(s.history.at(-1)).toMatchObject({
      kind: "upgrade",
      spent: 25,
      cash: 975,
    });
    let history: Run["history"] = [{ at: 0, spin: 0, cash: 0, kind: "start" }];
    for (let i = 1; i <= 10000; i++)
      history = appendHistory(history, {
        at: i * 1000,
        spin: i,
        cash: i === 111 ? 1e8 : i,
        kind: i % 50 === 0 ? "upgrade" : "win",
        ...(i % 50 === 0 ? { spent: 25 } : {}),
      });
    expect(history.length).toBeLessThanOrEqual(1800);
    expect(history.filter((p) => p.kind === "upgrade")).toHaveLength(200);
    expect(history.some((p) => p.cash === 1e8)).toBe(true);
    expect(history.at(-1)?.spin).toBe(10000);
    expect(
      readSave(JSON.stringify({ ...s, spins: 10000, history }))?.history,
    ).toEqual(history);
  });
});
describe("v1.6 immediate sensory feedback", () => {
  it("moves only during the triggered spin reveal and respects cuts", () => {
    const values = Array.from({ length: 100 }, (_, i) => (i < 60 ? null : i));
    for (const motion of ["roam", "slow"])
      for (let i = 1; i < 100; i++) {
        const x = roamingCursor(i / 100, 5000, values, motion, 3);
        expect(x).toBeGreaterThanOrEqual(61);
        expect(x).toBeLessThanOrEqual(100);
      }
    expect(roamingCursor(0.99, 5000, values, "slow", 3)).not.toBe(
      roamingCursor(0.99, 5000, values, "roam", 3),
    );
    const before = {
      ...freshRun(),
      settings: {...freshRun().settings,revealPacing:"adaptive" as const},
      cash: 100,
      peak: 100,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    const after = spin(before, 100);
    expect(spinTiming(before, after)).toEqual({
      revealDelay: 700,
      holdForResult: true,
    });
    expect(
      spinTiming(before, {
        ...after,
        settings: { ...after.settings, sweepMotion: "classic" },
      }).revealDelay,
    ).toBe(700);
    const html = renderToStaticMarkup(
      <PayoffSweep values={values} frame={null} reduced={false} />,
    );
    expect(html).not.toContain("is-spinning");
    expect(
      renderToStaticMarkup(
        <PayoffSweep values={values} frame={null} reduced />,
      ),
    ).not.toContain("is-spinning");
  });
  it.each([
    "terminal",
    "retro-arcade",
    "soft",
    "crystal",
    "arcade",
    "wood",
    "impact",
  ] as const)("keeps Work audible without overpowering a spin in %s", (soundPack) => {
    const s = { ...defaultSettings, soundPack };
    const work = cueTones("work", s),
      spin = cueTones("spin", s);
    expect(Math.max(...work.map((t) => t.gain))).toBeLessThan(
      Math.max(...spin.map((t) => t.gain)) * 0.9,
    );
    expect(Math.max(...work.map((t) => t.duration))).toBeLessThanOrEqual(0.055);
  });
  it("removes redundant panels and exposes independent music controls", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(freshRun()),
    });
    const html = renderToStaticMarkup(<App />);
    for (const text of [
      "market-stats",
      "chart-caption",
      "wealth-y-axis",
      "種 HIT",
      "買えるだけ",
    ])
      expect(html).not.toContain(text);
    expect(html).toMatch(/<small>期待値<\/small>[\s\S]*?<small>最大配当<\/small>[\s\S]*?<small>賭け金<\/small>[\s\S]*?<small>スピン周期<\/small>/);
    expect(html).not.toContain('auto-interval');
    expect(html).not.toContain('header-roll');
    expect(html).toContain("screen-flash");
    const music = renderToStaticMarkup(
      <MusicSettings s={freshRun()} change={() => {}} />,
    );
    expect(music).toContain("BGM音量");
    expect(music).toContain("ジャックポット中の音楽");
    for (const pack of ["pulse", "night", "arcade"])
      expect(music).toContain(`value="${pack}"`);
  });
});
