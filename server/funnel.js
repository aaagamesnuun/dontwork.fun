// Private aggregate analytics. All projection updates read the immutable accepted
// event, so duplicate IDs (including altered retry payloads) cannot add a visit.
const GAP = 30 * 60 * 1000;
const DAY = 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function sanitizeJourney(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || !UUID.test(value.id)) return undefined;
  const keys = ['start', 'active', 'at', 'play', 'foreground'];
  if (keys.some(k => !Number.isSafeInteger(value[k]) || value[k] < 0)) return undefined;
  if (value.at > now + 300000 || value.at < now - 7 * DAY || value.start > value.active || value.active > value.at
    || value.start < now - 180 * DAY || value.foreground > 30 * DAY
    || (value.play && (value.play < value.start || value.play > value.at))) return undefined;
  if (!['new','saved'].includes(value.origin) || !['ja','en'].includes(value.language)
    || !['mobile','desktop'].includes(value.device) || !['normal','30m'].includes(value.mode)
    || typeof value.version !== 'string' || !/^[\w.:-]{1,80}$/.test(value.version)) return undefined;
  return Object.fromEntries(['id', ...keys, 'origin','language','device','version','mode'].map(k => [k, value[k]]));
}
// A staged release can keep accepting legacy events before the additive
// migration is installed. Missing tables are not an excuse to lose telemetry.
const schemaCache = new WeakMap();
export async function funnelReady(db) {
  const cached=schemaCache.get(db);
  if(cached && cached.until>Date.now()) return cached.ready;
  const row=await db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name IN ('funnel_devices','funnel_segments')").first();
  const ready=Number(row?.n)===2;
  schemaCache.set(db,{ready,until:Date.now()+30000});
  return ready;
}
const columns = ['play_at','intro_at','work_at','spin_at','upgrade_at','jackpot_at','clear_at','second_bet_at'];
export function funnelProjection(db, playerId, event) {
  if (!event.props.journey) return [];
  const j = k => `json_extract(props_json,'$.journey.${k}')`;
  const prop = k => `json_extract(props_json,'$.${k}')`;
  const at = j('at');
  const stage = condition => `CASE WHEN ${condition} THEN ${at} END`;
  const source = `${prop('source')} IS NOT 'background'`;
  const milestone = name => `event_name='milestone' AND ${prop('name')}='${name}'`;
  const from = `FROM telemetry_events WHERE event_id=? AND player_id=? AND session_id=? AND sequence=? AND json_type(props_json,'$.journey')='object'`;
  const args = [event.eventId, playerId, event.sessionId, event.sequence];
  const upserts = columns.map(k => `${k}=CASE WHEN ${k} IS NULL THEN excluded.${k} WHEN excluded.${k} IS NULL THEN ${k} ELSE MIN(${k},excluded.${k}) END`);
  return [
    db.prepare(`INSERT INTO funnel_devices(player_id,first_visit,first_at)
      SELECT player_id,${j('id')},${j('start')} ${from}
      ON CONFLICT(player_id) DO UPDATE SET first_visit=excluded.first_visit,first_at=excluded.first_at
      WHERE excluded.first_at < first_at`).bind(...args),
    db.prepare(`INSERT INTO funnel_segments(player_id,visit_id,session_id,run_id,started_at,last_active_at,event_at,foreground_ms,
      ${columns.join(',')},language,device,version,mode,origin,debug,modal,tab,status)
      SELECT player_id,${j('id')},session_id,run_id,${j('start')},${j('active')},${at},${j('foreground')},
      NULLIF(${j('play')},0),${stage(milestone('intro_complete'))},
      ${stage(`(${milestone('first_work')} OR event_name='work_batch') AND ${source}`)},
      ${stage(`(event_name='spin_batch' OR (${milestone('visit_spin')})) AND ${source}`)},
      ${stage(`event_name='upgrade_purchase' AND ${source}`)},
      ${stage(`((${milestone('first_jackpot')}) OR (event_name='jackpot' AND ${prop('phase')}='start')) AND ${source}`)},
      ${stage(`event_name='clear' AND ${source}`)},${stage(`(${milestone('second_bet')}) AND ${source}`)},
      ${j('language')},${j('device')},${j('version')},${j('mode')},${j('origin')},debug,
      COALESCE(${prop('modal')},'none'),COALESCE(${prop('tab')},'spin'),COALESCE(${prop('gameStatus')},'unknown') ${from}
      ON CONFLICT(player_id,visit_id,session_id,run_id) DO UPDATE SET
      last_active_at=MAX(last_active_at,excluded.last_active_at),event_at=MAX(event_at,excluded.event_at),
      foreground_ms=MAX(foreground_ms,excluded.foreground_ms),debug=MAX(debug,excluded.debug),
      ${upserts.join(',')},
      modal=CASE WHEN excluded.event_at>=event_at THEN excluded.modal ELSE modal END,
      tab=CASE WHEN excluded.event_at>=event_at THEN excluded.tab ELSE tab END,
      status=CASE WHEN excluded.event_at>=event_at THEN excluded.status ELSE status END`).bind(...args),
  ];
}

// First collapse runs within a page (duration is cumulative per page), then pages
// within a visit. Background catch-up never increases the foreground duration.
const visitCTE = `WITH pages AS (
 SELECT s.player_id,s.visit_id,s.session_id,MIN(s.started_at) started_at,MAX(s.last_active_at) last_active_at,
 MAX(s.foreground_ms) foreground_ms,${columns.map(k=>`MIN(s.${k}) ${k}`).join(',')},
 MIN(s.language) language,MIN(s.device) device,MIN(s.version) version,MIN(s.mode) mode,MIN(s.origin) origin,
 MAX(MAX(s.debug,COALESCE(r.debug,0))) debug
 FROM funnel_segments s LEFT JOIN telemetry_runs r ON r.run_id=s.run_id
 GROUP BY s.player_id,s.visit_id,s.session_id
), visits AS (
 SELECT player_id,visit_id,MIN(started_at) started_at,MAX(last_active_at) last_active_at,SUM(foreground_ms) foreground_ms,
 ${columns.map(k=>`MIN(${k}) ${k}`).join(',')},MIN(language) language,MIN(device) device,MIN(version) version,MIN(mode) mode,MIN(origin) origin,MAX(debug) debug
 FROM pages GROUP BY player_id,visit_id
)`;
export const stageLabels = ['訪問を計測','実プレイ開始','スピン到達','ジャックポット発生','クリア'];
export function funnelNarrative(summary, stages, horizon) {
  const pct = (n,d) => d ? `${(100*n/d).toFixed(1)}%` : '—';
  const lines = [];
  if (!summary.devices) return ['条件に合う新方式の記録はまだありません。過去の累計記録から再プレイや離脱を推定せず、これからの実測を待ちます。'];
  lines.push(`初回計測の${summary.devices}ブラウザ中、${summary.players}ブラウザで実プレイを確認しました。${summary.devices-summary.players}ブラウザはプレイ操作を確認できていません。`);
  if (summary.matured) lines.push(`${horizon}時間の観測が完了した${summary.matured}ブラウザ中、${summary.returned}ブラウザ（${pct(summary.returned,summary.matured)}）が時間内に別の訪問で再プレイしました。${summary.matured-summary.returned}ブラウザでは時間内の再プレイを確認できていません。`);
  else lines.push(`${horizon}時間の観測が完了したプレイはまだありません。再プレイ率は観測待ちです。`);
  if(summary.matured) lines.push(`最低${horizon}時間観測できた${summary.matured}ブラウザのうち、現時点まで再プレイが一度も確認できないのは${summary.matured-summary.returnedEver}ブラウザ（${pct(summary.matured-summary.returnedEver,summary.matured)}）です。観測幅を過ぎてから戻ったプレイも再プレイとして除外しています。`);
  lines.push(`初回プレイ訪問が10分未満で、${horizon}時間の観測が完了した${summary.shortMatured}ブラウザのうち、${summary.shortReturned}ブラウザが時間内に再プレイしました。短時間プレイを、そのまま離脱とは数えません。観測待ちは${summary.pending}ブラウザです。`);
  const gaps = stages.slice(1).map((s,i)=>({label:`${stages[i].label} → ${s.label}`, n:stages[i].count-s.count, base:stages[i].count}));
  const biggest = gaps.sort((a,b)=>b.n-a.n)[0];
  if(biggest?.n) lines.push(`初回訪問の主な導線では「${biggest.label}」の次段階未到達が${biggest.n}/${biggest.base}ブラウザで最多です。初回訪問中の到達差であり、再訪後の達成や離脱原因を示す数字ではありません。`);
  if(summary.devices<20) lines.push('対象が20ブラウザ未満のため参考値です。表示・案内・待ち時間などの仮説は、追加の計測で確かめてください。');
  return lines;
}

export async function buildFunnelReport(db, search, now = Date.now()) {
  const days = [7,30,90].includes(Number(search.get('days'))) ? Number(search.get('days')) : 30;
  const horizon = [24,72,168].includes(Number(search.get('horizon'))) ? Number(search.get('horizon')) : 72;
  const choices = { language:['ja','en'],device:['mobile','desktop'],mode:['normal','30m'],origin:['new','saved'] };
  const filters = { days,horizon };
  const where = ['d.first_at>=?','d.first_at<=?','v.debug=0'], values = [now-days*DAY, now];
  for(const [key,allowed] of Object.entries(choices)) {
    filters[key]=allowed.includes(search.get(key))?search.get(key):'all';
    if(filters[key]!=='all'){ where.push(`v.${key}=?`);values.push(filters[key]); }
  }
  const version=search.get('version');
  filters.version=version && /^[\w.:-]{1,80}$/.test(version)?version:'all';
  if(filters.version!=='all'){where.push('v.version=?');values.push(filters.version);}
  const legacySQL=`SELECT COUNT(*) runs,COUNT(DISTINCT player_id) devices,MIN(started_at)*1000 startedAt,MAX(last_seen_at)*1000 latestAt,
      SUM(total_spins>0) spinningRuns,SUM(cleared) clears FROM telemetry_runs WHERE debug=0`;
  if(!await funnelReady(db)) {
    const summary=Object.fromEntries(['devices','players','matured','returned','returnedEver','pending','shortMatured','shortReturned','shortReturnedEver','shortFinished','activeVisits','intro','work','upgrades','secondBet','anyClear'].map(k=>[k,0]));
    return {generatedAt:now,filters,collectionStatus:'schema_pending',coverage:{startedAt:null,measuredDevices:0},summary,
      stages:stageLabels.map(label=>({label,count:0})),languages:[],daily:[],stops:[],versions:[],legacy:await db.prepare(legacySQL).first(),
      insights:['本番の訪問計測テーブルの反映を待っています。従来の累計は取得できています。再プレイ率を0%とは扱いません。'],
      definitions:{visitGapMinutes:30,retentionDays:180,unit:'計測ブラウザ',cohort:'新しい訪問計測は準備中です。',duration:'前面の実プレイ時間を計測します。'}};
  }
  const cutoff=now-horizon*3600000;
  const selectedVisits = visitCTE.replace('GROUP BY s.player_id,s.visit_id,s.session_id', `WHERE s.player_id IN (SELECT player_id FROM funnel_devices WHERE first_at>=${now-days*DAY} AND first_at<=${now}) GROUP BY s.player_id,s.visit_id,s.session_id`);
  const cte = `${selectedVisits}, cohort AS (
    SELECT v.* FROM funnel_devices d JOIN visits v ON v.player_id=d.player_id AND v.visit_id=d.first_visit WHERE ${where.join(' AND ')}
  ), first_play AS (
    SELECT v.*,ROW_NUMBER() OVER(PARTITION BY v.player_id ORDER BY v.play_at,v.visit_id) rn FROM visits v JOIN cohort c ON c.player_id=v.player_id WHERE v.play_at IS NOT NULL
  ), followup AS (
    SELECT p.player_id,
      MAX(CASE WHEN r.started_at>=p.last_active_at+${GAP} AND r.play_at>=p.play_at AND r.play_at<=p.play_at+${horizon*3600000} THEN 1 ELSE 0 END) returned,
      MAX(CASE WHEN r.started_at>=p.last_active_at+${GAP} AND r.play_at>=p.play_at AND r.play_at<=${now} THEN 1 ELSE 0 END) returnedEver
    FROM first_play p LEFT JOIN visits r ON r.player_id=p.player_id AND r.visit_id<>p.visit_id
    WHERE p.rn=1 GROUP BY p.player_id
  ), measured AS (
    SELECT c.*,p.play_at first_play_at,p.foreground_ms first_play_ms,p.last_active_at first_play_last,
      CASE WHEN p.play_at<=${cutoff} THEN 1 ELSE 0 END mature,
      CASE WHEN p.play_at<=${cutoff} THEN COALESCE(f.returned,0) ELSE 0 END returned,
      CASE WHEN p.play_at<=${cutoff} THEN COALESCE(f.returnedEver,0) ELSE 0 END returnedEver,
      CASE WHEN p.foreground_ms<600000 AND p.last_active_at<=${now-GAP} THEN 1 ELSE 0 END short
    FROM cohort c LEFT JOIN first_play p ON p.player_id=c.player_id AND p.rn=1
    LEFT JOIN followup f ON f.player_id=c.player_id
  )`;
  const summarySQL=`SELECT COUNT(*) devices,COUNT(first_play_at) players,
    COALESCE(SUM(mature),0) matured,COALESCE(SUM(returned),0) returned,COALESCE(SUM(returnedEver),0) returnedEver,
    COUNT(first_play_at)-COALESCE(SUM(mature),0) pending,
    COALESCE(SUM(short*mature),0) shortMatured,COALESCE(SUM(short*returned),0) shortReturned,COALESCE(SUM(short*returnedEver),0) shortReturnedEver,
    COALESCE(SUM(short),0) shortFinished,
    COALESCE(SUM(first_play_last>${now-GAP}),0) activeVisits,
    COUNT(play_at) stage1,
    COALESCE(SUM(play_at IS NOT NULL AND spin_at>=play_at),0) stage2,
    COALESCE(SUM(play_at IS NOT NULL AND spin_at>=play_at AND jackpot_at>=spin_at),0) stage3,
    COALESCE(SUM(play_at IS NOT NULL AND spin_at>=play_at AND jackpot_at>=spin_at AND clear_at>=jackpot_at),0) stage4,
    COUNT(intro_at) intro,COUNT(work_at) work,COUNT(upgrade_at) upgrades,COUNT(second_bet_at) secondBet,
    COUNT(clear_at) anyClear FROM measured`;
  const all = async sql => (await db.prepare(`${cte} ${sql}`).bind(...values).all()).results;
  const [totals, languages, daily, stops, coverage, versions, legacy] = await Promise.all([
    all(summarySQL),
    all(`SELECT language,COUNT(*) devices,COUNT(first_play_at) players,SUM(mature) matured,SUM(returned) returned,SUM(short*mature) shortMatured,SUM(short*returned) shortReturned FROM measured GROUP BY language`),
    all(`SELECT date(started_at/1000,'unixepoch','+9 hours') day,COUNT(*) devices,COUNT(first_play_at) players,SUM(mature) matured,SUM(returned) returned FROM measured GROUP BY day ORDER BY day`),
    all(`SELECT COALESCE((SELECT modal FROM funnel_segments s WHERE s.player_id=m.player_id AND s.visit_id=m.visit_id ORDER BY event_at DESC LIMIT 1),'none') modal,
      COALESCE((SELECT status FROM funnel_segments s WHERE s.player_id=m.player_id AND s.visit_id=m.visit_id ORDER BY event_at DESC LIMIT 1),'unknown') status,
      CASE WHEN clear_at IS NOT NULL THEN 'clear' WHEN jackpot_at IS NOT NULL THEN 'jackpot' WHEN spin_at IS NOT NULL THEN 'spin' WHEN play_at IS NOT NULL THEN 'play' ELSE 'arrival' END stage,COUNT(*) count
      FROM measured m WHERE last_active_at<=${now-GAP} AND clear_at IS NULL GROUP BY modal,status,stage ORDER BY count DESC LIMIT 20`),
    db.prepare('SELECT MIN(first_at) startedAt,COUNT(*) measuredDevices FROM funnel_devices').first(),
    db.prepare('SELECT DISTINCT version FROM funnel_segments ORDER BY version DESC LIMIT 40').all().then(r=>r.results.map(x=>x.version)),
    db.prepare(legacySQL).first(),
  ]);
  const summary=totals[0];
  const stages=stageLabels.map((label,i)=>({label,count:Number(i?summary[`stage${i}`]:summary.devices)}));
  return { generatedAt:now,collectionStatus:'ready',filters,coverage,summary,stages,languages,daily,stops,versions,legacy,
    insights:funnelNarrative(summary,stages,horizon), definitions:{ visitGapMinutes:30,retentionDays:180,unit:'計測ブラウザ',cohort:'計測開始後、最初に観測した訪問。セーブ削除前・別端末でのプレイ歴は不明。',duration:'前面でゲームが動作中、または直近2分に入力があった時間。バックグラウンド進行を除く。' } };
}
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Vary':'Authorization'}});
async function analyticsApi(request,env,load) {
  if (!env.ANALYTICS_READ_TOKEN || env.ANALYTICS_READ_TOKEN.length<32) return reply({error:'analytics_not_configured'},503);
  // Hash both strings before comparing to avoid prefix-dependent comparisons.
  const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [provided,expected]=await Promise.all([digest(request.headers.get('Authorization')??''),digest(`Bearer ${env.ANALYTICS_READ_TOKEN}`)]);
  if(provided.reduce((diff,b,i)=>diff|(b^expected[i]),0)!==0) return reply({error:'unauthorized'},401);
  if(request.method!=='GET')return reply({error:'method_not_allowed'},405);
  if(!env.DB)return reply({error:'database_unavailable'},503);
  try{return reply(await load());}
  catch {return reply({error:'analytics_unavailable'},503);}
}

export function funnelApi(request,env,url) {
  return analyticsApi(request,env,()=>buildFunnelReport(env.DB,url.searchParams));
}
export function inquiriesApi(request,env) {
  return analyticsApi(request,env,async()=>{
    const {results}=await env.DB.prepare(`SELECT feedback_id,category,status,display_name,reply_contact,message,app_version,created_at,active_ms,total_spins,total_draws,bankroll FROM feedback_messages ORDER BY created_at DESC,id DESC`).all();
    return {capturedAt:new Date().toISOString(),inquiries:results.map(r=>({
      id:'production:'+r.feedback_id,source:'production',version:r.app_version,
      category:r.category,status:r.status,name:r.display_name,contact:r.reply_contact,
      message:r.message,created:r.created_at,activeMs:r.active_ms,
      spins:r.total_spins,draws:r.total_draws,bankroll:r.bankroll,runId:null
    }))};
  });
}
