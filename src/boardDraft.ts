const KEY='dontwork-board-draft-v1';
export interface BoardAttempt {requestId:string;actorId:string;nickname:string;body:string;parentId:number|null;clearRecordId?:string;trialRecordId?:string}
export interface BoardDraft {nickname:string;thread:number|null;drafts:Record<string,string>;pending:Record<string,BoardAttempt>}
const empty=():BoardDraft=>({nickname:'',thread:null,drafts:{},pending:{}});
export function readBoardDraft():BoardDraft {
  try{
    const raw=localStorage.getItem(KEY);if(!raw||raw.length>5000000)return empty();const value=JSON.parse(raw);
    if(!value||typeof value.nickname!=='string'||!value.drafts||!value.pending)return empty();
    const drafts=Object.fromEntries(Object.entries(value.drafts).filter(([key,text])=>/^(null|[1-9]\d*)$/.test(key)&&typeof text==='string'&&text.length<=2000)) as Record<string,string>;
    const pending=Object.fromEntries(Object.entries(value.pending).filter(([key,p])=>key in drafts&&p&&typeof p==='object'&&typeof (p as BoardAttempt).requestId==='string'&&typeof (p as BoardAttempt).actorId==='string'&&typeof (p as BoardAttempt).body==='string'&&typeof (p as BoardAttempt).nickname==='string'&&((p as BoardAttempt).parentId===null||Number.isSafeInteger((p as BoardAttempt).parentId)))) as Record<string,BoardAttempt>;
    return {nickname:value.nickname.slice(0,32),thread:Number.isSafeInteger(value.thread)&&value.thread>0?value.thread:null,drafts,pending};
  }catch{return empty()}
}
export function saveBoardDraft(value:BoardDraft){
  // Keep every uncertain request, even after many threads have been visited.
  // Only ordinary, inactive drafts are subject to the ten-thread limit.
  const keep=new Set([...Object.keys(value.pending),String(value.thread),...Object.entries(value.drafts).filter(([,text])=>text.trim()).slice(-10).map(([key])=>key)]);
  const drafts=Object.fromEntries(Object.entries(value.drafts).filter(([key])=>keep.has(key)));
  localStorage.setItem(KEY,JSON.stringify({...value,drafts}));
}
export function completeBoardAttempt(attempt:BoardAttempt){
  const saved=readBoardDraft(),key=String(attempt.parentId);
  if(saved.pending[key]?.requestId!==attempt.requestId)return;
  delete saved.pending[key];if(saved.drafts[key]?.trim()===attempt.body)saved.drafts[key]='';saveBoardDraft(saved);
}
