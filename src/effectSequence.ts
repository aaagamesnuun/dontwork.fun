// Schedule one step at a time. A stalled tab never catches up with a burst,
// and cancellation always owns the sole pending timer, including result audio.
export function effectSequence<T>(
  items: readonly T[],
  duration: number,
  period: number,
  callbacks: {
    start: (item: T, index: number) => void;
    result: (item: T) => void;
    done: () => void;
    active: () => boolean;
  },
  delay = 0,
) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const finish = () => {
    if (!cancelled) {
      cancelled = true;
      callbacks.done();
    }
  };
  const active = () => {
    if (cancelled) return false;
    if (!callbacks.active()) {
      finish();
      return false;
    }
    return true;
  };
  const step = (index: number) => {
    if (!active()) return;
    if (index >= items.length) {
      finish();
      return;
    }
    const item = items[index];
    callbacks.start(item, index);
    if (cancelled) return;
    timer = setTimeout(() => {
      if (!active()) return;
      callbacks.result(item);
      if (cancelled) return;
      timer = setTimeout(
        () => step(index + 1),
        index === items.length - 1 ? 150 : Math.max(0, period - duration),
      );
    }, duration);
  };
  timer = setTimeout(() => step(0), delay);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
