import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync} from 'node:fs';
import {boardApi} from './board.js';
import {rankingsApi} from './rankings.js';
import * as normal from './rankings.js';
import {bankrollRankingsApi} from './bankrollRankings.js';
import {rankingPeriod} from './rankingPeriod.js';
let sql,db;
const cutoff=normal.RANKING_RESET_THROUGH_ID??0;
const normalRow=(time=1000,at='2026-09-11T16:00:00.000Z',version='3.0.0',nickname='nuun')=>{
 const id=crypto.randomUUID();sql.prepare('INSERT INTO clear_records(completion_id,nickname,app_version,ruleset_version,catalog_id,time_ms,spins,created_at) VALUES (?,?,?,?,?,?,?,?)').run(id,nickname,version,'astra-v13:classic','classic',time,10,at);return id;
};
const trialRow=(amount,at='2026-09-11 16:00:00',rule='astra-v13-30m-assets:classic')=>{
 const id=crypto.randomUUID();sql.prepare('INSERT INTO bankroll_records(score_id,nickname,app_version,ruleset_version,catalog_id,duration_ms,final_bankroll,spins,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id,'nuun','3.0.0',rule,'classic',1800000,amount,10,at);return id;
};
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-12T03:00:00Z'));
 sql=new DatabaseSync(':memory:');
 for(const name of ['0006_clear_records.sql',existsSync(new URL('../drizzle/0009_bankroll_records.sql',import.meta.url))?'0009_bankroll_records.sql':'0008_bankroll_records.sql','0012_community.sql'])sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 db={prepare(text){let args=[];return {bind(...a){args=a;return this},async first(){return sql.prepare(text).get(...args)??null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){const r=sql.prepare(text).run(...args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}}}}},async batch(rows){return Promise.all(rows.map(r=>r.run()))}};
 for(let i=0;i<cutoff;i++)normalRow(1000);
});
afterEach(()=>{sql.close();vi.useRealTimers()});
const ranking=async(path)=>{const url=new URL('https://game.test/api/'+path);const response=path.startsWith('rankings')?await rankingsApi(new Request(url),db,url,()=>true):await bankrollRankingsApi(new Request(url),db,url);return {status:response.status,...await response.json()}};
const postInput=()=>({requestId:crypto.randomUUID(),actorId:crypto.randomUUID(),nickname:'nuun',body:'Hello',parentId:null});
const board=async(body=null,query='',origin='https://dontwork.fun')=>{
 const url=new URL('https://service.test/api/board'+query);return boardApi(new Request(url,{headers:{origin,'content-type':'application/json','CF-Connecting-IP':'192.0.2.1'},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),db,url,cutoff);
};
it('uses JST midnight and Monday boundaries with a half-open interval',()=>{
 expect(rankingPeriod('day',Date.parse('2026-09-11T14:59:59Z')).periodStart).toBe('2026-09-10T15:00:00.000Z');
 expect(rankingPeriod('day',Date.parse('2026-09-11T15:00:00Z')).periodStart).toBe('2026-09-11T15:00:00.000Z');
 expect(rankingPeriod('week',Date.parse('2026-09-13T14:59:59Z'))).toMatchObject({periodStart:'2026-09-06T15:00:00.000Z',periodEnd:'2026-09-13T15:00:00.000Z'});
 expect(rankingPeriod('week',Date.parse('2026-09-13T15:00:00Z')).periodStart).toBe('2026-09-13T15:00:00.000Z');
});
it('averages every matching record beyond page 1 and preserves reset/version/date boundaries',async()=>{
 for(let i=0;i<60;i++)normalRow(2000+i*1000,i%2?'2026-09-11T15:00:00.000Z':'2026-09-11 15:00:00');
 normalRow(900000,'2026-09-11 14:59:59');normalRow(900000,'2026-09-12T15:00:00.000Z');normalRow(1000,'2026-09-11 16:00:00','2.9.0');
 for(const offset of [0,50]){const p=await ranking('rankings?period=day&version=3.0.0&offset='+offset);expect(p).toMatchObject({status:200,total:60,averageTimeMs:31500});expect(p.scores).toHaveLength(offset?10:50)}
 expect(await ranking('rankings?period=week&version=3.0.0')).toMatchObject({total:62});
 expect(await ranking('rankings?period=day&version=8.0.0')).toMatchObject({total:0,averageTimeMs:null});
 expect((await ranking('rankings?period=bad')).status).toBe(400);
});
it('includes zero and huge timed amounts without mixing cash and assets rules',async()=>{
 trialRow(0);trialRow(1e200);trialRow(999,'2026-09-11 14:59:59');trialRow(777,'2026-09-11 16:00:00','astra-v13-30m:classic');
 expect(await ranking('bankroll-rankings?period=day&scoring=assets')).toMatchObject({total:2,averageBankroll:5e199});
 expect(await ranking('bankroll-rankings?period=day&scoring=cash')).toMatchObject({total:1,averageBankroll:777});
 expect(await ranking('bankroll-rankings?period=day&version=8.0.0')).toMatchObject({total:0,averageBankroll:null});
 expect((await ranking('bankroll-rankings?period=bad')).status).toBe(400);
});
it('stores a post and replies durably, returning current server ranks but no private identifiers',async()=>{
 const clearRecordId=normalRow(4000),trialRecordId=trialRow(1000),input={...postInput(),clearRecordId,trialRecordId,normalRank:1};
 const created=await(await board(input)).json();expect(created.ok).toBe(true);
 expect((await board(input)).status).toBe(200);
 normalRow(2000);trialRow(2000);
 const page=await(await board()).json();expect(page.posts[0]).toMatchObject({id:created.id,normalRank:2,trialRank:2,nickname:'nuun',replyCount:0});
 const raw=JSON.stringify(page);for(const secret of [clearRecordId,trialRecordId,input.actorId,input.requestId,'actorHash','networkHash'])expect(raw).not.toContain(secret);
 const response=await board({...postInput(),body:'reply',parentId:created.id});expect(response.status).toBe(201);
 const thread=await(await board(null,'?thread='+created.id)).json();expect(thread.thread.replyCount).toBe(1);expect(thread.posts[0].body).toBe('reply');
 expect((await board({...postInput(),parentId:thread.posts[0].id})).status).toBe(404);
 sql.prepare('DELETE FROM clear_records WHERE completion_id=?').run(clearRecordId);
 expect((await(await board()).json()).posts[0].normalRank).toBeNull();
});
it('does not award someone else’s name or a nonexistent/reset record a rank',async()=>{
 const clearRecordId=normalRow();expect((await board({...postInput(),nickname:'Another',clearRecordId})).status).toBe(201);
 expect((await(await board()).json()).posts[0].normalRank).toBeNull();
 expect((await board({...postInput(),clearRecordId:crypto.randomUUID(),normalRank:1})).status).toBe(201);
 expect((await(await board()).json()).posts[0].normalRank).toBeNull();
 if(cutoff){const old=sql.prepare('SELECT completion_id AS id FROM clear_records WHERE id=1').get();await board({...postInput(),clearRecordId:old.id});expect((await(await board()).json()).posts[0].normalRank).toBeNull()}
});
it('validates content, origin, reply targets and idempotent retries before accepting a write',async()=>{
 for(const patch of [{body:''},{nickname:''},{body:'x'.repeat(1001)},{parentId:-1},{clearRecordId:'not-an-id'}])expect((await board({...postInput(),...patch})).status).toBe(400);
 expect((await board(postInput(),'','https://evil.test')).status).toBe(403);
 expect((await board({...postInput(),parentId:999})).status).toBe(404);
 const input=postInput();expect((await board(input)).status).toBe(201);expect((await board({...input,body:'changed'})).status).toBe(409);
 expect((await board({...postInput(),actorId:input.actorId})).status).toBe(429);
 vi.advanceTimersByTime(3000);expect((await board({...postInput(),actorId:input.actorId})).status).toBe(201);
 expect((await board(null,'?cursor=-1')).status).toBe(400);
});
it('paginates posts without duplicating or dropping earlier IDs',async()=>{
 for(let i=0;i<25;i++)await board({...postInput(),body:String(i)});
 const first=await(await board()).json(),second=await(await board(null,'?cursor='+first.nextCursor)).json();
 expect(first.posts).toHaveLength(20);expect(second.posts).toHaveLength(5);expect(second.nextCursor).toBeNull();expect(new Set([...first.posts,...second.posts].map(p=>p.id)).size).toBe(25);
});
it('accepts the official Workers origin and can show the latest reply beyond the first page',async()=>{
 const origin='https://dontwork-fun.ronefire.workers.dev';
 const result=await board(postInput(),'',origin);expect(result.status).toBe(201);expect(result.headers.get('Access-Control-Allow-Origin')).toBe(origin);
 const root=await result.json();let last;
 for(let i=0;i<25;i++)last=await(await board({...postInput(),parentId:root.id,body:'Reply '+i})).json();
 const latest=await(await board(null,'?thread='+root.id+'&cursor='+(last.id-1))).json();
 expect(latest.posts.map(p=>p.id)).toEqual([last.id]);expect(latest.thread.replyCount).toBe(25);
});
