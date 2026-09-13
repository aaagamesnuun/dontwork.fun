import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {RankingWork} from './RankingWork';
import {RankingPeriods,RankingSummary} from './RankingPeriod';
import {setLanguage} from './i18n';
import {freshRun,freshTrial,resumeTrial,advanceTrial,TRIAL_MS,TARGET,work,readSave} from './game/engine';
import {saveCompletionName,readOutbox,flushRankings} from './rankingOutbox';
import {saveTrialName,readTrialOutbox,flushTrialScores} from './trialScores';
beforeEach(()=>{const m=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});setLanguage('ja')});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();setLanguage('ja')});
const clear=()=>work({...freshRun(),work:123,cash:TARGET-1,activeMs:2000});
it('freezes normal WORK at clear and sends the same count after further play',async()=>{
 const done=clear(),later=work(done);expect(later.work).toBe(125);expect(later.completion!.workCount).toBe(124);
 saveCompletionName(later,'NUUN');expect(readOutbox()[0].completion.workCount).toBe(124);
 const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);await flushRankings();
 expect(JSON.parse(fetcher.mock.calls[0][1].body).workCount).toBe(124);
});
it('restores old normal counts only from the saved clear snapshot',()=>{
 const raw=JSON.parse(JSON.stringify(clear()));delete raw.completion.workCount;raw.work=9999;
 expect(readSave(JSON.stringify(raw))!.completion!.workCount).toBe(124);
 delete raw.clearSnapshot.work;expect(readSave(JSON.stringify(raw))!.completion!.workCount).toBeNull();
 raw.completion.workCount='bad';expect(readSave(JSON.stringify(raw))!.completion!.workCount).toBeNull();
});
it('freezes timed WORK at the deadline and preserves it through save/outbox/retry',async()=>{
 const done=advanceTrial({...resumeTrial(freshTrial(),1000),work:4321},TRIAL_MS+1000);
 expect(done.trial!.result!.workCount).toBe(4321);expect(work(done)).toBe(done);
 const restored=readSave(JSON.stringify(done))!;expect(restored.trial!.result!.workCount).toBe(4321);
 saveTrialName(restored,'NUUN');expect(readTrialOutbox()[0].result.workCount).toBe(4321);
 const fetcher=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',fetcher);await flushTrialScores();
 expect(JSON.parse(fetcher.mock.calls[0][1].body).workCount).toBe(4321);
 const raw=JSON.parse(JSON.stringify(done));delete raw.trial.result.workCount;
 expect(readSave(JSON.stringify(raw))!.trial!.result!.workCount).toBe(4321);
});
it('renders count, zero and unknown distinctly in both languages',()=>{
 for(const lang of ['ja','en'] as const){setLanguage(lang);
  const show=(count?:number|null)=>renderToStaticMarkup(<RankingWork count={count}/>);
  expect(show(123456)).toContain('123,456');expect(show(0)).toContain('0');expect(show(null)).toContain('WORK —');expect(show()).toContain('WORK —');
  const periods=renderToStaticMarkup(<RankingPeriods value="day" onChange={()=>{}}/>);
  expect(periods).toContain(lang==='ja'?'直近24時間':'Last 24 hours');expect(periods).toContain(lang==='ja'?'直近7日間':'Last 7 days');
  const summary=renderToStaticMarkup(<RankingSummary page={{period:'day',periodStart:'2026-09-12T03:17:00Z',periodEnd:'2026-09-13T03:17:00Z',total:2}} label="Average" value="00:30"/>);
  expect(summary).toContain('12:17');expect(summary).not.toContain('月曜');expect(summary).not.toContain('Monday');
 }
});
