// Positions match the public lists, including the stable ID tie-breaker.
// Each lookup is one SQLite statement: the record and both ranks share a snapshot.
export async function clearRecordRank(db, recordId, afterId = 0) {
  return db.prepare(`SELECT r.completion_id AS recordId,r.nickname,r.app_version AS appVersion,r.ruleset_version AS rulesetVersion,
    1+(SELECT COUNT(*) FROM clear_records q WHERE q.id>? AND (q.time_ms<r.time_ms OR (q.time_ms=r.time_ms AND q.id<r.id))) AS overallRank,
    1+(SELECT COUNT(*) FROM clear_records q WHERE q.id>? AND q.app_version=r.app_version AND (q.time_ms<r.time_ms OR (q.time_ms=r.time_ms AND q.id<r.id))) AS versionRank
    FROM clear_records r WHERE r.completion_id=? AND r.id>?`).bind(afterId,afterId,recordId,afterId).first();
}
export async function trialRecordRank(db, recordId) {
  return db.prepare(`SELECT r.score_id AS recordId,r.nickname,r.app_version AS appVersion,r.ruleset_version AS rulesetVersion,
    1+(SELECT COUNT(*) FROM bankroll_records q WHERE q.ruleset_version=r.ruleset_version AND (q.final_bankroll>r.final_bankroll OR (q.final_bankroll=r.final_bankroll AND q.id<r.id))) AS overallRank,
    1+(SELECT COUNT(*) FROM bankroll_records q WHERE q.ruleset_version=r.ruleset_version AND q.app_version=r.app_version AND (q.final_bankroll>r.final_bankroll OR (q.final_bankroll=r.final_bankroll AND q.id<r.id))) AS versionRank
    FROM bankroll_records r WHERE r.score_id=? AND r.ruleset_version IN ('astra-v13-30m:classic','astra-v13-30m-assets:classic')`).bind(recordId).first();
}
