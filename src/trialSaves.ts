import { t as _t } from "./i18n";
import { advanceBackground } from "./backgroundPlay";
import { SAVE_KEY, freshRun, freshTrial, pauseTrial, readSave, type Run, type TrialRule } from './game/engine';
export const NORMAL_SLOT = 'bebullish-normal-slot-v1', TRIAL_SLOT = 'bebullish-30m-slot-v1';
export function switchTrialMode(current: Run, mode: 'normal' | 'trial', rule?: TrialRule, now = Date.now()): Run {
    if (!rule && (mode === 'trial') === !!current.trial)
        return current;
    if (current.background) {
        const catchup = advanceBackground(current, now, true, 12000);
        if (!catchup.done)
            throw Error(_t("進行を反映中です。"));
        current = catchup.run;
    }
    const saved = current.trial ? pauseTrial(current, now) : { ...current, running: false, background: null };
    const targetKey = mode === 'normal' ? NORMAL_SLOT : TRIAL_SLOT;
    const stored = readSave(localStorage.getItem(targetKey));
    const next = mode === 'normal' ? (stored && !stored.trial ? stored : freshRun()) : rule ? freshTrial(current.settings, rule) : (stored?.trial ? stored : freshTrial(current.settings));
    // Back up the active game first; failed storage never discards its progress.
    localStorage.setItem(current.trial ? TRIAL_SLOT : NORMAL_SLOT, JSON.stringify(saved));
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    return next;
}
