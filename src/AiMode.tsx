import { useEffect, useState } from 'react';
import { AiApiError, aiRequest, saveAiConnection, loadAiConnection, type AiConnection, type AiSnapshot } from './aiApi';
import { t, useLanguage } from './i18n';
import { duration, money, TARGET } from './game/engine';
import { WealthChart } from './TradingViews';
import { AiSpectatorSound, useAiSpectatorSound } from './AiSpectatorSound';
import { useAiSpectatorPresentation } from './aiSpectatorPresentation';
import { useReducedMotion } from './useReducedMotion';
import { AiSweep } from './AiSweep';
import './aiMode.css';

export function AiIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><rect x="5" y="7" width="14" height="13" rx="3"/><path d="M12 3v4M2 11v5m20-5v5M9 16h6"/><circle cx="9" cy="11" r=".8"/><circle cx="15" cy="11" r=".8"/></svg>;
}
const statusText = { waiting: 'AIの接続を待っています', active: 'AIがプレイ中', paused: '操作を一時停止中', finished: '$1B達成', revoked: '接続を終了しました', expired: '接続の有効期限が切れました' };
const actions: Record<string, string> = { work: 'WORK', spin: 'SPIN', equip: 'ギャンブル変更', upgrade: '強化', strategy: '作戦更新' };
export default function AiMode() {
  useLanguage();
  const [connection, setConnection] = useState(() => { const query = new URLSearchParams(location.search).get('ai'); return loadAiConnection(query && query !== '1' ? query : undefined); });
  const [id, setId] = useState(() => { const query = new URLSearchParams(location.search).get('ai'); return query && query !== '1' ? query : loadAiConnection()?.id ?? ''; });
  const [latest, setState] = useState<AiSnapshot | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [creating, setCreating] = useState(!id), [ranking, setRanking] = useState(false);
  const [nickname, setNickname] = useState(''), [agentName, setAgentName] = useState('Codex');
  const [retry, setRetry] = useState(0);
  const reduced = useReducedMotion();
  const watching = !creating && !ranking;
  const presentation = useAiSpectatorPresentation(latest, watching, reduced);
  const state = presentation.shown;
  const audio = useAiSpectatorSound(latest, watching, presentation.result);
  const owner = connection?.id === id ? connection : null;
  useEffect(() => {
    if (!id || creating) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 2000); return; }
      try {
        const next = await aiRequest<AiSnapshot>(`/api/ai/sessions/${id}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (controller.signal.aborted) return;
        setState(previous => previous && previous.id === next.id && previous.version > next.version ? previous : next); setError('');
        if (['finished', 'revoked', 'expired'].includes(next.status)) return;
      } catch (e) { if (controller.signal.aborted) return; setError((e as Error).message); if (e instanceof AiApiError && [404, 410].includes(e.status)) return; }
      timer = setTimeout(poll, 1000);
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [id, creating, retry]);
  const persist = (value: AiConnection) => {
    setConnection(value);
    try { saveAiConnection(value); }
    catch { setNotice(t('このブラウザではAI接続を保存できません。この画面を閉じると停止・再発行ができなくなります。')); }
  };
  const create = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await aiRequest<AiConnection & { state: AiSnapshot }>('/api/ai/sessions', { body: { nickname, agentName } });
      persist({ id: result.id, connectionUrl: result.connectionUrl, spectatorUrl: result.spectatorUrl, ownerToken: result.ownerToken });
      setId(result.id); setState(result.state); setCreating(false); history.replaceState(null, '', `/?ai=${result.id}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const control = async (type: 'pause' | 'resume' | 'rotate' | 'revoke') => {
    if (!owner) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await aiRequest<{ state: AiSnapshot; connectionUrl?: string }>(`/api/ai/sessions/${id}/owner`, { body: { type }, ownerToken: owner.ownerToken });
      setState(previous => previous?.id === result.state.id && previous.version <= result.state.version ? result.state : previous);
      if (result.connectionUrl) { persist({ ...owner, connectionUrl: result.connectionUrl }); setNotice(t('新しいURLを発行しました。以前のURLは無効です。')); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(t('コピーしました')); }
    catch { setNotice(t('コピーできませんでした。URLを選択してコピーしてください。')); }
  };
  const live = state && ['waiting', 'active', 'paused'].includes(state.status);
  const controllable = latest && ['waiting', 'active', 'paused'].includes(latest.status);
  return <div className="ai-app">
    <header className="topbar">
      <a className="wordmark" href="/"><img className="brand-icon" src="/icons/dontwork.svg" alt="" width="32" height="32"/><span className="brand-name">dontwork<em>.fun</em></span></a>
      <span className="ai-mode-label"><AiIcon/> AI MODE</span>
      <nav><button onClick={() => setRanking(value => !value)} aria-pressed={ranking}>{t('AIランキング')}</button><a href="/">{t('通常プレイへ')}</a></nav>
    </header>
    <main className="ai-main">
      {error && <p className="ai-error" role="alert">{error}</p>}
      {notice && <p className="ai-notice" role="status">{notice}</p>}
      {ranking ? <AiRanking/> : creating ? <section className="ai-create ai-card">
        <AiIcon/><h1>{t('自分のAIと、$1Bを目指す。')}</h1>
        <p>{t('接続URLをCodexやClaude Codeに渡し、作戦を相談。AIが選ぶギャンブルと資産の動きを、ここで眺められます。')}</p>
        <form onSubmit={event => { event.preventDefault(); void create(); }}>
          <label>{t('ランキング表示名')}<input required maxLength={32} value={nickname} onChange={e => setNickname(e.target.value)} autoComplete="nickname"/></label>
          <label>{t('AIの名前')}<input required maxLength={32} value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="Codex / Claude Code"/></label>
          <button className="primary" disabled={busy || !nickname.trim() || !agentName.trim()}>{busy ? t('発行中…') : t('AI接続URLを発行')}</button>
        </form>
        <p className="muted">{t('WORKは1秒に5回。$1B到達タイムでAI専用ランキングに自動登録されます。通常セーブとは別のプレイです。')}</p>
        {id && <button onClick={() => setCreating(false)}>{t('観戦に戻る')}</button>}
      </section> : state ? <>
        <section className="ai-session-heading"><div><p className={`ai-status ${live && state.status !== 'paused' ? 'is-live' : ''}`}><span/>{t(statusText[state.status])}</p><h1>{state.nickname}<small>{state.agentName}</small></h1></div>
          <div className="ai-session-actions">{owner && live && <><button disabled={busy || !controllable} onClick={() => void control(latest?.status === 'paused' ? 'resume' : 'pause')}>{t(latest?.status === 'paused' ? 'AI操作を再開' : 'AI操作を一時停止')}</button><button disabled={busy || !controllable} onClick={() => void control('revoke')}>{t('接続を終了')}</button></>}<button disabled={busy} onClick={() => setCreating(true)}>{t('新しいAIプレイ')}</button></div>
        </section>
        <section className="ai-metrics"><div><span>{t('総資産')}</span><strong>{money(state.run.cash)}</strong><small>/ $1B</small></div><div><span>{t('経過時間')}</span><strong>{duration(state.elapsedMs)}</strong></div><div><span>SPIN</span><strong>{state.run.spins}</strong></div><div><span>WORK</span><strong>{state.run.work}</strong><small>{t('上限 5回/秒')}</small></div></section>
        <progress className="ai-goal" max={TARGET} value={Math.min(TARGET, state.run.cash)} aria-label={t('$1Bまでの進行')}/>
        {owner && live && <section className="ai-connect ai-card"><div><h2>{t('このURLを自分のAIに渡す')}</h2><p>{t('「このゲームの作戦を一緒に考えて、操作して」と伝えてください。')}</p></div><div className="ai-url"><input readOnly aria-label={t('AI接続URL')} value={owner.connectionUrl} onFocus={e => e.target.select()}/><button className="primary" onClick={() => void copy(owner.connectionUrl)}>{t('URLをコピー')}</button></div><small>{t('URLを知るAIが操作できます。有効期限7日。観戦URLには操作権限がありません。')}</small><button className="ai-text-button" disabled={busy} onClick={() => void control('rotate')}>{t('URLを再発行')}</button></section>}
        <div className="ai-observation"><section className="ai-stage ai-card">
          <div className="ai-stage-heading"><h2>{t('AIのプレイを観戦')}</h2><button onClick={() => void copy(`${location.origin}/?ai=${id}`)}>{t('観戦URLをコピー')}</button></div>
          <AiSpectatorSound audio={audio}/>
          <AiSweep state={state} presentation={presentation} reduced={reduced}/>
          <WealthChart s={state.run}/>
          <div className="ai-portfolio">{state.choices.bets.filter(b => b.count > 0).map(b => <article key={b.id}><strong>{b.name}</strong><span>×{b.count}</span><small>{t('賭け金')} {money(b.stake)}</small></article>)}{!state.run.portfolio.length && <p className="muted">{t('AIがギャンブルを選ぶと、ここに表示されます。')}</p>}</div>
          <div className="ai-upgrades">{state.choices.upgrades.filter(u => u.unlocked).map(u => <span key={u.id}>{u.id.toUpperCase()} <b>Lv.{u.level}</b></span>)}</div>
        </section><aside className="ai-thoughts"><section className="ai-card"><h2>{t('AIの作戦')}</h2><p className="ai-strategy">{state.strategy || t('AIとの会話で決めた作戦を、AIがここに書き込みます。')}</p></section>
          <section className="ai-card"><h2>{t('直近の操作')}</h2><ol className="ai-log">{[...state.log].reverse().map(entry => <li key={entry.version}><div><strong>{t(actions[entry.type] ?? entry.type)} {entry.roll !== undefined ? `→ ${entry.roll}` : entry.betId ? `${entry.betId} ${entry.delta! > 0 ? '+' : ''}${entry.delta}` : entry.upgrade ?? ''}</strong><time>{new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>{entry.reason && <p>{entry.reason}</p>}<small>{money(entry.cash)}</small></li>)}</ol>{!state.log.length && <p className="muted">{t('AIの最初の操作を待っています。')}</p>}</section>
        </aside></div>
        <p className="ai-rules muted">{t('最初の操作から$1B達成までの実時間を計測します。相談・一時停止中も時計は進みます。AI名は自己申告です。')}</p>
      </> : error ? <section className="ai-card ai-session-actions"><button onClick={() => setRetry(value => value + 1)}>{t('更新')}</button><button className="primary" onClick={() => { setError(''); setCreating(true); }}>{t('新しいAIプレイ')}</button></section> : <p role="status">{t('AIプレイを読み込んでいます…')}</p>}
    </main>
  </div>;
}
function AiRanking() {
  const [data, setData] = useState<{ scores: { nickname: string; agentName: string; timeMs: number; spins: number; work: number }[] } | null>(null), [error, setError] = useState('');
  const [page, setPage] = useState(0), [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController(); setData(null); setError(''); void aiRequest<NonNullable<typeof data>>(`/api/ai/rankings?offset=${page * 50}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [page, refresh]);
  return <section className="ai-card ai-ranking"><div className="ai-stage-heading"><h1>{t('AI専用ランキング')}</h1><button onClick={() => setRefresh(value => value + 1)}>{t('更新')}</button></div><p>{t('$1B到達までの時間。WORKは1秒に5回、同じルールで競います。')}</p>{error ? <p role="alert">{error}</p> : !data ? <p role="status">{t('読み込み中…')}</p> : <><div className="ai-table-scroll"><table><thead><tr><th>#</th><th>{t('名前')}</th><th>AI</th><th>{t('タイム')}</th><th>SPIN</th><th>WORK</th></tr></thead><tbody>{data.scores.map((score, index) => <tr key={index}><td>{page * 50 + index + 1}</td><td>{score.nickname}</td><td>{score.agentName}</td><td>{duration(score.timeMs)}</td><td>{score.spins}</td><td>{score.work}</td></tr>)}</tbody></table></div>{!data.scores.length && <p className="ai-empty">{t('まだ記録がありません。最初のAIクリアを目指そう。')}</p>}<div className="ai-pagination"><button disabled={!page} onClick={() => setPage(value => value - 1)}>{t('前へ')}</button><span>{page + 1}</span><button disabled={data.scores.length < 50 || page >= 200} onClick={() => setPage(value => value + 1)}>{t('次へ')}</button></div></>}</section>;
}
