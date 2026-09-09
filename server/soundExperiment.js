// Owner-readable experiment aggregate. No public diagnostics endpoint.
export const SOUND_EXPERIMENT = 'sound-default-v1';
export const soundCohortSql = `
WITH assignments AS (
 SELECT player_id, session_id, received_at, sequence,
  json_extract(props_json,'$.soundVariant') AS variant,
  ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY received_at,sequence,event_id) AS rn
 FROM telemetry_events
 WHERE event_name='sound_assignment' AND debug=0
  AND json_extract(props_json,'$.soundExperiment')='sound-default-v1'
  AND json_extract(props_json,'$.soundAssignedAt') >= ? * 1000
), conflicts AS (
 SELECT player_id,COUNT(DISTINCT variant) AS variants FROM assignments GROUP BY player_id
), cohort AS (
 SELECT a.player_id,a.session_id,a.variant,a.received_at AS enrolled,c.variants
 FROM assignments a JOIN conflicts c USING(player_id) WHERE a.rn=1
), activity AS (
 SELECT c.player_id,e.run_id,
  MAX(CASE WHEN e.received_at<c.enrolled+86400 THEN e.active_ms END) - MIN(e.active_ms) AS active24
 FROM cohort c JOIN telemetry_events e ON e.player_id=c.player_id AND e.received_at>=c.enrolled
 WHERE json_extract(e.props_json,'$.soundExperiment')='sound-default-v1'
 GROUP BY c.player_id,e.run_id
), activity_totals AS (
 SELECT player_id,SUM(MAX(0,COALESCE(active24,0))) AS active24 FROM activity GROUP BY player_id
), visits AS (
 SELECT c.player_id,
  MAX(CASE WHEN e.event_name='session_start' AND e.received_at>=c.enrolled+86400 AND e.received_at<c.enrolled+172800
   AND (e.session_id<>c.session_id OR json_extract(e.props_json,'$.entryKind')='resume') THEN 1 ELSE 0 END) AS returned,
  MAX(CASE WHEN json_extract(e.props_json,'$.soundPack')<>c.variant THEN 1 ELSE 0 END) AS switched
 FROM cohort c JOIN telemetry_events e ON e.player_id=c.player_id AND e.received_at>=c.enrolled
 WHERE json_extract(e.props_json,'$.soundExperiment')='sound-default-v1' GROUP BY c.player_id
)
SELECT c.variant,c.variants,c.enrolled,COALESCE(a.active24,0) AS active24,
 COALESCE(v.returned,0) AS returned,COALESCE(v.switched,0) AS switched
FROM cohort c LEFT JOIN activity_totals a USING(player_id) LEFT JOIN visits v USING(player_id)`;
export function summarizeSoundCohorts(rows,now) {
 const metric=(numerator,eligible,assigned)=>({numerator,eligible,pending:assigned-eligible,rate:eligible?numerator/eligible:null});
 return {experiment:SOUND_EXPERIMENT,generatedAt:now,timingBasis:'server_received_at',cohortWindowDays:28,
  basis:'all_observed_assignments_including_intro_dropout',conflictingAssignments:rows.filter(r=>r.variants!==1).length,
  groups:['terminal','retro-arcade'].map(variant=>{
   const assigned=rows.filter(r=>r.variants===1 && r.variant===variant),day=assigned.filter(r=>now-r.enrolled>=86400),twoDays=assigned.filter(r=>now-r.enrolled>=172800);
   return {variant,assigned:assigned.length,engagement24h:Object.fromEntries([5,10,30].map(minutes=>[`${minutes}min`,metric(day.filter(r=>r.active24>=minutes*60000).length,day.length,assigned.length)])),
    return24to48h:metric(twoDays.filter(r=>r.returned).length,twoDays.length,assigned.length),switchedSound:assigned.filter(r=>r.switched).length};
  })};
}
export async function refreshSoundExperimentReport(db,force=false,now=Math.floor(Date.now()/1000)) {
 const key='experiment:sound-default-v1';
 const last=await db.prepare('SELECT updated_at FROM telemetry_reports WHERE report_key = ?').bind(key).first();
 if(!force && last && now-last.updated_at<300)return;
 const result=await db.prepare(soundCohortSql).bind(now-28*86400).all();
 const payload=summarizeSoundCohorts(result.results??[],now),total=payload.groups.reduce((n,g)=>n+g.assigned,0);
 await db.prepare(`INSERT INTO telemetry_reports (report_key,ruleset_version,sample_size,payload_json,updated_at) VALUES (?,?,?,?,?)
 ON CONFLICT(report_key) DO UPDATE SET sample_size=excluded.sample_size,payload_json=excluded.payload_json,updated_at=excluded.updated_at`)
 .bind(key,SOUND_EXPERIMENT,total,JSON.stringify(payload),now).run();
 return payload;
}
