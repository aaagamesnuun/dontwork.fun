import {beforeEach,afterEach,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import * as normal from './rankings.js';
import {bankrollRankingsApi} from './bankrollRankings.js';
import {clearRecordRank} from './recordRank.js';
let sql,db;
const cutoff=normal.RANKING_RESET_THROUGH_ID??0;
beforeEach(()=>{
 sql=new DatabaseSync(':memory:');
 for(const file of ['0006_clear_records.sql','0009_bankroll_records.sql'])sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 db={prepare(text){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(text).get(...args)??null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){return {meta:sql.prepare(text).run(...args)}}}},async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
});
afterEach(()=>sql.close());
const clear=(time,version='3.0.0')=>{const id=crypto.randomUUID();sql.prepare('INSERT INTO clear_records(completion_id,nickname,app_version,ruleset_version,catalog_id,time_ms,spins) VALUES (?,?,?,?,?,?,?)').run(id,'Same name',version,'astra-v13:classic','classic',time,100);return id;};
const trial=(amount,rule='astra-v13-30m-assets:classic',version='3.0.0')=>{const id=crypto.randomUUID();sql.prepare('INSERT INTO bankroll_records(score_id,nickname,app_version,ruleset_version,catalog_id,duration_ms,final_bankroll,spins) VALUES (?,?,?,?,?,?,?,?)').run(id,'Same name',version,rule,'classic',1800000,amount,100);return id;};
const get=(mode,id,origin='https://dontwork.fun')=>{const url=new URL('https://example.test/api/'+(mode==='clear'?'rankings?completionId=':'bankroll-rankings?scoreId=')+encodeURIComponent(id));const req=new Request(url,{headers:{origin}});return mode==='clear'?normal.rankingsApi(req,db,url,()=>true):bankrollRankingsApi(req,db,url);};
it('finds exact normal records beyond page 1, retaining version scope and stable ties',async()=>{
 for(let i=0;i<cutoff;i++)clear(1000);
 const ids=[];for(let i=0;i<80;i++)ids.push(clear(1000+Math.floor(i/2)*1000,i%3?'3.0.0':'2.9.0'));
 for(const index of [0,1,62,79]){
  const record=await(await get('clear',ids[index])).json();
  const row=sql.prepare('SELECT * FROM clear_records WHERE completion_id=?').get(ids[index]);
  const versionRows=sql.prepare('SELECT completion_id FROM clear_records WHERE id>? AND app_version=? ORDER BY time_ms,id').all(cutoff,row.app_version);
  expect(record.ranking).toMatchObject({recordId:ids[index],overallRank:index+1,versionRank:versionRows.findIndex(r=>r.completion_id===ids[index])+1,appVersion:row.app_version});
 }
});
it('never ranks reset tombstones or counts them ahead of active records',async()=>{
 const old=clear(1000);const active=clear(2000);
 expect(await clearRecordRank(db,old,1)).toBeNull();expect(await clearRecordRank(db,active,1)).toMatchObject({overallRank:1,versionRank:1});
 if(cutoff){for(let i=2;i<=cutoff;i++)clear(1000);expect((await(await get('clear',old)).json()).ranking).toBeNull();}
});
it('separates cash and assets cohorts and handles huge balances, ties and saved versions',async()=>{
 trial(1e200,'astra-v13-30m:classic','2.9.0');
 const first=trial(1e100),tie=trial(1e100),other=trial(1e200,'astra-v13-30m-assets:classic','3.1.0');
 expect((await(await get('trial',first)).json()).ranking).toMatchObject({overallRank:2,versionRank:1,appVersion:'3.0.0'});
 expect((await(await get('trial',tie)).json()).ranking).toMatchObject({overallRank:3,versionRank:2});
 expect((await(await get('trial',other)).json()).ranking).toMatchObject({overallRank:1,versionRank:1});
});
it('keeps unknown IDs unranked, rejects malformed IDs and preserves CORS',async()=>{
 for(const mode of ['clear','trial']){
  const response=await get(mode,crypto.randomUUID());expect(response.headers.get('access-control-allow-origin')).toBe('https://dontwork.fun');expect(await response.json()).toEqual({ranking:null});
  expect((await get(mode,'not-an-id')).status).toBe(400);
  expect((await get(mode,crypto.randomUUID(),'https://unrelated.test')).status).toBe(403);
 }

});

it('matches the visible leaderboard even before any legacy records are imported',async()=>{
 for(let i=0;i<cutoff;i++)clear(1000);
 const id=clear(90000000);
 const rank=(await(await get('clear',id)).json()).ranking;
 const url=new URL('https://example.test/api/rankings');
 const list=await(await normal.rankingsApi(new Request(url),db,url,()=>true)).json();
 const index=list.scores.findIndex(r=>r.timeMs===90000000);
 expect(index).toBeGreaterThanOrEqual(0);
 expect(rank.overallRank).toBe(index+1);
});
