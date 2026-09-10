import {afterEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {freshRun,freshTrial,resumeTrial,advanceTrial,work,TARGET,TRIAL_MS} from './game/engine';
import {clearCardRun,ResultCard} from './ResultCard';
import {resultRankingPath,resultRankingText,validResultRanking,type ResultRanking} from './resultRanking';
import {resultImage,resultShareText,resultXIntent,RESULT_POST_URL} from './resultShare';
import {setLanguage} from './i18n';
const clear=()=>clearCardRun(work({...freshRun(),cash:TARGET-1,activeMs:60000,spins:100}));
afterEach(()=>{vi.unstubAllGlobals();setLanguage('ja')});
it('shares exact global and saved-version ranks in text, X intent, screen and PNG',async()=>{
 const s=clear(),r=s.completion!,rank={recordId:r.id,appVersion:r.appVersion,rulesetVersion:r.rulesetVersion,overallRank:63,versionRank:12};
 expect(resultRankingPath(s)).toContain('completionId='+r.id);
 const label=resultRankingText(s,rank);expect(label).toContain('63');expect(label).toContain('12');
 const text=resultShareText(s,'Player',rank);expect(text).toContain(label);expect(text).toContain('#dontwork');
 const intent=new URL(resultXIntent(s,'Player',rank));expect(intent.searchParams.get('text')).toBe(text);expect(intent.searchParams.get('url')).toBe(RESULT_POST_URL);
 const html=renderToStaticMarkup(<ResultCard s={s} name="Player" rank={rank}/>);expect(html).toContain('63');expect(html).toContain('12');
 const drawing:string[]=[];
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop:()=>{}}),fillText:(text:string)=>drawing.push(text)},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{},set:()=>true});
 vi.stubGlobal('document',{createElement:()=>({getContext:()=>ctx,toBlob:(callback:(blob:Blob)=>void)=>callback(new Blob(['png'],{type:'image/png'}))})});
 await resultImage(s,'Player',rank);expect(drawing).toContain(label);
});
it('uses the completed challenge identity and separates it from normal records',()=>{
 const s=advanceTrial(resumeTrial(freshTrial(),1000),TRIAL_MS+1000),r=s.trial!.result!;
 const rank={recordId:r.id,appVersion:r.appVersion,rulesetVersion:r.rulesetVersion,overallRank:5,versionRank:3};
 expect(resultRankingPath(s)).toContain('scoreId='+r.id);expect(resultShareText(s,'Player',rank)).toContain(resultRankingText(s,rank));
 expect(validResultRanking(clear(),rank)).toBe(false);
 setLanguage('en');expect(resultRankingText(s,rank)).toContain('Overall #5');
});
it('does not invent ranks for offline, reset, LAB, stale or invalid responses',()=>{
 const s=clear(),r=s.completion!,valid:ResultRanking={recordId:r.id,appVersion:r.appVersion,rulesetVersion:r.rulesetVersion,overallRank:9,versionRank:2};
 for(const rank of [null,{...valid,recordId:crypto.randomUUID()},{...valid,appVersion:'1.0.0'},{...valid,overallRank:0},{...valid,versionRank:10},{...valid,overallRank:NaN}]){
  expect(resultRankingText(s,rank)).toBe('');expect(resultShareText(s,'Player',rank)).toBe(resultShareText(s,'Player'));
 }
 const lab={...s,completion:{...r,ranked:false}};expect(resultRankingPath(lab)).toBeNull();expect(resultRankingText(lab,valid)).toBe('');
});
