import { t as _t } from "./i18n";
import { SAVE_KEY, type Run, type TrialResult } from './game/engine';
import { cleanNickname } from './rankingOutbox';
import { request } from './api';
import { RANKING_ORIGIN } from './rankings';
import type { RankingPeriod } from './RankingPeriod';
const KEY = 'bebullish-30m-outbox-v1';
export const trialRankingPath = (version = 'all', offset = 0, scoring='assets', period:RankingPeriod='all') => RANKING_ORIGIN + '/api/bankroll-rankings?scoring='+encodeURIComponent(scoring)+'&version=' + encodeURIComponent(version) + '&offset=' + offset+'&period='+period;
type Entry = {
    nickname: string;
    result: TrialResult;
};
export function readTrialOutbox(): Entry[] { try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows.filter(r => r?.result?.id && typeof r.nickname === 'string') : [];
}
catch {
    return [];
} }
export function saveTrialName(run: Run, input: string): Run {
    const nickname = cleanNickname(input), t = run.trial;
    if (!nickname || !t?.result)
        throw Error(_t("名前を入力してください。"));
    const next = { ...run, trial: { ...t, nickname } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    if (t.result.ranked && !t.submitted) {
        const rows = readTrialOutbox().filter(r => r.result.id !== t.result!.id);
        localStorage.setItem(KEY, JSON.stringify([...rows, { nickname, result: t.result }]));
    }
    return next;
}
let flushing: Promise<string[]> | null = null;
export function flushTrialScores(): Promise<string[]> {
    if (flushing)
        return flushing;
    flushing = (async () => {
        const ids: string[] = [];
        for (const row of readTrialOutbox()) {
            try {
                await request(RANKING_ORIGIN + '/api/bankroll-rankings', { ...row.result, scoreId: row.result.id, nickname: row.nickname });
                localStorage.setItem(KEY, JSON.stringify(readTrialOutbox().filter(r => r.result.id !== row.result.id)));
                ids.push(row.result.id);
            }
            catch {
                break; /* Persist until the next online/manual retry. */
            }
        }
        return ids;
    })().finally(() => { flushing = null; });
    return flushing;
}
