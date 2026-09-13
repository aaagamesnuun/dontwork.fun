import {afterEach,beforeEach,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';
import * as normal from './rankings.js';
import {bankrollRankingsApi} from './bankrollRankings.js';
let sql,db;
const migration=name=>sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
beforeEach(()=>{
 sql=new DatabaseSync(':memory:');migration('0006_clear_records.sql');migration(existsSync(new URL('../drizzle/0009_bankroll_records.sql',import.meta.url))?'0009_bankroll_records.sql':'0008_bankroll_records.sql');migration('0013_ranking_work.sql');
 for(let i=0;i<(normal.RANKING_RESET_THROUGH_ID??0);i++)sql.prepare('INSERT INTO clear_records(completion_id,nickname,app_version,ruleset_version,catalog_id,time_ms,spins) VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(),'old','3.0.0','astra-v13:classic','classic',1000,1);
 db={prepare(text){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(text).get(...args)??null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){return {meta:sql.prepare(text).run(...args)}}}},async batch(rows){return Promise.all(rows.map(r=>r.run()))}};
});
afterEach(()=>sql.close());
const record=(mode,patch={})=>({nickname:'WORKER',appVersion:'3.0.0',catalog:'classic',ranked:true,spins:100,...(mode==='normal'?{completionId:crypto.randomUUID(),timeMs:12000,rulesetVersion:'astra-v13:classic'}:{scoreId:crypto.randomUUID(),durationMs:1800000,finalBankroll:1000,addedMs:0,rule:'fixed',rulesetVersion:'astra-v13-30m-assets:classic'}),...patch});
const api=async(mode,input)=>{const url=new URL('https://dontwork.fun/api/'+(mode==='normal'?'rankings':'bankroll-rankings'));const request=new Request(url,input?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)}:{});return mode==='normal'?normal.rankingsApi(request,db,url,()=>true):bankrollRankingsApi(request,db,url)};
it.each(['normal','trial'])('round-trips frozen WORK counts and distinguishes missing from zero in %s',async mode=>{
 for(const workCount of [undefined,null,0,123456])expect((await api(mode,record(mode,{workCount}))).status).toBe(201);
 const rows=(await(await api(mode)).json()).scores.filter(r=>r.nickname==='WORKER');
 expect(rows.map(r=>r.workCount)).toEqual([null,null,0,123456]);
});
it.each(['normal','trial'])('rejects malformed counts while keeping duplicates immutable in %s',async mode=>{
 for(const workCount of [-1,1.5,'42',false,Number.MAX_SAFE_INTEGER+1])expect((await api(mode,record(mode,{workCount}))).status).toBe(400);
 const r=record(mode,{workCount:21});expect((await api(mode,r)).status).toBe(201);
 const table=mode==='normal'?'clear_records':'bankroll_records',idColumn=mode==='normal'?'completion_id':'score_id',id=r.completionId??r.scoreId;
 const before=sql.prepare(`SELECT * FROM ${table} WHERE ${idColumn}=?`).get(id);
 expect((await api(mode,{...r,workCount:9999})).status).toBe(200);
 expect(sql.prepare(`SELECT * FROM ${table} WHERE ${idColumn}=?`).get(id)).toEqual(before);
});
it('adds nullable columns without rewriting historical records',()=>{
 const old=new DatabaseSync(':memory:');
 old.exec(readFileSync(new URL('../drizzle/0006_clear_records.sql',import.meta.url),'utf8'));
 const bankroll=existsSync(new URL('../drizzle/0009_bankroll_records.sql',import.meta.url))?'0009_bankroll_records.sql':'0008_bankroll_records.sql';old.exec(readFileSync(new URL('../drizzle/'+bankroll,import.meta.url),'utf8'));
 old.exec("INSERT INTO clear_records(completion_id,nickname,app_version,ruleset_version,catalog_id,time_ms,spins,created_at) VALUES ('old','old','3.0.0','astra-v13:classic','classic',1000,1,'2026-09-01 00:00:00')");
 const before=old.prepare('SELECT * FROM clear_records').get();old.exec(readFileSync(new URL('../drizzle/0013_ranking_work.sql',import.meta.url),'utf8'));
 expect(old.prepare('SELECT * FROM clear_records').get()).toEqual({...before,work_count:null});old.close();
});
