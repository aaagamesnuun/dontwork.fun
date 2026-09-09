# Working on dontwork.fun

This is the public, MIT-licensed game repository. These instructions are for Codex and other coding agents; human contributors can start with [CONTRIBUTING.md](CONTRIBUTING.md). Follow the user's task and keep changes focused.

## Read before changing behavior

- [README.md](README.md): run the project and understand fork service defaults.
- [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md): the experience we are trying to create and how to evaluate changes.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): state, presentation, persistence, clocks, APIs, and the source map.
- [docs/LAB.md](docs/LAB.md): current experimental controls, defaults, side effects, and ranking implications.

The guides describe the current implementation, not a promise that every experiment will become a default. When code and a guide disagree, inspect the implementation and tests, then update the affected guide in the same change. Do not infer current behavior from old release test names alone.

## Local workflow

Use Node.js 22.13+ (Worker tests require `node:sqlite`) and npm:

```sh
npm ci
npm run dev
npm test -- src/presentation.test.ts
npm test
npm run build
```

`npm run build` includes TypeScript checking and emits the static site to `dist/client/`. `npm run preview` serves that output. Ordinary game and Worker tests run locally; a Cloudflare account, production credentials, or a live database are not prerequisites.

For behavior changes, add or update meaningful tests, run the relevant tests while iterating, then run `npm test` and `npm run build`. For documentation-only changes, check the claims against source and check relative links; do not add tests that merely repeat prose. Report what was actually checked and any check that could not run.

## Boundaries to preserve

1. **One shared roll, one settlement.** `src/game/engine.ts` owns game state transitions. Keep outcome calculation separate from its reveal in `src/presentation.ts`. Unrevealed winnings, unlocks, counters, and future results must not leak into UI or purchasing decisions. WORK and permitted purchases must remain usable during a reveal.
2. **Existing progress matters.** Preserve local save identities, normal/challenge separation, and already-earned completion metadata. Changes to saves need migration coverage. A new version must not relabel an old clear or silently erase progress.
3. **Rules and presentation have different consequences.** Use the existing `configure`, custom-rule checks, and completion eligibility paths. LAB is not automatically unranked just because its panel was opened. Conversely, returning settings to defaults does not erase an already-set debug flag. See the LAB guide before changing defaults or eligibility.
4. **Clocks have distinct meanings.** Normal active time, foreground time, background catch-up, and the timed challenge deadline are not interchangeable. Keep multi-tab ownership, accepted pending results, and completed trial immutability intact.
5. **Effects do not control money.** Sound, chart animation, particles, and vibration present results. Clean up callbacks on reset, hidden/detached views, and mode changes. Preserve reduced-motion, mute, mobile safe areas, and bounded rendering work.
6. **UI text is bilingual.** Use `src/i18n.ts` and the existing locale files. Bet names have their own preference and dictionary; changing a translated label must not change a stable bet ID.
7. **Forks are independent.** Services and telemetry start disabled on ordinary forks. Opt-in APIs belong to the contributor's own environment. Do not add production credentials, player records, local databases, or private deployment files to commits. Keep `.env.example`, the Wrangler example, and asset credits useful.

## Where changes usually go

| Task | Start here |
| --- | --- |
| Payouts, upgrades, Jackpot, save validation | `src/game/engine.ts`, `src/game/catalog.ts`, related `src/game/*.test.*` |
| Reveal, concurrent WORK/purchases/FLIP | `src/presentation.ts`, `src/presentation.test.ts` |
| LAB control or default | `src/Panels.tsx`, `src/ReleaseLab.tsx`, `src/EffectsLab.tsx`, `src/PriceLab.tsx`, `docs/LAB.md` |
| Challenge or background progression | `src/trialSaves.ts`, `src/backgroundPlay.ts`, `src/game/engine.ts` |
| Sound, particles, mobile performance | `src/audio.ts`, `src/WorkBurst.tsx`, `src/ResultVisuals.ts`, related tests and styles |
| API, telemetry, rankings | `src/api.ts`, `src/serviceConfig.ts`, `server/`, `db/`, `drizzle/` |
| PWA and updates | `src/pwaUpdates.ts`, `scripts/generate-pwa.mjs`, `scripts/service-worker.template.js` |

## Completing a contribution

Explain the problem, resulting behavior, and validation in the PR. Mention save/ranking compatibility when affected. For gameplay or UI changes, include a short manual play checklist with actions and expected results; do not claim browser or phone testing unless performed. Publish or deploy only to the destination covered by the task; normal contributor work does not require modifying the official game's infrastructure.
