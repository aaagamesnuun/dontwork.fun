import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PayoffSweep } from "../TradingViews";
import { cueTones } from "../audioPalette";
import { configure, defaultSettings, freshRun, readSave } from "./engine";

describe("v1.4 original payoff sweep and sounds", () => {
  it("renders the original compact bars from the actual settled distribution", () => {
    const values = Array(100).fill(-10);
    values[99] = 100;
    const settled = Array(100).fill(20);
    settled[0] = null;
    const html = renderToStaticMarkup(
      <PayoffSweep
        values={values}
        frame={{ id: 1, roll: 100, values: settled, duration: 0, at: 0 }}
        reduced
      />,
    );
    expect(html.match(/<i /g)).toHaveLength(100);
    expect(html).toContain("payoff-reel-bars");
    expect(html).toContain("classic-jackpot-line");
    expect(html).toContain("1: カット済み");
    expect(html).toContain("100: $20");
    expect(html).not.toContain('class="payoff-sweep');
    expect(html).toContain("payoff-scale");
    expect(html).not.toContain("sweep-key");
    expect(html).toContain("sweep-readout");
    expect(
      renderToStaticMarkup(
        <PayoffSweep values={values} frame={null} reduced style="chart" />,
      ),
    ).toContain("<svg");
  });
  it("starts the engine with classic sweep and Terminal before client experiment assignment, and preserves imported sound choices", () => {
    const s = freshRun();
    expect(s.settings).toMatchObject({
      payoffStyle: "classic",
      soundPack: "arcade-coinop",
      chargeSound: "off",
    });
    for (const pack of [
      "terminal",
      "retro-arcade",
      "soft",
      "arcade",
    ] as const) {
      const next = configure(s, {
        soundPack: pack,
        chargeSound: "rise",
        chargeVolume: 0.6,
        payoffStyle: "chart",
      });
      expect(next.debug).toBe(false);
      expect(readSave(JSON.stringify(next))?.settings).toEqual(next.settings);
    }
    const old = JSON.parse(JSON.stringify(freshRun()));
    delete old.settings.chargeSound;
    delete old.settings.chargeVolume;
    delete old.settings.payoffStyle;
    old.settings.soundPack = "crystal";
    expect(readSave(JSON.stringify(old))?.settings).toMatchObject({
      soundPack: "crystal",
      chargeSound: "off",
      payoffStyle: "classic",
    });
  });
  it("uses original Terminal/Arcade/Soft note patterns and keeps modern Arcade separate", () => {
    const terminal = cueTones("loss", {...defaultSettings,soundPack:"terminal"});
    expect(
      terminal.map((n) => [n.frequency, n.wave, n.offset, n.duration]),
    ).toEqual([
      [165, "sawtooth", 0.01, 0.08],
      [105, "triangle", 0.065, 0.13],
    ]);
    const arcade = cueTones("loss", {
      ...defaultSettings,
      soundPack: "retro-arcade",
    });
    expect(arcade.map((n) => n.frequency)).toEqual([206.25, 131.25]);
    const soft = cueTones("loss", { ...defaultSettings, soundPack: "soft" });
    expect(soft.every((n) => n.wave === "sine")).toBe(true);
    expect(soft[0].frequency).toBeCloseTo(135.3);
    expect(
      cueTones("loss", { ...defaultSettings, soundPack: "arcade" }),
    ).not.toEqual(arcade);
  });
});
