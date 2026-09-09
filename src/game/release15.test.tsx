import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import App from "../App";
import { snapshot } from "../api";
import {
  JACKPOT_INTERVALS,
  configure,
  defaultSettings,
  freshRun,
  interval,
  readSave,
  spin,
} from "./engine";
afterEach(() => vi.unstubAllGlobals());
describe("v1.5 Jackpot tempo", () => {
  it.each(JACKPOT_INTERVALS)(
    "uses %ims only during Jackpot, preserving payouts and granted spins",
    (ms) => {
      const base = {
        ...freshRun("classic"),
        cash: 1e5,
        peak: 1e5,
        fuel: 10,
        portfolio: [{ id: "edge-50", count: 1 }],
        settings: { ...defaultSettings, spinSpeedScale: 0.5 },
      };
      const configured = configure(base, { jackpotSpinIntervalMs: ms });
      expect(interval(configured)).toBe(interval(base));
      const hit = spin(configured, 100);
      expect(hit.rushLeft).toBe(20);
      expect(interval(hit)).toBe(ms);
      const repeated = spin(hit, 100);
      expect(repeated.activeMs - hit.activeMs).toBe(ms);
      expect(repeated.rushLeft).toBe(20);
      expect(repeated.cash - hit.cash).toBe(
        spin(
          { ...hit, settings: { ...hit.settings, jackpotSpinIntervalMs: 100 } },
          100,
        ).cash - hit.cash,
      );
      const ended = spin({ ...hit, rushLeft: 1 }, 51);
      expect(interval(ended)).toBe(interval(base));
      expect(snapshot(hit).jackpotSpinIntervalMs).toBe(ms);
    },
  );
  it("defaults earlier saves to 100ms and rejects invalid saved intervals", () => {
    const old = JSON.parse(
      JSON.stringify({ ...freshRun(), economyRevision: 4 }),
    );
    delete old.settings.jackpotSpinIntervalMs;
    expect(readSave(JSON.stringify(old))?.settings.jackpotSpinIntervalMs).toBe(
      100,
    );
    for (const ms of [0, -100, 150, 1001, "500"])
      expect(
        readSave(
          JSON.stringify({
            ...old,
            settings: { ...old.settings, jackpotSpinIntervalMs: ms },
          }),
        ),
      ).toBeNull();
  });
  it("preserves selected tempo and comparison eligibility through load and standard reset", () => {
    const custom = configure(freshRun(), { jackpotSpinIntervalMs: 500 });
    expect(custom.debug).toBe(true);
    const loaded = readSave(JSON.stringify({ ...custom, debug: false }))!;
    expect(loaded.settings.jackpotSpinIntervalMs).toBe(500);
    expect(loaded.debug).toBe(true);
    expect(configure(loaded, { jackpotSpinIntervalMs: 100 }).debug).toBe(true);
    expect(freshRun().debug).toBe(false);
  });
  it("orders the spin stage above the wealth chart and both above the control dock", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(freshRun()),
    });
    const html = renderToString(<App />);
    expect(html.indexOf('class="roll-station')).toBeLessThan(
      html.indexOf('class="wealth-chart'),
    );
    expect(html.indexOf('class="wealth-chart')).toBeLessThan(
      html.indexOf('class="play-dock'),
    );
  });
});

import { spinTiming } from "../spinTiming";
describe("Jackpot result timing across tempo transitions", () => {
  it("finishes a slow final Rush result before returning to a faster normal period", () => {
    const before = {
      ...freshRun(),
      speed: 100,
      rushLeft: 1,
      cash: 10000,
      peak: 10000,
      portfolio: [{ id: "edge-50", count: 1 }],
      settings: {
        ...defaultSettings,
        revealPacing: "adaptive" as const,
        jackpotSpinIntervalMs: 1000 as const,
        spinSpeedScale: 0.5,
        revealDurationMs: 420 as const,
      },
    };
    const after = spin(before, 51);
    expect(interval(after)).toBe(250);
    expect(spinTiming(before, after)).toEqual({
      revealDelay: 420,
      holdForResult: true,
    });
  });
  it("holds the initial Jackpot reveal and skips revealing for fast Rush or reduced motion", () => {
    const before = {
      ...freshRun("classic", {
        ...defaultSettings,
        revealPacing: "adaptive" as const,
        jackpotSpinIntervalMs: 100,
      }),
      cash: 10000,
      peak: 10000,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    const jackpot = spin(before, 100);
    expect(spinTiming(before, jackpot)).toEqual({
      revealDelay: 700,
      holdForResult: true,
    });
    expect(spinTiming(jackpot, spin(jackpot, 100))).toEqual({
      revealDelay: 0,
      holdForResult: false,
    });
    expect(
      spinTiming(before, {
        ...jackpot,
        settings: { ...jackpot.settings, motion: "reduced" },
      }),
    ).toEqual({ revealDelay: 0, holdForResult: false });
  });
});
