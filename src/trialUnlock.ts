import { readSave, type Run } from './game/engine';
import { NORMAL_SLOT, TRIAL_SLOT } from './trialSaves';
export const TRIAL_UNLOCK_KEY = 'dontwork-trial-unlocked-v1';
export function trialUnlocked(run: Run, storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage) {
    if ((!run.trial && run.completion) || run.trial) return true;
    try {
        if (!storage) return false;
        if (storage.getItem(TRIAL_UNLOCK_KEY) === '1') return true;
        const normal = readSave(storage.getItem(NORMAL_SLOT));
        const trial = readSave(storage.getItem(TRIAL_SLOT));
        // Players who already used the timed mode keep access after this update.
        return !!(normal?.completion || trial?.trial);
    } catch { return false; }
}
export function rememberTrialUnlock(storage: Pick<Storage, 'setItem'> = localStorage) {
    storage.setItem(TRIAL_UNLOCK_KEY, '1');
}
