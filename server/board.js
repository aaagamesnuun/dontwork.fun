const uuid = v => typeof v==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const cleanName = v => typeof v==='string' ? v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim() : '';
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
async function readBody(request) {
  if(!request.body || !request.headers.get('content-type')?.startsWith('application/json'))return null;
  const reader=request.body.getReader(),chunks=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return null}chunks.push(value)}
    const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}
    return JSON.parse(new TextDecoder().decode(all));
  } catch {return null}
}
function postQuery(where,order) {
  // UUIDs and rate-limit identifiers stay in D1, never in the public response.
  // Rank positions use the same tie-breaker and reset cutoff as the leaderboards.
  return `SELECT p.id,p.parent_id AS parentId,p.nickname,p.body,p.created_at AS createdAt,
    (SELECT COUNT(*) FROM board_posts reply WHERE reply.parent_id=p.id) AS replyCount,
    CASE WHEN c.id IS NULL THEN NULL ELSE 1+(SELECT COUNT(*) FROM clear_records q WHERE q.id>? AND (q.time_ms<c.time_ms OR (q.time_ms=c.time_ms AND q.id<c.id))) END AS normalRank,
    CASE WHEN t.id IS NULL THEN NULL ELSE 1+(SELECT COUNT(*) FROM bankroll_records q WHERE q.ruleset_version=t.ruleset_version AND (q.final_bankroll>t.final_bankroll OR (q.final_bankroll=t.final_bankroll AND q.id<t.id))) END AS trialRank,
    t.ruleset_version AS trialRuleset
    FROM board_posts p LEFT JOIN clear_records c ON c.completion_id=p.clear_record_id AND c.id>?
    LEFT JOIN bankroll_records t ON t.score_id=p.trial_record_id AND t.ruleset_version IN ('astra-v13-30m:classic','astra-v13-30m-assets:classic')
    WHERE ${where} ORDER BY p.id ${order} LIMIT ?`;
}
export async function boardApi(request,db,url,afterId=0) {
  const origin=request.headers.get('origin');
  const allowed=!origin||origin===url.origin||origin==='https://dontwork.fun'||origin==='https://dontwork-fun.ronefire.workers.dev'||origin==='https://bebullish.fun'||/^https:\/\/[a-z0-9-]+\.realnuun\.chatgpt\.site$/.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(origin&&allowed?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if(!allowed)return reply({error:'このページからは送信できません。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:reply(null).headers});
  if(!db)return reply({error:'掲示板に接続できません。'},503);
  try {
    if(request.method==='GET') {
      const thread=Number(url.searchParams.get('thread')??0),cursor=Number(url.searchParams.get('cursor')??0);
      if(!Number.isSafeInteger(thread)||thread<0||!Number.isSafeInteger(cursor)||cursor<0)return reply({error:'表示条件を確認してください。'},400);
      const root=thread?await db.prepare(postQuery('p.id=? AND p.parent_id IS NULL','ASC')).bind(afterId,afterId,thread,1).first():null;
      if(thread&&!root)return reply({error:'投稿が見つかりません。'},404);
      const where=thread?'p.parent_id=? AND p.id>?':'p.parent_id IS NULL'+(cursor?' AND p.id<?':'');
      const params=thread?[thread,cursor]:cursor?[cursor]:[];
      const {results}=await db.prepare(postQuery(where,thread?'ASC':'DESC')).bind(afterId,afterId,...params,21).all();
      const posts=results.slice(0,20);
      return reply({posts,thread:root,nextCursor:results.length>20?posts.at(-1).id:null});
    }
    if(request.method!=='POST')return reply({error:'Method Not Allowed'},405);
    const input=await readBody(request),nickname=cleanName(input?.nickname);
    const body=typeof input?.body==='string'?input.body.replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim():'';
    if(!input||!uuid(input.requestId)||!uuid(input.actorId)||!nickname||Array.from(nickname).length>16||!body||Array.from(body).length>1000||!(input.parentId==null||Number.isSafeInteger(input.parentId)&&input.parentId>0)||[input.clearRecordId,input.trialRecordId].some(id=>id!=null&&!uuid(id)))return reply({error:'名前と本文を確認してください。'},400);
    const actorHash=await digest('board:actor:'+input.actorId),networkHash=await digest('board:network:'+(request.headers.get('CF-Connecting-IP')??input.actorId));
    const prior=await db.prepare('SELECT id,actor_hash AS actorHash,nickname,body,parent_id AS parentId FROM board_posts WHERE request_id=?').bind(input.requestId).first();
    if(prior)return prior.actorHash===actorHash&&prior.nickname===nickname&&prior.body===body&&prior.parentId===(input.parentId??null)?reply({ok:true,id:prior.id,duplicate:true}):reply({error:'投稿内容が変更されています。もう一度送信してください。'},409);
    if(input.parentId!=null&&!await db.prepare('SELECT id FROM board_posts WHERE id=? AND parent_id IS NULL').bind(input.parentId).first())return reply({error:'返信先が見つかりません。'},404);
    const [normal,trial]=await Promise.all([
      input.clearRecordId?db.prepare('SELECT completion_id AS id,nickname FROM clear_records WHERE completion_id=? AND id>?').bind(input.clearRecordId,afterId).first():null,
      input.trialRecordId?db.prepare("SELECT score_id AS id,nickname FROM bankroll_records WHERE score_id=? AND ruleset_version IN ('astra-v13-30m:classic','astra-v13-30m-assets:classic')").bind(input.trialRecordId).first():null,
    ]);
    const clearId=normal&&cleanName(normal.nickname)===nickname?normal.id:null,trialId=trial&&cleanName(trial.nickname)===nickname?trial.id:null;
    const now=Date.now();
    // One conditional INSERT makes concurrent taps obey the same posting limits.
    const result=await db.prepare(`INSERT OR IGNORE INTO board_posts(request_id,parent_id,nickname,body,clear_record_id,trial_record_id,actor_hash,network_hash,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE
      (SELECT COUNT(*) FROM board_posts WHERE actor_hash=? AND created_at>?)<1 AND
      (SELECT COUNT(*) FROM board_posts WHERE actor_hash=? AND created_at>?)<10 AND
      (SELECT COUNT(*) FROM board_posts WHERE network_hash=? AND created_at>?)<60`)
      .bind(input.requestId,input.parentId??null,nickname,body,clearId,trialId,actorHash,networkHash,now,actorHash,now-3000,actorHash,now-60000,networkHash,now-60000).run();
    if(!result.meta?.changes){
      const duplicate=await db.prepare('SELECT id,actor_hash AS actorHash,nickname,body,parent_id AS parentId FROM board_posts WHERE request_id=?').bind(input.requestId).first();
      if(duplicate)return duplicate.actorHash===actorHash&&duplicate.nickname===nickname&&duplicate.body===body&&duplicate.parentId===(input.parentId??null)?reply({ok:true,id:duplicate.id,duplicate:true}):reply({error:'Post changed; retry with a new request ID.'},409);
      return reply({error:'少し時間をおいて、もう一度送ってください。'},429);
    }
    return reply({ok:true,id:Number(result.meta.last_row_id),duplicate:false},201);
  }catch{return reply({error:'掲示板を読み書きできませんでした。もう一度お試しください。'},503)}
}
