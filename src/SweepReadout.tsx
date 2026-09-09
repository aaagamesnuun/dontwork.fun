import { t as _t } from "./i18n";
import { useLayoutEffect, useSyncExternalStore } from "react";
import type { Settings } from "./game/engine";
import type { SweepFrame } from "./TradingViews";
import { startSweep } from "./sweepMotion";
export type SweepReading = {
    cursor: number | null;
    moving: boolean;
    slowing: boolean;
};
// The number and gold line subscribe to one cosmetic clock. No second random
// route, and no access to the unrevealed result from the numeric readout.
export function createSweepSignal() {
    let value: SweepReading = { cursor: null, moving: false, slowing: false };
    const listeners = new Set<() => void>();
    return {
        read: () => value,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
        update: (cursor: number | null, moving: boolean, slowing: boolean) => {
            value = { cursor, moving, slowing };
            listeners.forEach(listener => listener());
        },
    };
}
export type SweepSignal = ReturnType<typeof createSweepSignal>;
export function useSweepReading(signal: SweepSignal) {
    return useSyncExternalStore(signal.subscribe, signal.read, signal.read);
}
export function SweepMotionDriver({ signal, frame, motion, reduced }: {
    signal: SweepSignal;
    frame: SweepFrame | null;
    motion: Settings["sweepMotion"];
    reduced: boolean;
}) {
    useLayoutEffect(() => startSweep(frame, motion, reduced, signal.update), [signal, frame, motion, reduced]);
    return null;
}
export function SweepReadout({ cursor, moving }: Pick<SweepReading, "cursor" | "moving">) {
    const value = cursor === null ? "—" : String(Math.round(cursor)).padStart(2, "0");
    return <output className={`sweep-readout ${moving ? "rolling" : ""}`} aria-label={moving ? _t("出目を抽選中") : _t("出目 {0}", cursor === null ? _t("未抽選") : Math.round(cursor))}>
    <b>{value}</b>
  </output>;
}
