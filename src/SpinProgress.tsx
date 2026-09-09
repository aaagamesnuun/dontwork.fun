import { useSyncExternalStore } from "react";

// The cosmetic charge clock must not re-render the game and its position cards.
export function createProgressSignal() {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    read: () => value,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update: (next: number) => {
      next = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
      if (next === value) return;
      value = next;
      listeners.forEach(listener => listener());
    },
  };
}
export function SpinProgress({ signal }: { signal: ReturnType<typeof createProgressSignal> }) {
  const progress = useSyncExternalStore(signal.subscribe, signal.read, signal.read);
  return <div className="next-spin-track"><i style={{ width: "100%", transform: `scaleX(${progress})`, transformOrigin: "left", transition: "transform 50ms linear" }}/></div>;
}
