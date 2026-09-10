import { describe,it,expect } from 'vitest';
import { Journey,JOURNEY_KEY,VISIT_GAP } from './journey';
const context={origin:'new',language:'ja',device:'mobile',version:'3.0.0',mode:'normal'} as const;
function setup(){let now=1_800_000_000_000;const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};return{storage,create:()=>new Journey(context,storage,()=>now),advance:(n:number)=>{now+=n;}};}
describe('foreground visits',()=>{
 it('does not count a passive restored page as actual gameplay',()=>{const f=setup(),j=f.create();const before=j.props().journey;j.played(200,false);expect(j.props().journey).toMatchObject({id:before.id,play:0,foreground:0});});
 it('keeps the visit across reloads but starts a new duration contribution',()=>{const f=setup(),j=f.create();j.played();j.played(200,false);const first=j.props().journey;f.advance(1500);const reload=f.create();expect(reload.props().journey).toMatchObject({id:first.id,foreground:0,play:0});reload.played();expect(reload.props().journey.id).toBe(first.id);});
 it('splits only after the full 30-minute inactivity interval',()=>{const f=setup(),j=f.create();j.played();const first=j.props().journey.id;f.advance(VISIT_GAP-1);j.activate();expect(j.props().journey.id).toBe(first);f.advance(1);j.played();expect(j.props().journey.id).not.toBe(first);});
 it('does not let hidden snapshots overwrite a newer visit in another tab',()=>{const f=setup(),old=f.create();old.played();const id=old.props().journey.id;f.advance(VISIT_GAP);const current=f.create();current.played();const next=current.props().journey.id;expect(next).not.toBe(id);old.props();expect(JSON.parse(f.storage.getItem(JOURNEY_KEY)!).id).toBe(next);});
 it('erases persisted journey state on withdrawal',()=>{const f=setup(),j=f.create();j.played();j.clear();expect(f.storage.getItem(JOURNEY_KEY)).toBe('null');});
});
