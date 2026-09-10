import { canSpin, spin, pauseTrial, resumeTrial, advanceTrial, trialDeadline, type Run } from "./game/engine";
import { remainingSpinMs, spinTiming } from "./spinTiming";

export const BACKGROUND_MS = 60 * 60 * 1000;
export const BACKGROUND_SPINS = 12000;
export const backgroundSupported = () => typeof navigator !== "undefined" && !!navigator.locks;
export const backgroundAccess = (run:Run) => !run.trial && backgroundSupported() && run.settings.sound && run.settings.soundVolume>0 && run.settings.jackpotNotifications && typeof Notification!=="undefined" && Notification.permission==="granted";
export function holdBackgroundJackpot(run:Run,at:number):Run {
  const stopped=pauseTrial({...run,background:null},at);
  return {...stopped,running:false,background:null,backgroundJackpot:true};
}
export function resumeBackgroundJackpot(run:Run,now:number):Run {
  if (run.trial) return pauseTrial({...run,background:null,backgroundJackpot:false},run.background?.at ?? run.trial.anchor ?? now);
  if(!run.backgroundJackpot)return run;
  const resumed={...run,backgroundJackpot:false,running:true};
  return run.trial?resumeTrial(resumed,now):resumed;
}
export type BackgroundClock = { at: number; remainingMs: number; until: number; spinsLeft: number };

export function startBackground(run: Run, now: number, chargedMs = 0, revealMs = 0): Run {
  if (run.trial) return pauseTrial({...run,background:null,backgroundJackpot:false},now);
  if (!run.settings.backgroundPlay || run.backgroundJackpot || !run.running || (!run.trial && !canSpin(run))) return {...run, background:null};
  return {...run, background:{at:now, remainingMs:Math.max(1,remainingSpinMs(run,chargedMs,revealMs)), until:now+BACKGROUND_MS, spinsLeft:BACKGROUND_SPINS}};
}
// A foreground save records exactly where AUTO could resume if the page is
// killed without a visibility event. A live background clock is never reset.
export function backgroundSave(run: Run, now: number, chargedMs = 0, revealMs = 0) {
  if (run.trial) return {...run,background:null};
  if (!run.settings.backgroundPlay || run.backgroundJackpot) return {...run, background:null};
  return run.background ? run : startBackground(run, now, chargedMs, revealMs);
}

export function advanceBackground(run: Run, now: number, returning: boolean, maxSteps = 100, forced?: number, osReduced = false) {
  const transitions: {before:Run;after:Run}[] = [];
  if (run.trial) return {run:pauseTrial({...run,background:null,backgroundJackpot:false},run.background?.at ?? run.trial.anchor ?? now),transitions,done:true,capped:false};
  if(run.backgroundJackpot)return {run,transitions,done:true,capped:false};
  if (!run.background) return {run:advanceTrial(run,now), transitions, done:true, capped:false};
  if (!run.settings.backgroundPlay || now < run.background.at) return {run:{...run,running:false,background:null},transitions,done:true,capped:false};
  let current = {...run, running:true};
  let clock = {...run.background};
  const deadline=trialDeadline(run);
  const target = Math.min(now, clock.until,deadline);
  let steps = 0;
  while (clock.at < target && canSpin(current) && clock.spinsLeft > 0 && steps < maxSteps) {
    const elapsed = Math.min(clock.remainingMs, target-clock.at);
    current = {...current, activeMs:current.activeMs+elapsed, backgroundMs:current.backgroundMs+elapsed};
    clock.at += elapsed;
    current=advanceTrial(current,clock.at);
    clock.remainingMs -= elapsed;
    if (clock.remainingMs > 0 || current.trial?.result) break;
    const before = current;
    current = spin(current, forced, 0);
    steps++; clock.spinsLeft--;
    transitions.push({before,after:current});
    if(current.last?.jackpot && current.rushLeft > 0){
      current=holdBackgroundJackpot(current,clock.at);
      transitions[transitions.length-1].after=current;
      return {run:current,transitions,done:true,capped:false,remainingMs:clock.remainingMs};
    }
    clock.remainingMs = Math.max(1,remainingSpinMs(current,0,spinTiming(before,current,osReduced).revealDelay));
  }
  const capped = clock.spinsLeft === 0 || clock.at >= clock.until;
  const blocked = !canSpin(current);
  if(blocked && current.trial && !current.trial.result){
    const elapsed=Math.max(0,target-clock.at);current={...current,activeMs:current.activeMs+elapsed,backgroundMs:current.backgroundMs+elapsed};clock.at=target;current=advanceTrial(current,target);
  }
  const done = capped || blocked || clock.at >= target;
  current = {...current, running:!capped && (!blocked || !!current.trial && !current.trial.result), background:done && (returning || capped || blocked && !current.trial) ? null : clock};
  if(done)current=advanceTrial(current,now);
  return {run:current,transitions,done,capped,remainingMs:clock.remainingMs};
}
