import { describe, expect, it } from "vitest";
import { chartGeometry } from "../TradingViews";
import {
  configure,
  defaultSettings,
  freshRun,
  purchase,
  readSave,
  spin,
  work,
} from "./engine";

describe("v1.3 spin-indexed chart", () => {
  it.each(["spins", "time"] as const)(
    "keeps Work off the %s axis until a spin or purchase records the balance",
    (chartAxis) => {
      const base = freshRun("classic", { ...defaultSettings, chartAxis });
      let s = {
        ...base,
        cash: 200,
        peak: 200,
        portfolio: [{ id: "edge-50", count: 1 }],
      };
      s = spin(s, 51, 1000);
      const geometry = chartGeometry(s),
        before = s;
      s = work(s);
      expect(s.history).toBe(before.history);
      expect(chartGeometry(s)).toEqual(geometry);
      s = purchase(s, "speed");
      expect(s.history.at(-1)).toMatchObject({
        kind: "upgrade",
        spent: 25,
        spin: 1,
        cash: s.cash,
      });
      expect(chartGeometry(s).coords.at(-1)?.x).toBe(994);
      const after = spin(s, 100, 1000);
      expect(after.history.at(-1)).toMatchObject({
        cash: after.cash,
        spin: 2,
        at: 2000,
      });
      expect(chartGeometry(after).recordedCash).toBe(after.cash);
    },
  );
  it("retains legacy time points and starts the spin segment at the known saved count", () => {
    const old = {
      ...freshRun(),
      cash: 50,
      peak: 500,
      spins: 30,
      activeMs: 5000,
      history: [
        { at: 0, cash: 0, kind: "start" },
        { at: 1000, cash: 500, kind: "spin" },
        { at: 4000, cash: 50, kind: "work" },
      ],
    };
    const s = readSave(JSON.stringify(old))!;
    expect(s.history.slice(0, 3)).toEqual(old.history);
    expect(chartGeometry(s).coords).toHaveLength(1);
    expect(
      chartGeometry({ ...s, settings: { ...s.settings, chartAxis: "time" } })
        .coords,
    ).toHaveLength(4);
    expect(s.history.at(-1)).toMatchObject({ cash: 50, spin: 30, at: 5000 });
    expect(readSave(JSON.stringify(s))?.history).toEqual(s.history);
  });
  it("persists presentation experiments without changing economic eligibility", () => {
    const s = configure(freshRun(), {
      chartAxis: "time",
      soundPack: "wood",
      soundDensity: "balanced",
      soundVolume: 0.45,
      lossVolume: 0.2,
      shake: "strong",
      impactFlash: "off",
      revealDurationMs: 420,
    });
    expect(s.debug).toBe(false);
    expect(readSave(JSON.stringify(s))?.settings).toEqual(s.settings);
  });
});
