import { canSpin, type Run } from "./game/engine";

/** Only resumes ordinary play while the owning view is ready and visible. */
export function resumeAutomaticPlay(run: Run, now: number, ready: boolean, visible: boolean, held = false): Run {
  if (!run.settings.autoAlwaysOn || run.trial || run.running || run.background || run.backgroundJackpot || !ready || !visible || held || !canSpin(run)) return run;
  return {...run,running:true,startedAt:run.startedAt ?? now};
}
