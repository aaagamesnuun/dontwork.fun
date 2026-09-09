import {describe,it,expect} from 'vitest';
import {applyMigration,collectMigration,freezeMigration,readMigration,recoverMigration,MIGRATION_APPLIED,MIGRATION_BACKUP,MIGRATION_PENDING,MIGRATION_KIND} from './domainMigration';
import {freshRun,freshTrial,resumeTrial,advanceTrial,finish,readSave,SAVE_KEY,TARGET,TRIAL_MS} from './game/engine';
import {NORMAL_SLOT,TRIAL_SLOT} from './trialSaves';
import {startBackground} from './backgroundPlay';
function store(initial:Record<string,string>={}) {
 const map=new Map(Object.entries(initial));
 return {get length(){return map.size},clear:()=>map.clear(),key:(i:number)=>[...map.keys()][i]??null,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}} satisfies Storage;
}
describe('dontwork origin migration',()=>{
 it('preserves both modes, result identities, submitted flags and pending scores',()=>{
  const normal={...finish({...freshRun(),cash:TARGET,peak:TARGET,activeMs:123000,spins:500}),submitted:true,completionNickname:'NUUN'};
  const timed=advanceTrial({...resumeTrial(freshTrial(),1000),cash:1234,peak:1234},TRIAL_MS+1000);
  const source=store({[SAVE_KEY]:JSON.stringify(timed),[NORMAL_SLOT]:JSON.stringify(normal),'bebullish-ranking-outbox-v1':JSON.stringify([{nickname:'NUUN',completion:normal.completion}]),'bebullish-30m-outbox-v1':JSON.stringify([{nickname:'NUUN',result:timed.trial!.result}]),'bebullish-install-id':'same-player'});
  const bundle=collectMigration(source,TRIAL_MS+2000),target=store();expect(applyMigration(target,bundle,'ABC234')).toBe(true);
  expect(readSave(target.getItem(NORMAL_SLOT))).toMatchObject({id:normal.id,submitted:true,completion:normal.completion});
  expect(readSave(target.getItem(SAVE_KEY))?.trial?.result).toEqual(timed.trial!.result);
  expect(target.getItem(TRIAL_SLOT)).toBe(target.getItem(SAVE_KEY));expect(target.getItem('bebullish-install-id')).toBe('same-player');
  expect(target.getItem('bebullish-30m-outbox-v1')).toBe(source.getItem('bebullish-30m-outbox-v1'));
 });
 it('keeps a non-background saved trial paused throughout later migration',()=>{
  const trial=resumeTrial(freshTrial(),1000),source=store({[SAVE_KEY]:JSON.stringify(trial)});
  const frozen=freezeMigration(source,11000),paused=readSave(frozen.entries[SAVE_KEY])!;
  expect(paused.trial).toMatchObject({elapsedMs:0,paused:true,anchor:null});expect(paused.running).toBe(false);
  expect(collectMigration(source,61000).entries[SAVE_KEY]).toBe(frozen.entries[SAVE_KEY]);
 });
 it('settles offline spins once before freezing the source',()=>{
  const run=startBackground({...freshRun(),settings:{...freshRun().settings,backgroundPlay:true},cash:1000,peak:1000,portfolio:[{id:'edge-50',count:1}],running:true},1000);
  const source=store({[SAVE_KEY]:JSON.stringify(run)}),first=freezeMigration(source,11000),next=collectMigration(source,61000);
  const a=readSave(first.entries[SAVE_KEY])!,b=readSave(next.entries[SAVE_KEY])!;
  expect(a.spins).toBeGreaterThan(0);expect(b.spins).toBe(a.spins);expect(b.cash).toBe(a.cash);expect(b.background).toBeNull();
 });
 it('merges queued records by immutable record ID and never reapplies an old code',()=>{
  const key='bebullish-ranking-outbox-v1',entry=(id:string)=>({nickname:'test',completion:{id}}),source=store({[SAVE_KEY]:JSON.stringify(freshRun()),[key]:JSON.stringify([entry('a'),entry('b')])});
  const target=store({[key]:JSON.stringify([entry('b'),entry('c')])}),bundle=collectMigration(source);
  applyMigration(target,bundle,'ABC234');expect(JSON.parse(target.getItem(key)!)).toHaveLength(3);
  const progressed={...readSave(target.getItem(SAVE_KEY))!,cash:9000,peak:9000};target.setItem(SAVE_KEY,JSON.stringify(progressed));
  expect(applyMigration(target,bundle,'ABC234')).toBe(false);expect(readSave(target.getItem(SAVE_KEY))!.cash).toBe(9000);
 });
 it('keeps long rating histories without rejecting the actual saves',()=>{
  const source=store({[SAVE_KEY]:JSON.stringify(freshRun())});for(let i=0;i<250;i++)source.setItem('bebullish-clear-rating-seen:'+i,'1');
  expect(readMigration(JSON.stringify(collectMigration(source)))).not.toBeNull();
 });
 it('rejects unknown keys, broken modes and oversized bundles',()=>{
  for(const entries of [{other:'x'},{[SAVE_KEY]:'{}'},{[NORMAL_SLOT]:'null'},{'bebullish-ranking-outbox-v1':'{}'}])expect(readMigration(JSON.stringify({kind:MIGRATION_KIND,version:1,createdAt:1000,entries}))).toBeNull();
  expect(readMigration('x'.repeat(2_000_001))).toBeNull();
 });
 it('rolls back partial writes after quota failure, including newly added slots',()=>{
  const original=JSON.stringify({...freshRun(),cash:9876,peak:9876}),base=store({[SAVE_KEY]:original}),bundle=collectMigration(store({[SAVE_KEY]:JSON.stringify(freshTrial()),[NORMAL_SLOT]:JSON.stringify(freshRun())}));
  let failed=false;
  const target={...base,setItem:(k:string,v:string)=>{if(k===MIGRATION_APPLIED&&!failed){failed=true;throw Error('quota');}if(failed&&k===SAVE_KEY&&base.getItem(TRIAL_SLOT))throw Error('new slot holds quota');base.setItem(k,v)}};
  expect(()=>applyMigration(target,bundle,'ABC234')).toThrow('quota');expect(base.getItem(SAVE_KEY)).toBe(original);expect(base.getItem(TRIAL_SLOT)).toBeNull();expect(base.getItem(MIGRATION_PENDING)).toBeNull();
 });
 it('recovers interrupted migration from the durable journal before game startup',()=>{
  const original=JSON.stringify(freshRun()),storage=store({[SAVE_KEY]:'partial-new-save',[TRIAL_SLOT]:'partial-new-slot',[MIGRATION_PENDING]:'1',[MIGRATION_BACKUP]:JSON.stringify({[SAVE_KEY]:original,[TRIAL_SLOT]:null})});
  recoverMigration(storage);expect(storage.getItem(SAVE_KEY)).toBe(original);expect(storage.getItem(TRIAL_SLOT)).toBeNull();expect(storage.getItem(MIGRATION_PENDING)).toBeNull();
 });
});
