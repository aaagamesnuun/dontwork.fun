import { configure, type Run } from './game/engine';
import { GAME_LOOKS, type GameLook } from './gameLooks';

export function differentLook(current: GameLook, sample: number): GameLook {
  const choices = GAME_LOOKS.filter(look => look.id !== current);
  const index = Math.min(choices.length - 1, Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * choices.length)));
  return choices[index].id;
}

/** One entry per document, even when the desktop host remounts the game. */
export function createLookEntry(draw = Math.random) {
  let entered = false;
  return (run: Run): Run => {
    if (entered) return run;
    entered = true;
    return run.settings.randomLookOnOpen
      ? configure(run, { look: differentLook(run.settings.look, draw()) })
      : run;
  };
}

export const enterLookSession = createLookEntry();
