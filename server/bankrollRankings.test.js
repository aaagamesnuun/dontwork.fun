import {sanitizeProps} from "./worker.js";
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {bankrollRankingsApi} from './bankrollRankings.js';
let sqlite,db;
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0009_bankroll_records.sql',import.meta.url),'utf8'));db={prepare(sql){const query={args:[],bind(...args){this.args=args;return this},async all(){return {results:sqlite.prepare(sql).all(...this.args)}},async first(){return sqlite.prepare(sql).get(...this.args)??null},async run(){return {meta:sqlite.prepare(sql).run(...this.args)}}};return query}}});
afterEach(()=>sqlite.close());
const valid=()=>({scoreId:crypto.randomUUID(),nickname:'友達',appVersion:'2.8.0',rulesetVersion:'astra-v13-30m:classic',catalog:'classic',rule:'fixed',ranked:true,durationMs:1800000,addedMs:0,finalBankroll:1000,spins:100});
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
it('shares 2.8 and 2.9 records across old and new domains without duplicates',async()=>{
 for(const appVersion of ['2.8.0','2.9.0']){const record={...valid(),appVersion};expect((await post(record,'https://dontwork.fun')).status).toBe(201);expect((await post(record,'https://bebullish.fun')).status).toBe(200);}
 expect((await(await get()).json()).total).toBe(2);
});

it('keeps v3 cash-plus-investment scores in their own cohort and rejects mixed version/rule pairs',async()=>{
 const old=valid(),modern={...valid(),appVersion:'3.0.0',rulesetVersion:'astra-v13-30m-assets:classic',finalBankroll:9000};
 expect((await post(old)).status).toBe(201);expect((await post(modern)).status).toBe(201);
 expect((await(await get()).json()).scores.map(r=>r.finalBankroll)).toEqual([1000]);
 expect((await(await get('?scoring=assets')).json()).scores.map(r=>r.finalBankroll)).toEqual([9000]);
 for(const patch of [{appVersion:'2.9.0'},{rulesetVersion:'astra-v13-30m:classic'}])expect((await post({...modern,...patch,scoreId:crypto.randomUUID()})).status).toBe(400);
});
