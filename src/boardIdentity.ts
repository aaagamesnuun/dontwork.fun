import { readSave, type Run } from './game/engine';
import { NORMAL_SLOT, TRIAL_SLOT } from './trialSaves';
const KEY='dontwork-board-identity-v1';
export interface BoardIdentity { actorId:string; nickname:string; clearRecordId?:string; trialRecordId?:string }
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function boardIdentity(run:Run):BoardIdentity {
  let saved:Partial<BoardIdentity>={};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')??{}}catch{}
  const identity:BoardIdentity={actorId:uuid(saved.actorId)?saved.actorId:crypto.randomUUID(),nickname:typeof saved.nickname==='string'?saved.nickname:'',clearRecordId:uuid(saved.clearRecordId)?saved.clearRecordId:undefined,trialRecordId:uuid(saved.trialRecordId)?saved.trialRecordId:undefined};
  const runs:Run[]=[];
  try{for(const key of [NORMAL_SLOT,TRIAL_SLOT]){const other=readSave(localStorage.getItem(key));if(other)runs.push(other)}}catch{}
  runs.push(run);
  for(const r of runs){
    if(r.completion?.ranked&&r.completionNickname){identity.clearRecordId=r.completion.id;if(!identity.nickname)identity.nickname=r.completionNickname}
    if(r.trial?.result?.ranked&&r.trial.nickname){identity.trialRecordId=r.trial.result.id;if(!identity.nickname)identity.nickname=r.trial.nickname}
  }
  return identity;
}
export function saveBoardIdentity(identity:BoardIdentity){try{localStorage.setItem(KEY,JSON.stringify(identity))}catch{}}
export function rememberBoardScores(run:Run){if(run.completion?.ranked&&run.completionNickname||run.trial?.result?.ranked&&run.trial.nickname)saveBoardIdentity(boardIdentity(run))}
