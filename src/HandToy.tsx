import { t as _t } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { uiSound } from "./audio";
import { haptic } from "./feedback";
import type { Settings } from "./game/engine";
export type HandToy = Exclude<Settings["dockToy"], "off">;
export const HAND_TOYS = [
    ["tap", "TAP", "連打で音が育つ"],
    ["beat", "BEAT", "リズムに合わせる"],
    ["charge", "CHARGE", "長押しして放す"],
] as const;
export function HandToyButton({ mode, settings, onEarn, runId }: {
    mode: HandToy;
    settings: Settings;
    onEarn: () => boolean;
    runId: string;
}) {
    const [feedback, setFeedback] = useState("+$1"), [pressed, setPressed] = useState(false);
    const started = useRef<number | null>(null), last = useRef(0), combo = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pointer = useRef<number | null>(null);
    const reset = () => { pointer.current = null; if (timer.current)
        clearTimeout(timer.current); started.current = null; combo.current = 0; last.current = 0; setPressed(false); };
    useEffect(() => { reset(); setFeedback("+$1"); const hide = () => { if (document.hidden)
        reset(); }; document.addEventListener("visibilitychange", hide); return () => { if (timer.current)
        clearTimeout(timer.current); document.removeEventListener("visibilitychange", hide); }; }, [mode, runId]);
    const tap = () => {
        if (!onEarn()) return;
        const now = performance.now(), gap = now - last.current;
        if (mode === "beat") {
            const perfect = last.current > 0 && Math.abs(gap - 600) <= 130;
            combo.current = perfect ? combo.current + 1 : 0;
            setFeedback(perfect ? `PERFECT ×${combo.current}` : "600ms / BEAT");
            uiSound(perfect ? "win" : "work", { ...settings, soundPack: perfect ? "arcade-pinball" : settings.soundPack });
        }
        else {
            combo.current = gap < 500 ? combo.current + 1 : 1;
            setFeedback(`TAP ×${combo.current}`);
            uiSound("work", { ...settings, soundPack: (["arcade-coinop", "crystal", "arcade-pinball", "arcade-synth"] as const)[Math.floor(combo.current / 4) % 4] });
        }
        last.current = now;
        haptic("work", settings);
    };
    const start = () => { if (started.current !== null)
        return; started.current = performance.now(); setPressed(true); setFeedback("CHARGING"); uiSound("work", settings); timer.current = setTimeout(() => { setFeedback("RELEASE!"); uiSound("equip", settings); }, 600); };
    const release = () => { const at = started.current; if (at === null)
        return; const held = performance.now() - at; reset(); if (held >= 600 && onEarn()) {
        setFeedback("+$1 · RELEASE!");
        uiSound("win", settings);
        haptic("win", settings);
    }
    else
        setFeedback(_t("長押し → 放す")); };
    return <button id="work-button" className={`work-button hand-toy toy-${mode} ${pressed ? "charging" : ""}`} data-ui-cue="handled" aria-label={_t("{0} {1}で1ドル", mode.toUpperCase(), mode === "charge" ? _t("長押しして放す") : _t("タップ"))} onPointerDown={event => { if (mode === "charge" && started.current === null) {
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        start();
    } }} onPointerUp={event => { if (mode === "charge" && pointer.current === event.pointerId)
        release(); }} onPointerCancel={reset} onLostPointerCapture={reset} onBlur={reset} onKeyDown={event => { if (mode === "charge" && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (!event.repeat)
            start();
    } }} onKeyUp={event => { if (mode === "charge" && ["Enter", " "].includes(event.key)) {
        event.preventDefault();
        if (pointer.current === null)
            release();
    } }} onClick={() => { if (mode !== "charge")
        tap(); }}>
    <span>{mode.toUpperCase()}<i className="toy-light" aria-hidden="true"/></span><small aria-live="off">{feedback}</small>
  </button>;
}
