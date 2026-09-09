import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { chartGeometry, PayoffSweep, WealthChart } from "../TradingViews";
import { guidance } from "./guidance";
import {
  appendHistory,
  configure,
  defaultSettings,
  freshRun,
  HISTORY_LIMIT,
  MAX_CHART_SPINS,
  readSave,
  work,
  type Run,
} from "./engine";
const runWithHistory = (spins: number): Run => ({
  ...freshRun(),
  settings:{...defaultSettings,chartWindowSpins:100},
  spins,
  cash: 1000,
  peak: 1000,
  history: Array.from({ length: spins + 1 }, (_, spin) => ({
    spin,
    at: spin * 500,
    cash: 100 + spin,
    kind: spin ? "spin" : "start",
  })),
});
describe("v1.9 recent chart", () => {
  it("defaults to 200 spins and validates LAB bounds without changing ranking eligibility", () => {
    expect(defaultSettings.chartWindowSpins).toBe(200);
    expect(defaultSettings.chargeSound).toBe("off");
    for (const n of [1, 50, 100, 1000]) {
      const s = configure(freshRun(), { chartWindowSpins: n });
      expect(s.debug).toBe(false);
      expect(readSave(JSON.stringify(s))?.settings.chartWindowSpins).toBe(n);
    }
    for (const n of [0, 1.5, 1001, "100"])
      expect(
        readSave(
          JSON.stringify({
            ...freshRun(),
            settings: { ...defaultSettings, chartWindowSpins: n },
          }),
        ),
      ).toBeNull();
  });
  it("keeps 100 results plus the left-edge baseline, and all history is still selectable", () => {
    const s = runWithHistory(150);
    const recent = chartGeometry(s),
      all = chartGeometry(s, "all");
    expect(recent.start).toBe(50);
    expect(recent.end).toBe(150);
    expect(recent.coords).toHaveLength(101);
    expect(recent.coords[0].x).toBe(6);
    expect(recent.coords.at(-1)?.x).toBe(994);
    expect(all.start).toBe(0);
    expect(all.coords).toHaveLength(151);
    expect(chartGeometry(work(s))).toEqual(recent);
    expect(renderToStaticMarkup(<WealthChart s={s} />)).toContain("直近100");
    expect(
      renderToStaticMarkup(<WealthChart s={runWithHistory(100)} />),
    ).not.toContain("chart-range-control");
  });
  it("counts spins instead of purchases, uses the same window on the time axis, and contains upgrade drops", () => {
    const s = runWithHistory(150);
    s.history.splice(81, 0, {
      spin: 80,
      at: 40000,
      cash: 10,
      kind: "upgrade",
      spent: 9000,
    });
    const recent = chartGeometry(s);
    expect(recent.coords).toHaveLength(102);
    expect(recent.upgrades).toHaveLength(1);
    expect(recent.upgrades[0].top).toBeGreaterThanOrEqual(0);
    const timed = chartGeometry(configure(s, { chartAxis: "time" }));
    expect(timed.start).toBe(25000);
    expect(timed.end).toBe(75000);
    expect(timed.coords).toEqual(recent.coords);
  });
  it("preserves every recent spin and old extremes through long play and save round trips", () => {
    let history: Run["history"] = [{ spin: 0, at: 0, cash: 0, kind: "start" }];
    for (let spin = 1; spin <= 10000; spin++) {
      history = appendHistory(history, {
        spin,
        at: spin * 500,
        cash: spin === 3 ? 1e8 : spin,
        kind: "spin",
      });
      if (spin % 50 === 0)
        history = appendHistory(history, {
          spin,
          at: spin * 500,
          cash: spin - 1,
          kind: "upgrade",
          spent: 1,
        });
    }
    expect(history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(history[0].spin).toBe(0);
    expect(Math.max(...history.map((p) => p.cash))).toBe(1e8);
    const spins = history
      .filter((p) => p.kind === "spin" && p.spin! >= 10000 - MAX_CHART_SPINS)
      .map((p) => p.spin);
    expect(spins).toEqual(Array.from({ length: 1001 }, (_, i) => 9000 + i));
    expect(history.filter((p) => p.kind === "upgrade")).toHaveLength(200);
    const s = { ...runWithHistory(0), spins: 10000, history };
    expect(readSave(JSON.stringify(s))?.history).toEqual(history);
    expect(chartGeometry(s).start).toBe(9900);
    expect(chartGeometry(s).recordedPeak).toBeLessThan(
      chartGeometry(s, "all").recordedPeak,
    );
  });
  it("uses retained old-save points without inventing missing spin coordinates", () => {
    const s = runWithHistory(4000);
    s.history = [
      { at: 0, cash: 0, kind: "start" },
      { at: 1000, cash: 10, kind: "win" },
    ];
    const old = JSON.parse(JSON.stringify(s));
    delete old.settings.chartWindowSpins;
    const restored = readSave(JSON.stringify(old))!;
    expect(restored.settings.chartWindowSpins).toBe(200);
    expect(chartGeometry(restored).coords).toHaveLength(1);
    expect(chartGeometry(restored).end).toBe(4000);
    expect(restored.history[1].spin).toBeUndefined();
    const sparse = runWithHistory(1000);
    sparse.history = sparse.history.filter((p) =>
      [0, 800, 950, 1000].includes(p.spin!),
    );
    const recent = chartGeometry(sparse);
    expect(recent.start).toBe(900);
    expect(recent.coords).toHaveLength(2);
    expect(recent.coords[0].x).toBeGreaterThan(6);
    expect(recent.coords.at(-1)?.x).toBe(994);
  });
});
describe("v1.9 visual meaning", () => {
  it("alternates the goal and tips each tick, rotates every tick after all unlocks, and keeps blockage instructions", () => {
    const s = {
      ...freshRun(),
      cash: 100,
      peak: 100,
      spins: 20,
      spent:25,
      running: true,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    expect([0, 1, 2, 3].map((t) => guidance(s, t).label)).toEqual([
      "GOAL",
      "TIP",
      "GOAL",
      "TIP",
    ]);
    const all = { ...s, peak: 1e10 };
    expect(
      new Set([0, 1, 2, 3, 4].map((t) => guidance(all, t).text)).size,
    ).toBe(5);
    expect(guidance({ ...s, cash: 0 }, 3).target).toBe("work");
  });
  it("uses blue payouts and red payments in both Sweep variants without changing amounts", () => {
    for (const style of ["classic", "chart"] as const) {
      const html = renderToStaticMarkup(
        <PayoffSweep
          values={Array.from({ length: 100 }, (_, i) => (i < 50 ? -10 : 20))}
          frame={null}
          reduced
          style={style}
        />,
      );
      expect(html).toContain(style === "classic" ? "青はプラス、赤はマイナス" : "青は配当、赤は支払");
      if (style === "chart") expect(html).toContain('fill="#70b8ff"');
    }
  });
});
