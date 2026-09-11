import { useEffect, useRef, useState } from 'react';
import { request } from './api';
import { RANKING_ORIGIN } from './rankings';
import { boardIdentity, saveBoardIdentity } from './boardIdentity';
import {readBoardDraft,saveBoardDraft,completeBoardAttempt,type BoardAttempt} from './boardDraft';
import { cleanNickname, flushRankings } from './rankingOutbox';
import { flushTrialScores } from './trialScores';
import { t, language } from './i18n';
import type { Run } from './game/engine';
export interface BoardPost {id:number;parentId:number|null;nickname:string;body:string;createdAt:number;replyCount:number;normalRank:number|null;trialRank:number|null;trialRuleset:string|null}
interface BoardPage {posts:BoardPost[];thread:BoardPost|null;nextCursor:number|null}
export function BoardPostCard({post,onReply}: {post:BoardPost;onReply?:(post:BoardPost)=>void}) {
  return <article className="board-post">
    <header><strong>{post.nickname}</strong>{post.normalRank!==null&&<span className="board-rank">{t("通常 {0}位",post.normalRank)}</span>}{post.trialRank!==null&&<span className="board-rank">{t(post.trialRuleset?.includes('-assets:')?'30分 {0}位':'30分・旧 {0}位',post.trialRank)}</span>}</header>
    <p>{post.body}</p><footer><time dateTime={new Date(post.createdAt).toISOString()}>{new Intl.DateTimeFormat(language()==='ja'?'ja-JP':'en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(post.createdAt))}</time>{onReply&&<button className="text-button" onClick={()=>onReply(post)}>{post.replyCount?t("返信 {0}件",post.replyCount):t('返信する')}</button>}</footer>
  </article>;
}
export function Board({run}: {run:Run}) {
  const [savedDraft]=useState(readBoardDraft);
  const [identity]=useState(()=>boardIdentity(run)),[name,setName]=useState(savedDraft.nickname||identity.nickname),[drafts,setDrafts]=useState<Record<string,string>>(savedDraft.drafts);
  const [thread,setThread]=useState<number|null>(savedDraft.thread),[cursor,setCursor]=useState(0),[page,setPage]=useState<BoardPage|null>(null);
  const body=drafts[String(thread)]??'';
  const setBody=(text:string)=>setDrafts(old=>({...old,[String(thread)]:text}));
  const [error,setError]=useState(''),[postError,setPostError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
  const pending=useRef<Record<string,BoardAttempt>>(savedDraft.pending),textarea=useRef<HTMLTextAreaElement>(null),submitting=useRef(false);
  useEffect(()=>{saveBoardIdentity(identity)},[identity]);
  useEffect(()=>{try{saveBoardDraft({nickname:name,thread,drafts,pending:pending.current})}catch{}},[name,thread,drafts]);
  useEffect(()=>{let live=true;setError('');setPage(null);
    void request<BoardPage>(`${RANKING_ORIGIN}/api/board?thread=${thread??0}&cursor=${cursor}`).then(p=>{if(live)setPage(p)}).catch(()=>{if(live)setError(t('掲示板を読み込めませんでした。'))});
    return()=>{live=false};
  },[thread,cursor,refresh]);
  const selectThread=(post:BoardPost)=>{setThread(post.id);setCursor(0);setPostError('');textarea.current?.focus()};
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();if(submitting.current)return;
    const nickname=cleanNickname(name),text=body.trim();if(!nickname||!text)return;
    submitting.current=true;setBusy(true);setPostError('');
    const key=String(thread),old=pending.current[key];
    const attempt:BoardAttempt=old&&old.nickname===nickname&&old.body===text&&old.parentId===thread?old:{requestId:crypto.randomUUID(),actorId:identity.actorId,nickname,body:text,parentId:thread,clearRecordId:identity.clearRecordId,trialRecordId:identity.trialRecordId};
    pending.current[key]=attempt;
    try {
      try{saveBoardDraft({nickname:name,thread,drafts,pending:pending.current})}catch{throw Error(t('下書きを保存できませんでした。投稿内容を控えてから再試行してください。'))}
      // Finish any queued score registration before resolving the public badge.
      await Promise.all([flushRankings(),flushTrialScores()]);
      const posted=await request<{id:number}>(`${RANKING_ORIGIN}/api/board`,attempt);
      completeBoardAttempt(attempt);delete pending.current[key];
      saveBoardIdentity({...identity,nickname});setName(nickname);setBody('');setCursor(thread?posted.id-1:0);setRefresh(n=>n+1);setNotice(t(thread?'返信しました。':'投稿しました。'));
    }catch(e){setPostError(e instanceof Error?e.message:t('投稿できませんでした。'))}
    finally{submitting.current=false;setBusy(false)}
  };
  return <section className="board">
    <div className="board-toolbar">{thread!==null?<button className="secondary" disabled={busy} onClick={()=>{setThread(null);setCursor(0);setPostError('')}}>{t('掲示板に戻る')}</button>:<p>{t('攻略も雑談も、ここに。')}</p>}<button className="text-button" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>{t('更新')}</button></div>
    {page?.thread&&<BoardPostCard post={page.thread}/>}
    <form className="board-form" onSubmit={e=>void submit(e)}>
      <label>{t('名前')}<input required maxLength={16} value={name} disabled={busy} onChange={e=>setName(e.target.value)} autoComplete="nickname"/></label>
      <label>{t(thread?'返信':'投稿')}<textarea ref={textarea} required maxLength={1000} rows={3} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder={t(thread?'返信を書こう':'いま、どう？')}/></label>
      <small>{t('ランキング登録名で投稿すると、全体順位を名前の横に表示します。')}</small>
      <div className="board-form-bottom"><span>{body.length}/1000</span><button className="primary" disabled={busy||!name.trim()||!body.trim()}>{busy?t('送信中…'):t(thread?'返信する':'投稿する')}</button></div>
      {postError&&<p className="negative" role="alert">{postError}</p>}
      {notice&&<p role="status">{notice}</p>}
    </form>
    {error?<p role="alert">{error}<button className="text-button" onClick={()=>setRefresh(n=>n+1)}>{t('再試行')}</button></p>:!page?<p role="status">{t('読み込み中…')}</p>:<>
      <div className="board-posts">{page.posts.map(post=><BoardPostCard key={post.id} post={post} onReply={thread===null&&!busy?selectThread:undefined}/>)}</div>
      {!page.posts.length&&<p className="empty-state">{t(thread?'まだ返信がありません。':'まだ投稿がありません。最初のひとことをどうぞ。')}</p>}
      <div className="button-row">{cursor>0&&<button className="secondary" disabled={busy} onClick={()=>setCursor(0)}>{t('先頭へ')}</button>}{page.nextCursor!==null&&<button className="secondary" disabled={busy} onClick={()=>setCursor(page.nextCursor!)}>{t(thread?'次の返信':'前の投稿')}</button>}</div>
    </>}
  </section>;
}
