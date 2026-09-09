import { t as _t } from "./i18n";
import { SAVE_KEY, type Run } from './game/engine';
import { request } from './api';
import { RANKING_ORIGIN } from './rankings';
const KEY = 'bebullish-ranking-outbox-v1';
type Entry = {
    nickname: string;
    completion: NonNullable<Run['completion']>;
};
export const cleanNickname = (name: string) => Array.from(name.normalize('NFKC').replace(/[\x00-\x1f\x7f]/g, '').trim()).slice(0, 16).join('');
export function readOutbox(): Entry[] { try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows.filter(r => r?.completion?.id && typeof r.nickname === 'string').slice(0, 50) : [];
}
catch {
    return [];
} }
export function saveCompletionName(run: Run, input: string): Run {
    const nickname = cleanNickname(input);
    if (!nickname || !run.completion)
        throw Error(_t("名前を入力してください。"));
    const next = { ...run, completionNickname: nickname };
    // Persist the name and earned record before attempting any network request.
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    if (run.completion.ranked && !run.submitted) {
        const rows = readOutbox().filter(r => r.completion.id !== run.completion!.id);
        localStorage.setItem(KEY, JSON.stringify([...rows, { nickname, completion: run.completion }]));
    }
    return next;
}
let flushing: Promise<string[]> | null = null;
export function flushRankings(): Promise<string[]> {
    if (flushing)
        return flushing;
    flushing = (async () => {
        const completed: string[] = [];
        for (const row of readOutbox()) {
            try {
                await request(RANKING_ORIGIN + '/api/rankings', { ...row.completion, completionId: row.completion.id, nickname: row.nickname });
                localStorage.setItem(KEY, JSON.stringify(readOutbox().filter(r => r.completion.id !== row.completion.id)));
                completed.push(row.completion.id);
            }
            catch { /* Keep pending entries for online/manual retry. */ }
        }
        return completed;
    })().finally(() => { flushing = null; });
    return flushing;
}
export const completionTarget = (run: Run) => { if (!run.completion)
    return 1000000000; const [major, minor] = run.completion.appVersion.split('.').map(Number); return major < 2 || major === 2 && minor < 3 ? 100000000 : 1000000000; };
