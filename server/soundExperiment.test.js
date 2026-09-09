import {describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {refreshSoundExperimentReport,summarizeSoundCohorts} from './soundExperiment.js';
const database=()=>{
 const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const prepare=sql=>{const query=(args=[])=>({bind:(...next)=>query(next),first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>db.prepare(sql).run(...args)});return query()};
 return {db,prepare};
};
describe('sound experiment reporting',()=>{
 it('keeps pending assignments out of fixed-window denominators',()=>{
  const now=1e9,rows=[{variant:'terminal',variants:1,enrolled:now-100,active24:0,returned:0,switched:0},{variant:'retro-arcade',variants:1,enrolled:now-200000,active24:600000,returned:1,switched:1},{variant:'terminal',variants:2,enrolled:now-300000}];
  const p=summarizeSoundCohorts(rows,now);
  expect(p.conflictingAssignments).toBe(1);expect(p.groups[0].engagement24h['5min']).toEqual({numerator:0,eligible:0,pending:1,rate:null});
  expect(p.groups[1].engagement24h['10min']).toMatchObject({numerator:1,eligible:1,rate:1});expect(p.groups[1].return24to48h.rate).toBe(1);expect(p.groups[1].switchedSound).toBe(1);
 });
 it('aggregates each installation across sessions/runs, includes early dropout and refreshes the owner table',async()=>{
  const DB=database(),now=2e9,start=now-200000;let sequence=0;
  const event=(player,run,session,name,at,active,variant,extra={})=>DB.db.prepare(`INSERT INTO telemetry_events(event_id,player_id,run_id,session_id,sequence,active_ms,engaged_ms,event_name,app_version,ruleset_version,schema_version,debug,language,device_class,viewport_class,props_json,received_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(),player,run,session,sequence++,active,active,name,'2.3.0','astra-v9:classic',2,0,'ja','mobile','small',JSON.stringify({soundExperiment:'sound-default-v1',soundVariant:variant,soundAssignedAt:start*1000,soundPack:variant,...extra}),at);
  event('a','a1','s1','sound_assignment',start,0,'terminal');event('a','a1','s1','snapshot',start+100,300000,'terminal');event('a','a1','s1','snapshot',start+200,600000,'terminal');
  event('a','a2','s1','session_start',start+500,0,'terminal');event('a','a2','s1','snapshot',start+1000,300000,'terminal');
  event('a','a2','s2','session_start',start+90000,300000,'terminal',{entryKind:'resume',soundPack:'wood'});
  event('b','b1','s3','sound_assignment',start,0,'retro-arcade'); // Never started playing.
  event('c','c1','s4','sound_assignment',now-100,0,'terminal',{soundAssignedAt:(now-100)*1000});
  const report=await refreshSoundExperimentReport(DB,true,now);
  const terminal=report.groups[0],arcade=report.groups[1];
  expect(terminal.assigned).toBe(2);expect(terminal.engagement24h['10min']).toEqual({numerator:1,eligible:1,pending:1,rate:1});expect(terminal.engagement24h['30min'].numerator).toBe(0);
  expect(terminal.return24to48h).toMatchObject({numerator:1,eligible:1,pending:1});expect(terminal.switchedSound).toBe(1);
  expect(arcade.engagement24h['5min']).toEqual({numerator:0,eligible:1,pending:0,rate:0});
  const saved=DB.db.prepare('SELECT * FROM telemetry_reports WHERE report_key=?').get('experiment:sound-default-v1');expect(JSON.parse(saved.payload_json)).toEqual(report);expect(saved.sample_size).toBe(3);
  expect(await refreshSoundExperimentReport(DB,false,now+10)).toBeUndefined();DB.db.close();
 });
});
