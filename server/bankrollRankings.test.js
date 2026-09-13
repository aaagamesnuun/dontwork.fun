import {sanitizeProps} from "./worker.js";
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {bankrollRankingsApi} from './bankrollRankings.js';
let sqlite,db;
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0009_bankroll_records.sql',import.meta.url),'utf8'));db={prepare(sql){const query={args:[],bind(...args){this.args=args;return this},async all(){return {results:sqlite.prepare(sql).all(...this.args)}},async first(){return sqlite.prepare(sql).get(...this.args)??null},async run(){return {meta:sqlite.prepare(sql).run(...this.args)}}};return query}}});
afterEach(()=>sqlite.close());
const valid=()=>({scoreId:crypto.randomUUID(),nickname:'友達',appVersion:'3.0.0',rulesetVersion:'astra-v13-30m-assets:classic',catalog:'classic',rule:'fixed',ranked:true,durationMs:1800000,addedMs:0,finalBankroll:1000,spins:100});
const post=async(body,origin='https://bebullish.fun')=>{const url=new URL('https://test.example/api/bankroll-rankings');return bankrollRankingsApi(new Request(url,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}),db,url)};
const get=async(query='')=>{const url=new URL('https://test.example/api/bankroll-rankings'+query);return bankrollRankingsApi(new Request(url),db,url)};
describe('30 minute ranking storage',()=>{
 it('retains competition context and full final assets in anonymous telemetry',()=>{expect(sanitizeProps({gameMode:'30m',trialRule:'fixed',trialPaused:true,trialElapsedMs:1800000,finalBankroll:1e100})).toEqual({gameMode:'30m',trialRule:'fixed',trialPaused:true,trialElapsedMs:1800000,finalBankroll:1e100})});
 it('stores and orders huge balances without the telemetry 1e15 cap',async()=>{
  for(const amount of [1e15,2**53,1e200,1e100,0])expect((await post({...valid(),finalBankroll:amount})).status).toBe(201);
  const result=await (await get()).json();expect(result.scores.map(r=>r.finalBankroll)).toEqual([1e200,1e100,2**53,1e15,0]);
 });
 it('keeps first submissions immutable and idempotent',async()=>{
  const score=valid();expect((await post(score)).status).toBe(201);expect((await post({...score,finalBankroll:100000})).status).toBe(200);
  expect((await (await get()).json()).scores[0].finalBankroll).toBe(1000);
 });
 it.each([{ranked:false},{rule:'shop'},{addedMs:60000},{durationMs:1800001},{finalBankroll:-1},{finalBankroll:1e201},{catalog:'legacy'},{spins:1.5},{rulesetVersion:'astra-v13:classic'},{nickname:''},{appVersion:'2.7.0'}])('rejects nonstandard or invalid record %o',async patch=>expect((await post({...valid(),...patch})).status).toBe(400));
 it('filters versions, paginates, and checks origin before accepting data',async()=>{
  expect((await post(valid(),'https://unrelated.example')).status).toBe(403);
  await post(valid());expect((await (await get('?version=2.7.0')).json()).total).toBe(0);expect((await (await get('?offset=50')).json()).scores).toEqual([]);
  expect((await get('?offset=-1')).status).toBe(400);
 });
});
it('shares current records across old and new domains without duplicates',async()=>{
 const record=valid();expect((await post(record,'https://dontwork.fun')).status).toBe(201);expect((await post(record,'https://bebullish.fun')).status).toBe(200);
 expect((await(await get()).json()).total).toBe(1);
});
it('retires old submissions and excludes historical rows from lists, averages and versions',async()=>{
 const old={...valid(),appVersion:'2.9.0',rulesetVersion:'astra-v13-30m:classic',finalBankroll:1e100};
 expect((await post(old)).status).toBe(400);
 sqlite.prepare('INSERT INTO bankroll_records(score_id,nickname,app_version,ruleset_version,catalog_id,duration_ms,final_bankroll,spins) VALUES (?,?,?,?,?,?,?,?)').run(old.scoreId,old.nickname,old.appVersion,old.rulesetVersion,'classic',1800000,old.finalBankroll,100);
 const modern=valid();expect((await post(modern)).status).toBe(201);
 for(const query of ['', '?scoring=assets'])expect(await(await get(query)).json()).toMatchObject({total:1,averageBankroll:1000,versions:['3.0.0']});
 expect((await get('?scoring=cash')).status).toBe(410);
 expect((await get('?scoring=unknown')).status).toBe(400);
 expect(await(await get('?scoreId='+old.scoreId)).json()).toEqual({ranking:null});
 expect(sqlite.prepare('SELECT COUNT(*) AS n FROM bankroll_records').get().n).toBe(2);
 for(const patch of [{appVersion:'2.9.0'},{rulesetVersion:'astra-v13-30m:classic'}])expect((await post({...modern,...patch,scoreId:crypto.randomUUID()})).status).toBe(400);
});
