import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {advanceTrial,appendHistory,freshTrial,readSave,resumeTrial,TRIAL_MS,trialAssets,type Run} from './game/engine';
import {chartGeometry} from './TradingViews';
import {TrialLeaderboard} from './TimeTrial';
import {flushTrialScores,readTrialOutbox,saveTrialName} from './trialScores';
import {resultRankingPath,validResultRanking} from './resultRanking';
import {boardIdentity} from './boardIdentity';
const OUTBOX='bebullish-30m-outbox-v1';
beforeEach(()=>{const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)});});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()});
const completed=()=>advanceTrial({...resumeTrial(freshTrial(),1000),cash:1000,spent:250,peak:1000},TRIAL_MS+1000);
const legacy=(done=false,scoring?:unknown)=>{
 const s=done?completed():{...freshTrial(),cash:1000,spent:250,peak:1000};
 const raw=JSON.parse(JSON.stringify(s));raw.trial.scoring=scoring;raw.trial.nickname='NUUN';raw.spins=1;if(raw.trial.result)raw.trial.result.spins=1;
 if(done){raw.trial.result.rulesetVersion='astra-v13-30m:classic';raw.trial.result.appVersion='2.9.0';raw.trial.result.finalBankroll=1000;raw.trial.submitted=true;}
 else {raw.trial.started=true;raw.trial.elapsedMs=60000;}
 raw.history=[{kind:'start',cash:0,spin:0,at:0,trialMs:0},{kind:'spin',cash:700,assets:700,spin:1,at:1000,trialMs:1000}];
 return raw;
};
it.each([undefined,'cash'])('migrates %s saves once without losing balances, elapsed time or names',scoring=>{
 const raw=legacy(false,scoring),s=readSave(JSON.stringify(raw))!;
 expect(s).toMatchObject({id:raw.id,cash:1000,spent:250,debug:true,trial:{scoring:'assets',started:true,paused:true,elapsedMs:60000,nickname:'NUUN',submitted:false}});
 expect(trialAssets(s)).toBe(1250);expect(s.history.slice(0,2)).toEqual(raw.history);
 expect(s.history.at(-1)).toMatchObject({kind:'assets-start',cash:1000,assets:1250,trialMs:60000});
 expect(readSave(JSON.stringify(s))).toEqual(s);
 const plot=chartGeometry(s);expect(plot.recordedPeak).toBe(1250);expect(plot.coords[0].x).toBeCloseTo(6+988/30);expect(plot.coords).toHaveLength(2);
});
it('converts completed cash results into unranked personal asset records',()=>{
 const raw=legacy(true),s=readSave(JSON.stringify(raw))!;
 expect(s.trial!.result).toMatchObject({id:raw.id,finalBankroll:1250,rulesetVersion:'astra-v13-30m-assets:classic',appVersion:'2.9.0',ranked:false});
 expect(s.trial).toMatchObject({elapsedMs:TRIAL_MS,nickname:'NUUN',submitted:false});
 expect(readSave(JSON.stringify(s))).toEqual(s);expect(resultRankingPath(s)).toBeNull();
 saveTrialName(s,'NUUN');expect(readTrialOutbox()).toEqual([]);
});
it('validates the original cash record before migrating and rejects unknown scoring',()=>{
 const bad=legacy(true);bad.trial.result.finalBankroll=1250;expect(readSave(JSON.stringify(bad))).toBeNull();
 expect(readSave(JSON.stringify(legacy(false,'unknown')))).toBeNull();
});
it('keeps current completed records ranked with identical IDs and values',()=>{
 const s=completed(),restored=readSave(JSON.stringify(s))!;
 expect(restored.trial!.result).toEqual(s.trial!.result);expect(restored.trial!.result!.ranked).toBe(true);
 expect(restored.history.some(p=>p.kind==='assets-start')).toBe(false);
});
it('keeps the migration anchor when chart history is compacted',()=>{
 let s=readSave(JSON.stringify(legacy()))!;
 for(let i=0;i<4000;i++)s={...s,history:appendHistory(s.history,{kind:'spin',cash:1000,assets:1250,spin:i+2,at:60000+i,trialMs:60000+i})};
 expect(s.history.filter(p=>p.kind==='assets-start')).toHaveLength(1);
 expect(chartGeometry(s).coords[0].x).toBeCloseTo(6+988/30);
});
it('prunes retired outbox entries before submitting modern offline scores',async()=>{
 const old=legacy(true).trial.result,current=completed().trial!.result!;
 localStorage.setItem(OUTBOX,JSON.stringify([{nickname:'OLD',result:old},{nickname:'NEW',result:current}]));
 const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);
 expect(readTrialOutbox().map(r=>r.result.id)).toEqual([current.id]);
 expect(await flushTrialScores()).toEqual([current.id]);expect(fetcher).toHaveBeenCalledTimes(1);
 expect(JSON.parse(fetcher.mock.calls[0][1].body).rulesetVersion).toBe('astra-v13-30m-assets:classic');
 expect(JSON.parse(localStorage.getItem(OUTBOX)!)).toEqual([]);
});
it('guards direct stale records against rank sharing and board linking',()=>{
 const s=legacy(true) as Run,r=s.trial!.result!;
 expect(resultRankingPath(s)).toBeNull();
 expect(validResultRanking(s,{recordId:r.id,appVersion:r.appVersion,rulesetVersion:r.rulesetVersion,overallRank:1,versionRank:1})).toBe(false);
 expect(boardIdentity(s).trialRecordId).not.toBe(r.id);
});
it('offers only asset rankings without a scoring selector',()=>{
 const html=renderToStaticMarkup(<TrialLeaderboard/>);
 expect(html).toContain('総資産ランキング');expect(html).not.toContain('採点ルール');expect(html).not.toContain('現金のみ');
});
