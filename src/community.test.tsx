import {afterEach,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {RankingPeriods,RankingSummary} from './RankingPeriod';
import {rankingPath} from './rankings';
import {trialRankingPath} from './trialScores';
import {BoardPostCard,Board,type BoardPost} from './Board';
import {boardIdentity,rememberBoardScores} from './boardIdentity';
import {CommunityLinks,GITHUB_URL,CREATOR_URL} from './CommunityLinks';
import {freshRun,work,TARGET} from './game/engine';
import {setLanguage} from './i18n';
import {readBoardDraft,saveBoardDraft,completeBoardAttempt} from './boardDraft';
afterEach(()=>{vi.unstubAllGlobals();setLanguage('ja')});
it('keeps period, version, pagination and scoring filters independent',()=>{
 const normal=new URL(rankingPath('3.0.0',50,'week'));
 expect(Object.fromEntries(normal.searchParams)).toEqual({version:'3.0.0',offset:'50',period:'week'});
 const trial=new URL(trialRankingPath('2.9.0',100,'cash','day'));
 expect(Object.fromEntries(trial.searchParams)).toEqual({version:'2.9.0',offset:'100',scoring:'cash',period:'day'});
});
it('renders selected period and a population average independently of page size',()=>{
 for(const lang of ['ja','en'] as const){setLanguage(lang);
  const controls=renderToStaticMarkup(<RankingPeriods value="week" onChange={()=>{}}/>);
  expect(controls).toContain('aria-pressed="true"');expect(controls).toContain(lang==='ja'?'週次':'Weekly');
  const html=renderToStaticMarkup(<RankingSummary page={{period:'day',periodStart:'2026-09-11T15:00:00Z',periodEnd:'2026-09-12T15:00:00Z',total:123}} label="Average" value="00:31"/>);
  expect(html).toContain('123');expect(html).toContain('00:31');expect(html).toContain(lang==='ja'?'日本時間':'Japan time');
 }
});
it('renders post content as text and uses separate normal and timed rank badges',()=>{
 const post:BoardPost={id:1,parentId:null,nickname:'<img src=x>',body:'<script>alert(1)</script>\nLine 2',createdAt:Date.now(),replyCount:3,normalRank:9,trialRank:2,trialRuleset:'astra-v13-30m-assets:classic'};
 const html=renderToStaticMarkup(<BoardPostCard post={post} onReply={()=>{}}/>);
 expect(html).not.toContain('<script>');expect(html).not.toContain('<img src=x>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('通常 9位');expect(html).toContain('30分 2位');expect(html).toContain('返信 3件');
 expect(renderToStaticMarkup(<BoardPostCard post={{...post,normalRank:null,trialRank:null}}/>)).not.toContain('board-rank');
});
it('retains the private score reference after a new normal run without changing its save',()=>{
 const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)});
 const completed={...work({...freshRun(),cash:TARGET-1,activeMs:2000}),completionNickname:'nuun'};
 rememberBoardScores(completed);const first=boardIdentity(completed),next=boardIdentity(freshRun());
 expect(next).toMatchObject({actorId:first.actorId,clearRecordId:completed.completion!.id,nickname:'nuun'});
 expect(memory.size).toBe(1);
 const lab={...completed,completion:{...completed.completion!,id:crypto.randomUUID(),ranked:false}};rememberBoardScores(lab);
 expect(boardIdentity(freshRun()).clearRecordId).toBe(completed.completion!.id);
});
it('offers a single board and links to the forkable repository and creator',()=>{
 const html=renderToStaticMarkup(<Board run={freshRun()}/>);
 expect(html).toContain('name');expect(html).toContain('textarea');expect(html).toContain('投稿する');expect(html).not.toContain('type="file"');
 const links=renderToStaticMarkup(<CommunityLinks/>);expect(links).toContain(GITHUB_URL);expect(links).toContain(CREATOR_URL);expect(links).toContain('フォーク');
});
it('keeps an uncertain submission and its retry ID through closing the board',()=>{
 const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)});
 const attempt={requestId:crypto.randomUUID(),actorId:crypto.randomUUID(),nickname:'nuun',body:'Hello',parentId:21};
 saveBoardDraft({nickname:'nuun',thread:21,drafts:{'21':'Hello',null:'Another draft'},pending:{'21':attempt}});
 expect(readBoardDraft().pending['21']).toEqual(attempt);
 completeBoardAttempt({...attempt,requestId:crypto.randomUUID()});
 expect(readBoardDraft().drafts['21']).toBe('Hello');
 completeBoardAttempt(attempt);
 expect(readBoardDraft()).toMatchObject({drafts:{'21':'',null:'Another draft'},pending:{}});
});
it('does not erase newer writing when a delayed submission finishes',()=>{
 const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)});
 const attempt={requestId:crypto.randomUUID(),actorId:crypto.randomUUID(),nickname:'nuun',body:'First draft',parentId:null};
 saveBoardDraft({nickname:'nuun',thread:null,drafts:{null:'New draft'},pending:{null:attempt}});
 completeBoardAttempt(attempt);expect(readBoardDraft().drafts.null).toBe('New draft');
});
it('retains uncertain requests and the active draft after more than ten threads',()=>{
 const memory=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)});
 const attempt={requestId:crypto.randomUUID(),actorId:crypto.randomUUID(),nickname:'nuun',body:'Uncertain',parentId:1};
 const drafts=Object.fromEntries(Array.from({length:25},(_,i)=>[String(i+1),i===0?'Uncertain':`Draft ${i+1}`]));
 saveBoardDraft({nickname:'nuun',thread:2,drafts,pending:{'1':attempt}});
 expect(readBoardDraft().pending['1']).toEqual(attempt);expect(readBoardDraft().drafts['1']).toBe('Uncertain');expect(readBoardDraft().drafts['2']).toBe('Draft 2');
});
