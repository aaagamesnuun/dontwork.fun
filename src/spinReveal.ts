import { trialActive } from "./game/engine";
import type { Presentation } from "./presentation";

type RevealJob = {
  runId: string;
  spinId: number;
  dueAt: number;
  reveal: (recovered: boolean) => void;
};

// The timeout is the normal path. The existing game ticker can also release
// an overdue result, without rolling again or depending on animation/audio.
export class SpinReveal {
  private job: RevealJob | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private current: () => Presentation) {}

  get dueAt() { return this.job?.dueAt ?? 0; }

  schedule(runId: string, spinId: number, delay: number, reveal: RevealJob["reveal"]) {
    this.cancel();
    const job = { runId, spinId, dueAt: performance.now() + delay, reveal };
    this.job = job;
    if (delay <= 0) this.finish(job, false);
    else this.timer = setTimeout(() => this.finish(job, false), delay);
  }

  check(now = performance.now()) {
    // Allow the normal timeout to run first when callbacks share a frame.
    return this.job && now >= this.job.dueAt + 250 ? this.finish(this.job, true) : false;
  }

  cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.job = null;
  }

  private finish(job: RevealJob, recovered: boolean) {
    if (this.job !== job) return false;
    this.cancel();
    const { run, pending } = this.current();
    if (!pending || run.id !== job.runId || run.last?.id !== job.spinId || !trialActive(run)) return false;
    job.reveal(recovered);
    return true;
  }
}
