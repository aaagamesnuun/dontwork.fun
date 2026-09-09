const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
async function bodyJson(request) {
  if (
    !request.headers.get("content-type")?.startsWith("application/json") ||
    !request.body
  )
    return null;
  const reader = request.body.getReader();
  let raw = "",
    bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export async function bankrollRankingsApi(request, db, url) {
 const origin=request.headers.get('origin');
 if(origin && origin!==url.origin && origin!=='https://bebullish.fun' && origin!=='https://dontwork.fun' && !/^https:\/\/[a-z0-9-]+\.realnuun\.chatgpt\.site$/.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))return json({error:'このページからは送信できません。'},403);
 const respond=(data,status=200)=>{const response=json(data,status);if(origin)response.headers.set('access-control-allow-origin',origin);response.headers.set('vary','Origin');response.headers.set('access-control-allow-methods','GET, POST, OPTIONS');response.headers.set('access-control-allow-headers','Content-Type');return response};
 if(request.method==='OPTIONS'){const response=respond(null);return new Response(null,{status:204,headers:response.headers})}
 if(!db)return respond({error:'ランキングの保存先に接続できません。'},503);
 try {
  if(request.method==='GET'){
   const scoring=url.searchParams.get('scoring')??'cash';
   if(!['cash','assets'].includes(scoring))return respond({error:'Invalid scoring'},400);
   const version=url.searchParams.get('version')??'all',offset=Number(url.searchParams.get('offset')??0);
   if(!(version==='all'||/^\d+\.\d+\.\d+$/.test(version)) || !Number.isSafeInteger(offset)||offset<0||offset>1e7)return respond({error:'表示条件を確認してください。'},400);
   const rule=scoring==='assets'?'astra-v13-30m-assets:classic':'astra-v13-30m:classic';
   const where=' WHERE ruleset_version = ?'+(version==='all'?'':' AND app_version = ?'),params=version==='all'?[rule]:[rule,version];
   const [scores,count,versions]=await Promise.all([
    db.prepare(`SELECT id,nickname,app_version AS appVersion,final_bankroll AS finalBankroll,spins FROM bankroll_records${where} ORDER BY final_bankroll DESC,id ASC LIMIT 50 OFFSET ?`).bind(...params,offset).all(),
    db.prepare(`SELECT COUNT(*) AS total FROM bankroll_records${where}`).bind(...params).first(),
    db.prepare('SELECT DISTINCT app_version AS version FROM bankroll_records WHERE ruleset_version = ?').bind(rule).all()
   ]);
   return respond({scores:scores.results??[],total:Number(count?.total??0),versions:(versions.results??[]).map(v=>v.version),offset,pageSize:50});
  }
  if(request.method!=='POST')return respond({error:'Method Not Allowed'},405);
  const input=await bodyJson(request),nickname=typeof input?.nickname==='string'?input.nickname.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim():'';
  if(!input || !nickname || Array.from(nickname).length>16 || !uuid(input.scoreId) || !(input.appVersion==='3.0.0'?input.rulesetVersion==='astra-v13-30m-assets:classic':['2.8.0','2.9.0'].includes(input.appVersion)&&input.rulesetVersion==='astra-v13-30m:classic') || input.catalog!=='classic' || input.rule!=='fixed' || input.ranked!==true || input.durationMs!==1800000 || input.addedMs!==0 || !Number.isFinite(input.finalBankroll) || input.finalBankroll<0 || input.finalBankroll>1e200 || !Number.isSafeInteger(input.spins)||input.spins<0||input.spins>1e8)return respond({error:'30分の記録と名前を確認してください。'},400);
  const result=await db.prepare('INSERT OR IGNORE INTO bankroll_records (score_id,nickname,app_version,ruleset_version,catalog_id,duration_ms,final_bankroll,spins) VALUES (?,?,?,?,?,?,?,?)').bind(input.scoreId,nickname,input.appVersion,input.rulesetVersion,input.catalog,input.durationMs,input.finalBankroll,input.spins).run();
  const saved=await db.prepare('SELECT nickname FROM bankroll_records WHERE score_id=?').bind(input.scoreId).first();
  return respond({ok:true,duplicate:Number(result.meta?.changes??0)===0,nickname:saved.nickname},Number(result.meta?.changes??0)?201:200);
 }catch{return respond({error:'ランキングを読み書きできませんでした。もう一度お試しください。'},500)}
}
