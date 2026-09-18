# Appearance: seven alternate looks

The original remains the default. The header's sliders icon opens
見た目・サウンド / Appearance & sound. Its Appearance page switches the current
run immediately and saves the choice in `Settings.look`; Sound retains the full
sound-pack and BGM controls. The rotating news links to the same panel, without
interrupting tutorials or Jackpot messages. The picker is no longer in LAB.

The optional `Settings.randomLookOnOpen` checkbox chooses a different look once
on each page/app launch. It defaults off and does not change the current look
when checked. Reopening a modal, returning from the background, switching game
modes or remounting the desk do not reroll it. Capture Studio and the install
guide do not consume the launch draw. Both game modes share the chosen look and
this preference while retaining their own progress and clocks.

| ID | Art direction | Distinct treatment |
| --- | --- | --- |
| receipt | 感熱紙の億万長者 | Narrow thermal receipt, dashed account rules, monospaced total, red settlement stamp. |
| instrument | 不労所得の計測器 | Enamel housing, dark phosphor displays, mechanical WORK key, instrument warning lamp. |
| typography | 数字が建築になる | Monumental full-width balance, two-level balance composition, hard ink rules, rising typography. |
| desktop | 退職するデスクトップ | Playable OS-style windows, title bars, recessed controls, system-message settlements. |
| broadcast | 自分の資産だけを放送する金融番組 | Personal live channel, blue lower thirds, orange breaking-news strip; two-column desktop layout. |
| collage | 切り貼りされた金融商品 | Different document surfaces for money, probability, history and products; stamped amounts and unfolding ticket. |
| futures | 100通りの未来を折り畳む | Ten accordion leaves over the unchanged 100-face axis; only a published outcome opens a leaf and its result slip. |

Instrument also uses a two-column layout on wide screens. All looks retain the
real WORK, positions, purchases, chance distribution and chart. They do not
change the sound pack, roll stream, prices, timing, ranking eligibility or saved
completion records. Unknown or absent values fall back to `classic` without
rejecting a valid old save. New timed runs inherit the visual preference.

`gameLooks.ts` holds the pure catalogue and normalizer. `LookExperience.tsx` owns
the picker, headings, fold layer and finite-lived reactions. `gameLooks.css`
defines the theme treatments. `App` passes **presentedRun**, not the committed pending result, to
all look components. The fold is unselected during a pending spin. Decorative
motion has no settlement callbacks. Reactions expire, clean up on unmount or
page hiding, and honor both the OS and game reduced-motion preference. Normal
result slips last at most 900 ms; Jackpot slips last 2.4 seconds and ordinary
results cannot immediately overwrite them.

## Validation

- Regression coverage: all eight values round-trip, old/invalid preferences,
  both ranking eligibility paths, look changes plus WORK during a pending spin,
  hidden-result markup equivalence, published endpoint folds, bilingual picker.
- Browser checks: all seven alternatives at 390 × 844; broadcast desktop at
  1280 × 900; futures with full amounts and chart-style sweep at 320 × 740.
- Existing gameplay, save, presentation and server tests remain in the full suite.

## Play checklist

1. Use the header sliders icon to select each look. Compare the structure and text.
2. Tap WORK, change a gamble and open upgrades; the controls remain responsive.
3. Watch losses, wins and Jackpot: stamps, displays, news bands and folded slips
   should appear only when the spin settles.
4. Reload and confirm the selected look and progress remain.
5. Try normal and 30-minute modes, full amounts, and reduced motion.
6. Return to 00 / Original to restore the previous presentation.
7. Enable the random-look checkbox, reload, and confirm a different look with
   the same progress. Leaving and returning to the page must not change it.
8. During Infinity Jackpot, press End JP in the news strip. The accepted spin
   settles once, the chain and its large effects end, and normal spins resume.
   Cash, upgrades and existing clear/ranking records remain.
