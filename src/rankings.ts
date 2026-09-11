import { sharedServiceOrigin } from "./serviceConfig";
import type { RankingPeriod, PeriodInfo } from "./RankingPeriod";
import { t as _t } from "./i18n";
// Keep this origin fixed in future releases; game/telemetry Sites may change.
export const RANKING_ORIGIN = sharedServiceOrigin();
export const rankingPath = (version = "all", offset = 0, period:RankingPeriod = "all") => `${RANKING_ORIGIN}/api/rankings?version=${encodeURIComponent(version)}&offset=${offset}&period=${period}`;
export const rankingVersion = (version: string) => version === "pe-legacy" ? _t("PE旧版") : `v${version}`;
export interface RankingScore {
    id: number;
    nickname: string;
    appVersion: string;
    rulesetVersion: string;
    catalog: string;
    timeMs: number;
    spins: number;
    createdAt: string;
}
export interface RankingPage extends PeriodInfo {
    averageTimeMs: number | null;
    scores: RankingScore[];
    total: number;
    offset: number;
    pageSize: number;
    versions: string[];
}
