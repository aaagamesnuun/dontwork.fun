import {useEffect,useState} from 'react';
import {request} from './api';
import {RANKING_ORIGIN,rankingVersion} from './rankings';
import {t} from './i18n';
import type {Run} from './game/engine';

export interface ResultRanking {
  recordId:string;appVersion:string;rulesetVersion:string;overallRank:number;versionRank:number;
}
export const rankedRecord=(s:Run)=>s.trial?.result??s.completion;
export function resultRankingPath(s:Run) {
  const record=rankedRecord(s);
  return record?.ranked ? `${RANKING_ORIGIN}/api/${s.trial?'bankroll-rankings?scoreId=':'rankings?completionId='}${encodeURIComponent(record.id)}` : null;
}
export function validResultRanking(s:Run,value:unknown):value is ResultRanking {
  const r=value as ResultRanking|null,record=rankedRecord(s);
  return !!record?.ranked && !!r && r.recordId===record.id && r.appVersion===record.appVersion && r.rulesetVersion===record.rulesetVersion && Number.isSafeInteger(r.overallRank) && r.overallRank>0 && Number.isSafeInteger(r.versionRank) && r.versionRank>0 && r.versionRank<=r.overallRank;
}
export function resultRankingText(s:Run,rank?:ResultRanking|null) {
  return validResultRanking(s,rank) ? t('全体 {0}位 · {1} {2}位',rank.overallRank,rankingVersion(rank.appVersion),rank.versionRank) : '';
}
export function ResultRank({s,rank}:{s:Run;rank?:ResultRanking|null}) {
  return validResultRanking(s,rank) ? <div className="result-rank"><strong>{t('全体 {0}位',rank.overallRank)}</strong><span>{t('{0} {1}位',rankingVersion(rank.appVersion),rank.versionRank)}</span></div> : null;
}
type RankStatus='waiting'|'loading'|'ready'|'missing'|'error';
export function useResultRanking(s:Run,active:boolean) {
  const path=active?resultRankingPath(s):null;
  const submitted=s.trial?s.trial.submitted:s.submitted;
  const eligible=!!path&&submitted;
  const [attempt,retry]=useState(0);
  const [state,setState]=useState<{path:string|null;attempt:number;status:RankStatus;ranking:ResultRanking|null}>({path:null,attempt:0,status:'waiting',ranking:null});
  useEffect(()=>{
    if(!eligible)return;
    let live=true;setState({path,attempt,status:'loading',ranking:null});
    void request<{ranking:ResultRanking|null}>(path!).then(data=>{
      if(!live)return;
      if(data.ranking!==null&&!validResultRanking(s,data.ranking))throw Error('Invalid rank response');
      setState({path,attempt,status:data.ranking?'ready':'missing',ranking:data.ranking});
    }).catch(()=>{if(live)setState({path,attempt,status:'error',ranking:null});});
    return()=>{live=false};
  },[path,eligible,attempt]);
  useEffect(()=>{if(!eligible)return;const online=()=>retry(n=>n+1);window.addEventListener('online',online);return()=>window.removeEventListener('online',online)},[eligible]);
  const current=eligible&&state.path===path&&state.attempt===attempt;
  return {ranking:current?state.ranking:null,status:eligible?(current?state.status:'loading') as RankStatus:'waiting' as RankStatus,retry:()=>retry(n=>n+1)};
}
export function ResultRankStatus({status,retry}:{status:RankStatus;retry:()=>void}) {
  if(status==='waiting'||status==='ready')return null;
  return <p className="setting-note" role="status">{status==='loading'?t('順位を取得中…'):status==='missing'?t('この記録は現在のランキングにありません。'):t('順位を取得できませんでした。')}{status!=='loading'&&<button className="text-button" onClick={retry}>{t('順位を再取得')}</button>}</p>;
}
