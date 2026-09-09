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
// A 10 by 10 faceted sphere: 100 faces around the currently visible roll.
const diceFacets = Array.from({ length: 100 }, (_, i) => {
    const row = Math.floor(i / 10), col = i % 10;
    const point = (r: number, c: number) => { const lat = -Math.PI / 2 + r * Math.PI / 10, lon = c * Math.PI * 2 / 10; return [50 + 42 * Math.cos(lat) * Math.sin(lon), 50 - 42 * Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; };
    const vertices = [point(row, col), point(row, col + 1), point(row + 1, col + 1), point(row + 1, col)];
    return { points: vertices.map(v => v.slice(0, 2).map(n => n.toFixed(2)).join(",")).join(" "), depth: vertices.reduce((sum, v) => sum + v[2], 0) / 4 };
}).sort((a, b) => a.depth - b.depth);
export function SweepReadout({ cursor, moving, display = "dice" }: Pick<SweepReading, "cursor" | "moving"> & {
    display?: "dice" | "number";
}) {
    const value = cursor === null ? "—" : String(Math.round(cursor)).padStart(2, "0");
    return <output className={`sweep-readout ${moving ? "rolling" : ""} ${display === "dice" ? "d100-readout" : ""}`} aria-label={moving ? _t("100面サイコロを回転中") : _t("出目 {0}", cursor === null ? _t("未抽選") : Math.round(cursor))}>
    {display === "dice" && <svg className="d100-facets" viewBox="0 0 100 100" aria-hidden="true">{diceFacets.map((f, i) => <polygon key={i} points={f.points} fill={`hsl(76 36% ${15 + Math.max(0, f.depth) * 19}%)`} stroke="#b5ce7770" strokeWidth=".7"/>)}</svg>}
    <b>{value}</b>{display === "dice" && <small>D100</small>}
  </output>;
}
