import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLookEntry, differentLook } from './lookStartup';
import { GAME_LOOKS } from './gameLooks';
import { advanceTrial, configure, finish, freshRun, freshTrial, readSave, resumeTrial, SAVE_KEY, TARGET, TRIAL_MS, type Run } from './game/engine';
import { NORMAL_SLOT, switchTrialMode, TRIAL_SLOT } from './trialSaves';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('random appearance at page entry', () => {
  it('draws once per document and retains later manual choices across game remounts', () => {
    const draw = vi.fn(() => .5), enter = createLookEntry(draw);
    const original = configure({ ...freshRun(), cash: 765, peak: 765, work: 42 }, { look: 'receipt', randomLookOnOpen: true });
    const entered = enter(original);
    expect(entered.settings.look).not.toBe(original.settings.look);
    expect(entered).toEqual({ ...original, settings: { ...original.settings, look: entered.settings.look } });
    expect(enter(entered)).toBe(entered);

    const manual = configure(entered, { look: 'futures' });
    const remounted = readSave(JSON.stringify(manual))!;
    expect(enter(remounted)).toBe(remounted);
    expect(remounted.settings.look).toBe('futures');
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('waits until a new page entry when enabled during a session', () => {
    const draw = vi.fn(() => 0), enter = createLookEntry(draw);
    const original = configure(freshRun(), { look: 'collage' });
    expect(enter(original)).toBe(original);
    const enabled = configure(original, { randomLookOnOpen: true });
    expect(enter(enabled)).toBe(enabled);
    expect(draw).not.toHaveBeenCalled();

    const reopened = readSave(JSON.stringify(enabled))!;
    const next = createLookEntry(draw)(reopened);
    expect(next.settings.look).not.toBe('collage');
    expect(next.id).toBe(original.id);
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('keeps the selected appearance after the option is disabled and the game is reopened', () => {
    const selected = configure(freshRun(), { look: 'broadcast', randomLookOnOpen: true });
    const saved = readSave(JSON.stringify(configure(selected, { randomLookOnOpen: false })))!;
    const draw = vi.fn(() => .8);
    expect(createLookEntry(draw)(saved)).toBe(saved);
    expect(saved.settings.look).toBe('broadcast');
    expect(draw).not.toHaveBeenCalled();
  });

  it.each(GAME_LOOKS)('offers every other look and never repeats $id', ({ id }) => {
    const choices = GAME_LOOKS.filter(look => look.id !== id).map(look => look.id);
    const draws = choices.map((_, index) => differentLook(id, (index + .5) / choices.length));
    expect(new Set(draws)).toEqual(new Set(choices));
    for (const sample of [-1, 0, 1, 2, NaN, Infinity]) {
      const look = differentLook(id, sample);
      expect(choices).toContain(look);
      expect(look).not.toBe(id);
    }
  });
});

describe('appearance preference save compatibility and ranking eligibility', () => {
  it.each([undefined, null, 'true', 'false', 1, 0, {}])('defaults legacy or invalid opt-in %j to off without losing progress', value => {
    const original = { ...freshRun(), cash: 950, peak: 950, work: 55 };
    const saved = { ...original, settings: { ...original.settings, look: 'instrument', randomLookOnOpen: value } };
    expect(readSave(JSON.stringify(saved))).toMatchObject({
      id: original.id, cash: 950, work: 55, debug: false,
      settings: { look: 'instrument', randomLookOnOpen: false },
    });
  });

  it('retains the boolean preference and ranked completion in both game modes', () => {
    const original = { ...freshRun(), cash: 12000, peak: 12000, work: 73 };
    const enabled = configure(original, { randomLookOnOpen: true });
    expect(enabled).toEqual({ ...original, settings: { ...original.settings, randomLookOnOpen: true } });
    const ordinary = createLookEntry(() => .7)(readSave(JSON.stringify(enabled))!);
    expect(finish({ ...ordinary, cash: TARGET }).completion?.ranked).toBe(true);
    expect(ordinary.settings.randomLookOnOpen).toBe(true);

    const trial = createLookEntry(() => .3)(freshTrial(ordinary.settings));
    const finished = advanceTrial(resumeTrial(trial, 1000), 1000 + TRIAL_MS);
    expect(finished.trial?.result?.ranked).toBe(true);
    expect(readSave(JSON.stringify(finished))).toMatchObject({
      debug: false, settings: { look: trial.settings.look, randomLookOnOpen: true },
      trial: { result: finished.trial!.result },
    });
  });
});

describe('appearance stays shared when changing game modes', () => {
  it('restores each wallet and clock while retaining the active appearance preference', () => {
    const normal = configure({ ...freshRun(), cash: 700, peak: 800, work: 21, spent: 100 }, { look: 'broadcast', randomLookOnOpen: true });
    const trial: Run = {
      ...freshTrial(), cash: 1200, peak: 1400, work: 32, spent: 200,
      trial: { ...freshTrial().trial!, elapsedMs: 123000, started: true },
    };
    localStorage.setItem(TRIAL_SLOT, JSON.stringify(trial));

    const entered = switchTrialMode(normal, 'trial', undefined, 200000);
    expect(entered).toMatchObject({
      id: trial.id, cash: 1200, peak: 1400, work: 32, spent: 200, debug: false,
      trial: { elapsedMs: 123000, paused: true },
      settings: { look: 'broadcast', randomLookOnOpen: true },
    });
    expect(readSave(localStorage.getItem(NORMAL_SLOT))).toMatchObject({ id: normal.id, cash: 700, work: 21, spent: 100 });
    expect(readSave(localStorage.getItem(SAVE_KEY))?.settings).toMatchObject({ look: 'broadcast', randomLookOnOpen: true });

    const changed = configure(entered, { look: 'collage', randomLookOnOpen: false });
    const restored = switchTrialMode(changed, 'normal', undefined, 201000);
    expect(restored).toMatchObject({
      id: normal.id, cash: 700, peak: 800, work: 21, spent: 100, debug: false, trial: null,
      settings: { look: 'collage', randomLookOnOpen: false },
    });
    expect(readSave(localStorage.getItem(SAVE_KEY))?.settings).toMatchObject({ look: 'collage', randomLookOnOpen: false });
    expect(readSave(localStorage.getItem(TRIAL_SLOT))).toMatchObject({ id: trial.id, cash: 1200, trial: { elapsedMs: 123000 } });
  });

  it('carries appearance into new modes and does not redraw when switching back', () => {
    const draw = vi.fn(() => .9), enter = createLookEntry(draw);
    const normal = enter(configure({ ...freshRun(), cash: 456, peak: 456 }, { randomLookOnOpen: true }));
    const trial = enter(switchTrialMode(normal, 'trial', 'fixed', 1000));
    expect(trial.cash).toBe(0);
    expect(trial.settings).toMatchObject({ look: normal.settings.look, randomLookOnOpen: true });
    expect(trial.debug).toBe(false);
    const restored = enter(switchTrialMode(trial, 'normal', undefined, 2000));
    expect(restored).toMatchObject({ id: normal.id, cash: 456, settings: { look: normal.settings.look, randomLookOnOpen: true } });
    expect(draw).toHaveBeenCalledTimes(1);
  });
});
