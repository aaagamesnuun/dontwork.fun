import { trialActive, type Run } from "./game/engine";

// Input time is independent of the simulation clock, including before spin 1.
// Keep one limiter for the mounted game; opening panels must not refill it.
export class WorkInput {
  private accepted: number[] = [];

  accept(run: Run, now = performance.now()): boolean {
    if (!Number.isFinite(now) || !trialActive(run) || run.settings.workMode === "gamble") return false;
    // The human timed mode keeps its existing input rules.
    if (run.trial) return true;
    this.accepted = this.accepted.filter(at => at > now - 1000);
    if (this.accepted.length >= run.settings.workClicksPerSecond) return false;
    this.accepted.push(now);
    return true;
  }
}
