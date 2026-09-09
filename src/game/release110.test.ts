import { describe, expect, it } from "vitest";
import {
  configure,
  upgradePrice,
  purchase,
  work,
  TARGET,
  defaultSettings,
  freshRun,
  readSave,
  SWEEP_MOTIONS,
} from "./engine";
import { cueTones, resultTones } from "../audioPalette";
import { chosenMotion, settlingCursor } from "../sweepMotion";
import { spinTiming } from "../spinTiming";

describe("v1.10 audio baseline", () => {
  it("starts silently during charge and migrates inherited charge ticks once", () => {
    expect(defaultSettings).toMatchObject({
      presentationRevision: 1,
      chargeSound: "off",
      spinSound: "rhythm",
      lossVolume: 0.9,
      sweepMotion: "focus",
    });
    const old = {
      ...freshRun(),
      cash: 12345,
      spins: 71,
      rushLeft: 16,
      settings: { ...defaultSettings, chargeSound: "ticks", lossVolume: 0.3 },
    };
    delete (old.settings as Partial<typeof old.settings>).presentationRevision;
    const restored = readSave(JSON.stringify(old))!;
    expect(restored).toMatchObject({
      cash: 12345,
      spins: 71,
      rushLeft: 16,
      debug: false,
      settings: {
        chargeSound: "off",
        lossVolume: 0.9,
        presentationRevision: 1,
      },
    });
    const manual = configure(restored, {
      chargeSound: "rise",
      lossVolume: 0.25,
      spinSound: "original",
    });
    expect(readSave(JSON.stringify(manual))?.settings).toEqual(manual.settings);
    for (const lossVolume of [0, 0.4, 1]) {
      old.settings.lossVolume = lossVolume;
      expect(readSave(JSON.stringify(old))?.settings.lossVolume).toBe(
        lossVolume,
      );
    }
  });
  it("round-trips every new presentation setting without changing ranking eligibility", () => {
    for (const sweepMotion of SWEEP_MOTIONS) {
      const s = configure(freshRun(), { sweepMotion, revealDurationMs: 700 });
      expect(readSave(JSON.stringify(s))?.settings).toEqual(s.settings);
      expect(s.debug).toBe(false);
    }
    for (const bad of [
      { sweepMotion: "wrong" },
      { spinSound: "wrong" },
      { presentationRevision: 9 },
      { revealDurationMs: 701 },
    ])
      expect(
        readSave(
          JSON.stringify({
            ...freshRun(),
            settings: { ...defaultSettings, ...bad },
          }),
        ),
      ).toBeNull();
  });
  it.each([
    "terminal",
    "retro-arcade",
    "soft",
    "crystal",
    "arcade",
    "wood",
    "impact",
  ] as const)(
    "gives every result a simultaneous, audible attack in %s",
    (soundPack) => {
      const s = { ...defaultSettings, soundPack, bassMode: false };
      const win = resultTones("win", s),
        loss = resultTones("loss", s);
      expect(win[0].offset).toBe(0);
      expect(loss[0].offset).toBe(0);
      expect(loss[0].frequency).toBeLessThan(win[0].frequency);
      const peak = (tones: ReturnType<typeof cueTones>) =>
        Math.max(...tones.map((t) => t.gain));
      expect(peak(loss) / peak(win)).toBeCloseTo(0.9);
      expect(peak(loss)).toBeGreaterThan(peak(cueTones("work", s)));
      expect(
        resultTones("loss", { ...s, lossVolume: 0 }).every((t) => t.gain === 0),
      ).toBe(true);
      for (const spinSound of ["rhythm", "original"] as const)
        for (const cue of ["streak", "armed"] as const)
          expect(
            resultTones("loss", { ...s, lossVolume: 0, spinSound }, 1, {
              cue,
              power: 6,
            }).every((t) => t.gain === 0),
          ).toBe(true);
      expect(resultTones("loss", { ...s, spinSound: "original" })).toEqual(
        cueTones("loss", s),
      );
      const accented = resultTones("loss", s, 1, { cue: "streak", power: 7 });
      expect(accented.slice(0, -1)).toEqual(loss);
      expect(accented.at(-1)!.gain).toBeLessThan(peak(loss) / 4);
    },
  );
});

describe("v1.10 converging motion", () => {
  it.each(["focus", "recoil", "lock", "mix"] as const)(
    "keeps %s inside the draw's valid range and lands exactly on its result",
    (motion) => {
      for (const low of [1, 58, 99, 100])
        for (const duration of [120, 250, 260, 420, 700]) {
          for (const roll of new Set([low, Math.round((low + 100) / 2), 100])) {
            const frame = {
              id: roll,
              roll,
              values: Array.from({ length: 100 }, (_, i) =>
                i < low - 1 ? null : 20,
              ),
              at: 0,
              duration,
            };
            for (let i = 0; i <= 200; i++) {
              const x = settlingCursor(i / 200, frame, motion);
              expect(Number.isFinite(x)).toBe(true);
              expect(x).toBeGreaterThanOrEqual(low - 1e-9);
              expect(x).toBeLessThanOrEqual(100 + 1e-9);
            }
            expect(settlingCursor(1, frame, motion)).toBe(roll);
            expect(settlingCursor(2, frame, motion)).toBe(roll);
            for (const q of [0, 0.35, 0.48, 0.73, 0.84]) {
              const p = 0.25 + 0.75 * q;
              expect(
                Math.abs(
                  settlingCursor(p + 1e-8, frame, motion) -
                    settlingCursor(p - 1e-8, frame, motion),
                ),
              ).toBeLessThan(0.001);
            }
          }
        }
    },
  );
  it("mixes by spin ID without changing the route during a spin", () => {
    expect([1, 2, 3, 4].map((id) => chosenMotion("mix", id))).toEqual([
      "recoil",
      "lock",
      "focus",
      "recoil",
    ]);
    const frame = {
      id: 9,
      roll: 80,
      values: Array(100).fill(20),
      at: 0,
      duration: 700,
    };
    for (const p of [0.1, 0.5, 0.9])
      expect(settlingCursor(p, frame, "mix")).toBe(
        settlingCursor(p, frame, "focus"),
      );
  });
  it("uses the same result deadline for motion/audio and never extends fast spins", () => {
    const normal = freshRun();
    const s = configure(normal, { revealDurationMs: 700, revealPacing: "adaptive" });
    expect(spinTiming(s, s).revealDelay).toBe(700);
    expect(spinTiming(s, s, true).revealDelay).toBe(0);
    expect(spinTiming(s, configure(s, { motion: "reduced" })).revealDelay).toBe(
      0,
    );
    for (const ms of [100, 200, 300] as const) {
      const rush = {
        ...configure(s, { jackpotSpinIntervalMs: ms }),
        rushLeft: 20,
      };
      expect(spinTiming(rush, rush).revealDelay).toBe(ms <= 250 ? 0 : 250);
    }
  });
});

describe("v1.10 standard presentation and prices", () => {
  it("applies the requested defaults once and preserves later explicit choices", () => {
    expect(defaultSettings).toMatchObject({
      soundPack: "arcade-coinop",
      newsPosition: "top",
      shake: "strong",
      impactFlash: "bright",
      positionPriceBase: 120,
      positionPriceMultiplier: 10,
      speedPriceBase: 25,
      speedPriceMultiplier: 1.2,
    });
    const old = {
      ...freshRun(),
      economyRevision: 5,
      cash: 3456,
      spins: 52,
      slots: 3,
      speed: 4,
      settings: {
        ...defaultSettings,
        newsPosition: "top",
        shake: "light",
        impactFlash: "soft",
      },
    };
    delete (old.settings as Partial<typeof old.settings>).presentationRevision;
    const migrated = readSave(JSON.stringify(old))!;
    expect(migrated).toMatchObject({
      economyRevision: 13,
      cash: 3456,
      spins: 52,
      slots: 3,
      speed: 4,
      debug: true,
      settings: {
        newsPosition: "top",
        shake: "strong",
        impactFlash: "bright",
      },
    });
    const manual = configure(migrated, {
      newsPosition: "top",
      shake: "off",
      impactFlash: "soft",
    });
    expect(readSave(JSON.stringify(manual))?.settings).toEqual(manual.settings);
  });
});

describe("custom upgrade pricing and durable completion records", () => {
  it("scales all position stages, supports compound growth, preserves caps and marks rule changes", () => {
    const s = { ...freshRun(), cash: 1e12 };
    expect(
      Array.from({ length: 5 }, (_, i) =>
        upgradePrice({ ...s, slots: i + 1 }, "slots"),
      ),
    ).toEqual([120, 1900, 34000, 620000, 12000000]);
    const custom = configure(s, {
      upgradePrices: "exponential",
      positionPriceBase: 50,
      positionPriceMultiplier: 3,
      speedPriceBase: 40,
      speedPriceMultiplier: 1.5,
    });
    expect(custom.debug).toBe(true);
    expect(upgradePrice({ ...custom, slots: 3 }, "slots")).toBe(450);
    expect(upgradePrice({ ...custom, speed: 2 }, "speed")).toBe(90);
    expect(upgradePrice({ ...custom, slots: 12 }, "slots")).toBeNull();
    expect(upgradePrice({ ...custom, speed: 100 }, "speed")).toBeNull();
    expect(purchase(custom, "slots")).toMatchObject({
      cash: s.cash - 50,
      slots: 2,
    });
    expect(readSave(JSON.stringify(custom))?.settings).toEqual(custom.settings);
    for (const bad of [
      { positionPriceBase: 0 },
      { positionPriceMultiplier: 31 },
      { speedPriceBase: 0 },
      { speedPriceMultiplier: 1 },
      { speedPriceMultiplier: Infinity },
    ]) {
      expect(
        readSave(JSON.stringify({ ...s, settings: { ...s.settings, ...bad } })),
      ).toBeNull();
    }
  });
  it("keeps a completion identity and original time after continued play and reload", () => {
    const completed = work({
      ...freshRun(),
      cash: TARGET - 1,
      activeMs: 123456,
      spins: 90,
    });
    expect(completed.completion).toMatchObject({
      id: completed.id,
      appVersion: "3.0.0",
      rulesetVersion: "astra-v13:classic",
      timeMs: 123456,
      spins: 90,
      ranked: true,
    });
    const later = work({ ...completed, activeMs: 234567, spins: 100 });
    expect(later.completion).toEqual(completed.completion);
    expect(readSave(JSON.stringify(later))?.completion).toEqual(
      completed.completion,
    );
  });
  it("keeps long-running game progress even when its completion exceeds posting limits", () => {
    const long = work({
      ...freshRun(),
      cash: TARGET - 1,
      activeMs: 15 * 86400000,
      spins: 100000001,
    });
    expect(long.completion?.ranked).toBe(false);
    expect(readSave(JSON.stringify(long))).toMatchObject({
      cash: TARGET,
      spins: 100000001,
      completion: { ranked: false, timeMs: 15 * 86400000 },
    });
    expect(
      readSave(JSON.stringify({ ...long, completion: { bad: true } })),
    ).toMatchObject({ cash: TARGET, completion: null });
  });
});
