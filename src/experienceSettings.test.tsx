import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExperienceSettings } from './ExperienceSettings';
import { configure, freshRun, freshTrial, setCount, type Run } from './game/engine';
import { GAME_LOOKS } from './gameLooks';
import { guidance } from './game/guidance';
import { setLanguage } from './i18n';

afterEach(() => setLanguage('ja'));

describe('shared appearance and sound settings', () => {
  it.each(['ja', 'en'] as const)('opens with every look and the saved random preference in %s', language => {
    setLanguage(language);
    const s = configure(freshRun(), { look: 'broadcast', randomLookOnOpen: true });
    const html = renderToStaticMarkup(<ExperienceSettings s={s} change={() => {}} onAudioSettings={() => {}}/>);
    expect(html).toContain('class="experience-tabs"');
    expect(html).toContain(language === 'ja' ? '>見た目</button>' : '>Appearance</button>');
    expect(html).toContain(language === 'ja' ? '>サウンド</button>' : '>Sound</button>');
    expect(html).toContain('type="checkbox" checked=""');
    expect(html).toContain(language === 'ja' ? '起動するたびに見た目をランダムにする' : 'random look each time I open the game');
    expect(html.match(/class="look-option look-option-/g)).toHaveLength(GAME_LOOKS.length);
    expect(html).toContain('look-option-broadcast" aria-pressed="true"');
    expect(html).not.toContain('class="sound-pack-picker"');
  });

  it('leaves random appearance opt-in unchecked for a new player', () => {
    const html = renderToStaticMarkup(<ExperienceSettings s={freshRun()} change={() => {}} onAudioSettings={() => {}}/>);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked=""');
    expect(html).toContain('look-option-classic" aria-pressed="true"');
  });
});

const playing = (): Run => setCount({
  ...freshRun(), cash: 1e6, peak: 1e6, spins: 25, work: 20, spent: 100,
  running: true, secondBetTutorial: 'done',
}, 'edge-50', 1);

describe('appearance announcement respects gameplay instructions', () => {
  it('rotates a dedicated appearance notice during ordinary play in both languages', () => {
    for (const language of ['ja', 'en'] as const) {
      setLanguage(language);
      for (const tick of [5, 17]) {
        const guide = guidance(playing(), tick);
        expect(guide).toMatchObject({ key: 'appearance', label: 'STYLE', urgent: false, target: null });
        expect(guide.text).toContain(language === 'ja' ? '見た目とサウンド' : 'look and sound');
      }
      expect(guidance(playing(), 6).key).not.toBe('appearance');
    }
  });

  it('never replaces WORK, funding, equipment, upgrade, or paused-mode instructions', () => {
    const active = playing();
    const cases: [Run, string][] = [
      [freshRun(), 'first-work'],
      [{ ...active, cash: 0 }, 'cash'],
      [{ ...active, portfolio: [] }, 'equip'],
      [{ ...active, spent: 0 }, 'first-upgrade'],
      [freshTrial(active.settings), 'trial'],
    ];
    for (const [run, key] of cases) expect(guidance(run, 5).key).toBe(key);
  });

  it('keeps live Jackpot, next-spin eligibility, and first Jackpot explanations ahead of appearance', () => {
    const active = playing();
    const cases: [Run, string][] = [
      [{ ...active, rushLeft: 20, chain: 3 }, 'jackpot'],
      [{ ...active, jackpotHigh: true }, 'jackpot-ready'],
      [{ ...active, jackpots: 1, spinsSinceJackpot: 2 }, 'jackpot-recap'],
      [{ ...active, spins: 7 }, 'jackpot-intro'],
    ];
    for (const [run, key] of cases) expect(guidance(run, 5).key).toBe(key);
  });
});
