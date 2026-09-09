import { t as _t } from "./i18n";
import { advanceBackground } from './backgroundPlay';
import { SAVE_KEY, pauseTrial, readSave } from './game/engine';
import { NORMAL_SLOT, TRIAL_SLOT } from './trialSaves';
export const NEW_ORIGIN = 'https://dontwork.fun';
export const MIGRATION_KIND = 'dontwork-origin-migration-v1';
export const MIGRATION_BACKUP = 'dontwork-migration-backup-v1';
export const MIGRATION_PENDING = 'dontwork-migration-pending-v1';
export const MIGRATION_APPLIED = 'dontwork-migrations-applied-v1';
export const MIGRATION_CODE = 'dontwork-migration-code-v1';
export function openDomainMigration(code = '') { location.hash = code ? 'migrate=' + code : 'migration'; location.reload(); }
const RUN_KEYS = [SAVE_KEY, NORMAL_SLOT, TRIAL_SLOT];
const OUTBOX_KEYS = ['bebullish-ranking-outbox-v1', 'bebullish-30m-outbox-v1'];
const KEYS = [...RUN_KEYS, ...OUTBOX_KEYS, 'bebullish-intro-seen-v2', 'bebullish-sound-default-v1', 'bebullish-install-id', 'bebullish-telemetry-pending'];
export type Migration = {
    kind: typeof MIGRATION_KIND;
    version: 1;
    createdAt: number;
    entries: Record<string, string>;
};
const allowed = (key: string) => KEYS.includes(key) || /^bebullish-clear-rating-seen:[a-zA-Z0-9-]{1,100}$/.test(key);
export const oldGameOrigin = (origin: string) => ['https://bebullish.fun', 'https://bebullish-production.realnuun.chatgpt.site'].includes(origin);
// Keep internal keys, run IDs and frozen ranking records across the rename.
export function readMigration(raw: string): Migration | null {
    if (raw.length > 2000000)
        return null;
    try {
        const value = JSON.parse(raw);
        if (value?.kind !== MIGRATION_KIND || value.version !== 1 || !Number.isFinite(value.createdAt) || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries))
            return null;
        const entries = Object.entries(value.entries);
        if (!entries.length || !entries.every(([key, entry]) => allowed(key) && typeof entry === 'string'))
            return null;
        for (const key of RUN_KEYS)
            if (value.entries[key] && !readSave(value.entries[key]))
                return null;
        for (const key of OUTBOX_KEYS)
            if (value.entries[key] && !Array.isArray(JSON.parse(value.entries[key])))
                return null;
        return value as Migration;
    }
    catch {
        return null;
    }
}
export function collectMigration(storage: Storage, now = Date.now()): Migration {
    const entries: Record<string, string> = {};
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && allowed(key)) {
            const raw = storage.getItem(key);
            if (raw !== null)
                entries[key] = raw;
        }
    }
    for (const key of RUN_KEYS) {
        if (!entries[key])
            continue;
        const run = readSave(entries[key]);
        if (!run)
            throw Error(_t("セーブを読み取れませんでした。旧画面の保存データは残っています。"));
        const caught = advanceBackground(run, now, true, 12000);
        if (!caught.done)
            throw Error(_t("スピンの進行を反映しています。もう一度お試しください。"));
        entries[key] = JSON.stringify({ ...pauseTrial(caught.run, now), running: false, background: null, backgroundJackpot:false });
    }
    // The active slot is authoritative; mode switching can leave an older copy.
    if (entries[SAVE_KEY]) {
        const active = readSave(entries[SAVE_KEY])!;
        entries[active.trial ? TRIAL_SLOT : NORMAL_SLOT] = entries[SAVE_KEY];
    }
    const value: Migration = { kind: MIGRATION_KIND, version: 1, createdAt: now, entries };
    if (!readMigration(JSON.stringify(value)))
        throw Error(_t("移行できるセーブがないか、データが大きすぎます。"));
    return value;
}
export function freezeMigration(storage: Storage, now = Date.now()) {
    const bundle = collectMigration(storage, now), writes: Record<string, string> = {};
    for (const key of RUN_KEYS)
        if (bundle.entries[key])
            writes[key] = bundle.entries[key];
    writeMigration(storage, writes);
    return bundle;
}
function rollback(storage: Storage, before: Record<string, string | null>) {
    // Release space held by new slots before restoring larger old saves.
    for (const key of Object.keys(before))
        storage.removeItem(key);
    for (const [key, raw] of Object.entries(before))
        if (raw !== null)
            storage.setItem(key, raw);
    storage.removeItem(MIGRATION_PENDING);
}
export function recoverMigration(storage: Storage) {
    if (!storage.getItem(MIGRATION_PENDING))
        return;
    const before = JSON.parse(storage.getItem(MIGRATION_BACKUP) || 'null');
    if (!before || typeof before !== 'object' || Array.isArray(before) || !Object.entries(before).every(([key, value]) => (allowed(key) || [MIGRATION_APPLIED, MIGRATION_CODE].includes(key)) && (typeof value === 'string' || value === null)))
        throw Error(_t("移行前のセーブを復元できませんでした。旧URLのセーブから再度引き継げます。"));
    rollback(storage, before);
}
function writeMigration(storage: Storage, writes: Record<string, string>) {
    recoverMigration(storage);
    const before: Record<string, string | null> = {};
    for (const key of Object.keys(writes))
        before[key] = storage.getItem(key);
    storage.setItem(MIGRATION_BACKUP, JSON.stringify(before));
    storage.setItem(MIGRATION_PENDING, '1');
    try {
        for (const [key, raw] of Object.entries(writes))
            storage.setItem(key, raw);
        storage.removeItem(MIGRATION_PENDING);
    }
    catch (error) {
        rollback(storage, before);
        throw error;
    }
}
function mergedOutbox(a: string | null, b: string) {
    const rows = new Map<string, unknown>();
    for (const raw of [a, b]) {
        if (!raw)
            continue;
        let list: unknown;
        try {
            list = JSON.parse(raw);
        }
        catch {
            continue;
        }
        if (!Array.isArray(list))
            continue;
        for (const row of list) {
            const id = row?.completion?.id ?? row?.result?.id;
            if (typeof id === 'string')
                rows.set(id, row);
        }
    }
    return JSON.stringify([...rows.values()]);
}
export function migrationApplied(storage: Storage, code: string) { try {
    return JSON.parse(storage.getItem(MIGRATION_APPLIED) || '[]').includes(code);
}
catch {
    return false;
} }
export function applyMigration(storage: Storage, value: Migration, code: string) {
    if (migrationApplied(storage, code))
        return false;
    if (!readMigration(JSON.stringify(value)))
        throw Error(_t("移行データを読み取れませんでした。"));
    const writes: Record<string, string> = { ...value.entries };
    for (const key of OUTBOX_KEYS)
        if (writes[key])
            writes[key] = mergedOutbox(storage.getItem(key), writes[key]);
    let previous: string[] = [];
    try {
        const p = JSON.parse(storage.getItem(MIGRATION_APPLIED) || '[]');
        if (Array.isArray(p))
            previous = p.filter(x => typeof x === 'string');
    }
    catch { /* Fresh ledger. */ }
    writes[MIGRATION_APPLIED] = JSON.stringify([...previous, code]);
    writes[MIGRATION_CODE] = code;
    writeMigration(storage, writes);
    return true;
}
export async function withMigrationLock<T>(operation: () => Promise<T>): Promise<T> {
    if (!navigator.locks)
        return operation();
    return navigator.locks.request('bebullish-active-game', { ifAvailable: true }, async (lock) => {
        if (!lock)
            throw Error(_t("別のゲーム画面を閉じてから、もう一度お試しください。"));
        return operation();
    });
}
