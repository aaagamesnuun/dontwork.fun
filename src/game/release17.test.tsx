import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../App";
import { PayoffSweep } from "../TradingViews";
import { catalogById, betById } from "./catalog";
import {
  freshRun,
  spin,
  resolve,
  stakeOf,
  canSpin,
  nextDistribution,
  setCount,
  loadPreset,
  readSave,
  type Run,
} from "./engine";
import { sweepSnapshot, barFraction, framePending } from "./sweep";
const funded = (id: string, cash = 1e6): Run => ({
  ...freshRun(id.startsWith("risk") ? "crashes" : "streaks"),
  cash,
  peak: 1e6,
  capacity: 6,
  fuel: 1500,
  portfolio: [{ id, count: 1 }],
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("v1.7 growth economy", () => {
  it("offers 80% separately, retains basic seven and removes recovery gambles from House Mix", () => {
    expect(catalogById("classic").ids).toHaveLength(7);
    expect(
      catalogById("streak80").ids.filter((id) => id.startsWith("flow")),
    ).toHaveLength(4);
    expect(catalogById("curated").ids).not.toContain("step-1");
    expect(catalogById("curated").ids).not.toContain("drought-2");
    expect(catalogById("dryspell").ids).toContain("drought-2");
  });
  it.each([
    ["flow-1", 80, 1.2],
    ["streak-1", 50, 1.25],
  ] as const)(
    "%s has exact continuation and ordinary long-run return",
    (id, count, ratio) => {
      const s = funded(id),
        b = betById(id),
        p = count / 100;
      expect(
        Array.from({ length: 100 }, (_, i) => resolve(s, b, i + 1)).filter(
          (o) => o.payout > 0,
        ),
      ).toHaveLength(count);
      expect(
        (p * (1 - p) * b.payout) / (1 - p * b.multiplier!) / b.stake,
      ).toBeCloseTo(ratio, 10);
    },
  );
  it("80% declines through short wins, then surges; misses lose a fixed stake and reset", () => {
    let s = funded("flow-1"),
      start = s.cash;
    for (let i = 1; i <= 13; i++) {
      s = spin(s, 80);
      expect(s.last!.payout).toBeCloseTo(6 * 1.2 ** (i - 1));
      if (i < 8) expect(s.last!.profit).toBeLessThan(0);
      if (i === 8) expect(s.last!.profit).toBeGreaterThan(0);
      if (i < 13) expect(s.cash).toBeLessThan(start);
    }
    expect(s.cash).toBeGreaterThan(start);
    const loss = spin(s, 1);
    expect(loss.last!.profit).toBe(-20);
    expect(loss.memory["flow-1"].streak).toBe(0);
    expect(spin(loss, 80).last!.payout).toBe(6);
  });
  it("loss streaks escalate paid stakes, cap, reset on a hit, and never borrow", () => {
    let s = funded("risk-1");
    for (const wager of [100, 200, 400, 800, 1600, 3200, 3200]) {
      expect(stakeOf(betById("risk-1"), s)).toBe(wager);
      s = spin(s, 1);
      expect(s.last!.profit).toBe(-wager);
    }
    s = spin(s, 80);
    expect(s.last!.payout).toBe(200);
    expect(s.last!.wager).toBe(3200);
    expect(stakeOf(betById("risk-1"), s)).toBe(100);
    s = funded("risk-1", 2000);
    for (let i = 0; i < 4; i++) s = spin(s, 1);
    expect(s.cash).toBe(500);
    expect(canSpin(s)).toBe(false);
    expect(spin(s, 1)).toBe(s);
  });
  it("cannot erase loss escalation by unequipping, using presets, or saving", () => {
    let s = spin(spin(funded("risk-1"), 1), 1);
    s = setCount(setCount(s, "risk-1", -1), "risk-1", 1);
    expect(stakeOf(betById("risk-1"), s)).toBe(400);
    s = loadPreset(
      { ...s, presets: [[], [{ id: "risk-1", count: 1 }], []] },
      0,
    );
    s = loadPreset(s, 1);
    expect(stakeOf(betById("risk-1"), readSave(JSON.stringify(s))!)).toBe(400);
  });
  it("forks old economic runs once and retires removed positions without losing cash", () => {
    const old = {
      ...freshRun("curated"),
      economyRevision: 3,
      spins: 10,
      cash: 1500,
      peak: 2000,
      portfolio: [{ id: "drought-2", count: 1 }],
    };
    const next = readSave(JSON.stringify(old))!;
    expect(next).toMatchObject({
      cash: 1500,
      debug: true,
      economyRevision: 13,
      portfolio: [],
    });
    expect(next.id).not.toBe(old.id);
    expect(readSave(JSON.stringify(next))!.id).toBe(next.id);
  });
});

describe("v1.7 proportional Sweep", () => {
  it("grows red linearly while blue and its scale remain fixed, including Jackpot cuts", () => {
    const s = funded("flow-1"),
      a = sweepSnapshot(s),
      b = sweepSnapshot(spin(s, 80));
    expect(b.scale).toBe(a.scale);
    expect(b.bars[79]!.payout / a.bars[79]!.payout).toBeCloseTo(1.2);
    expect(b.bars[0]!.cost).toBe(a.bars[0]!.cost);
    expect(barFraction(0, a.scale)).toBe(0);
    expect(barFraction(12, a.scale) / barFraction(6, a.scale)).toBe(2);
    const rush = sweepSnapshot({ ...s, rushLeft: 10, removed: 20 });
    expect(rush.scale).toBe(a.scale);
    expect(rush.bars.slice(0, 20).every((v) => v === null)).toBe(true);
    expect(rush.growth[0].detail).toContain("継続100%");
  });
  it("shows both the payout and the cost, including mixed portfolios and penalties", () => {
    const s = {
      ...funded("risk-1"),
      slots: 3,
      portfolio: [
        { id: "risk-1", count: 1 },
        { id: "flow-1", count: 2 },
      ],
    };
    const state = spin(s, 1),
      snapshot = sweepSnapshot(state),
      profits = nextDistribution(state);
    snapshot.bars.forEach((v, i) =>
      expect(v!.payout - v!.cost).toBeCloseTo(profits[i]!),
    );
    const legacy = { ...funded("black-swan-song"), catalog: "legacy" as const };
    const bar = sweepSnapshot(legacy).bars[0]!;
    expect(bar.cost).toBe(
      stakeOf(betById("black-swan-song"), legacy) +
        resolve(legacy, betById("black-swan-song"), 1).penalty,
    );
  });
  it("holds old amounts and streak status during reveal, then shows the grown next spin", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const s = funded("flow-1"),
      after = spin(s, 80),
      frame = {
        id: 1,
        roll: 80,
        values: nextDistribution(s),
        snapshot: sweepSnapshot(s),
        at: 1000,
        duration: 260,
      };
    const render = () =>
      renderToStaticMarkup(
        <PayoffSweep
          values={nextDistribution(after)}
          snapshot={sweepSnapshot(after)}
          frame={frame}
          reduced={false}
        />,
      );
    expect(framePending(frame, false)).toBe(true);
    expect(render()).toContain("0連勝");
    vi.setSystemTime(1260);
    expect(framePending(frame, false)).toBe(false);
    expect(render()).toContain("1連勝");
    expect(render()).toContain("次の配当 $7.2");
    expect(framePending(frame, true, 1000)).toBe(false);
  });
  it("marks overflow honestly and keeps extreme gains finite", () => {
    const s = {
      ...funded("flow-1"),
      memory: {
        "flow-1": { streak: 3000, misses: 0, previous: 80, armed: false },
      },
    };
    for (const style of ["classic", "chart"] as const) {
      const html = renderToStaticMarkup(
        <PayoffSweep
          values={nextDistribution(s)}
          snapshot={sweepSnapshot(s)}
          frame={null}
          reduced
          style={style}
        />,
      );
      expect(html).toContain(style === "classic" ? "flow-payout clipped" : "l3.75 -5l3.75 5");
      expect(html).not.toContain("NaN");
      expect(html).not.toContain("Infinity");
    }
  });
  it("explains active growth on the spin screen", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(funded("flow-1")),
    });
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("八割倶楽部");
    expect(html).toContain("継続80%");
    expect(html).toContain("当たるたび×1.2");
  });
});
