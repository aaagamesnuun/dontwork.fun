import { t as _t, textValue as _text } from "./i18n";
import { useEffect, useState } from 'react';
import { money, VERSION, trialRemaining, trialTimePrice, type Run, type TrialRule } from './game/engine';
import { WealthChart } from './TradingViews';
import { resultShareText, resultXIntent, RESULT_POST_URL } from "./resultShare";
import {useResultRanking,ResultRank,ResultRankStatus} from './resultRanking';
import {useResultImage} from './useResultImage';
import { request } from './api';
import { trialRankingPath, saveTrialName, flushTrialScores } from './trialScores';
import {RankingPeriods, RankingSummary, type RankingPeriod, type PeriodInfo} from './RankingPeriod';
export const trialClock = (ms: number) => { const seconds = Math.ceil(ms / 1000); return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; };
export const trialRuleLabel = (rule: TrialRule) => rule === 'fixed' ? _t("30分モード") : rule === 'shop' ? _t("時間ショップ · LAB") : _t("時間ガチャ · LAB");
export function TrialClock({ s, onResult }: {
    s: Run;
    onToggle?: () => void;
    onResult: () => void;
}) {
    const t = s.trial;
    if (!t)
        return null;
    return <div className={`trial-clock ${trialRemaining(t) <= 60000 ? 'trial-last-minute' : ''} ${t.paused ? 'is-paused' : ''}`}>
  <small>{t.result ? _t("終了") : t.paused ? _t("砂時計で開始・再開") : _t("残り時間")}</small>
  <strong role="timer" aria-label={_t("残り時間")}>{trialClock(trialRemaining(t))}</strong>
  {t.result && <button onClick={onResult}>{_t("結果を見る")}</button>}
 </div>;
}
export function TrialControl({s,onToggle,onResult}:{s:Run;onToggle:()=>void;onResult:()=>void}) {
    const trial=s.trial;
    if (!trial) return null;
    if (trial.result) return <div className="auto-control trial-time-control"><TrialClock s={s} onResult={onResult}/></div>;
    return <button className={`auto-control trial-time-control ${trial.paused ? "" : "on"}`} onClick={onToggle} aria-pressed={!trial.paused} aria-label={trial.paused ? _t("砂時計：時間を開始・再開") : _t("砂時計：時間を一時停止")} data-ui-cue="auto">
      <span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M6 3h12M6 21h12M7 3v4l5 5-5 5v4m10-18v4l-5 5 5 5v4M9 7h6M9 18h6"/></svg><b>{trial.paused ? _t("開始・再開") : _t("一時停止")}</b></span>
      <TrialClock s={s} onResult={onResult}/>
    </button>;
}
export function TrialModes({ s, onSwitch, lab = false }: {
    s: Run;
    onSwitch: (mode: 'normal' | 'trial', rule?: TrialRule) => void;
    lab?: boolean;
}) {
    const [confirm, setConfirm] = useState<TrialRule | null>(null);
    return <section className="trial-modes">
 <h3>{_t("30分で、どこまで増やせる？")}</h3>
 <p>{_t("現金＋強化に使った総額で競います。砂時計ボタンで開始・一時停止。開始中は賭け金不足でも時計が進み、WORKできます。ギャンブル変更と強化購入はいつでもできます。画面を離れると時計とスピンが止まります。")}</p>
 <p className="setting-note">{_t("通常モードのセーブは別に残ります。")}</p>
 <div className="menu-grid">
 {s.trial ? <button className="secondary" onClick={() => onSwitch('normal')}>{_t("通常モードに戻る →")}</button> : <button className="primary" onClick={() => onSwitch('trial')}>{_t("30分モードへ →")}</button>}
 <button className="secondary" onClick={() => setConfirm('fixed')}>{_t("新しく30分に挑戦")}</button>
 {lab && <><button className="secondary" onClick={() => setConfirm('shop')}>{_t("LAB · 時間を買える30分")}</button><button className="secondary" onClick={() => setConfirm('lottery')}>{_t("LAB · 時間を当てる30分")}</button></>}
 </div>
 {lab && <p className="setting-note">{_t("時間ショップ：資産の10%（最低$100）で+60秒。時間ガチャ：同額で50%の抽選、当たると+120秒。LAB版は標準ランキング対象外。")}</p>}
 {confirm && <div className="trial-confirm"><p>{_t("{0}を$0から始めます。前回の30分モードの進行を置き換えます。", trialRuleLabel(confirm))}</p><div className="button-row"><button className="secondary" onClick={() => setConfirm(null)}>{_t("戻る")}</button><button className="primary" onClick={() => { onSwitch('trial', confirm); setConfirm(null); }}>{_t("新しく始める")}</button></div></div>}
 </section>;
}
export function TrialTimeShop({ s, budget, onBuy }: {
    s: Run;
    budget: number;
    onBuy: () => void;
}) {
    const t = s.trial;
    if (!t || t.rule === 'fixed' || t.result)
        return null;
    const price = trialTimePrice(budget);
    return <section className="trial-time-shop"><button className="secondary" disabled={budget < price} onClick={onBuy}>{t.rule === 'shop' ? _t("+60秒を買う") : _t("50%で+120秒")} <b>{money(price)}</b></button>
 {t.lastPurchase && <span role="status">{t.lastPurchase.addedMs ? _t("+{0}秒", t.lastPurchase.addedMs / 1000) : _t("延長なし")} · −{money(t.lastPurchase.cost)}</span>}
 </section>;
}
export function TrialResult({ s, onChange, onRanking, onRetry, onNormal }: {
    s: Run;
    onChange: (fn: (s: Run) => Run) => void;
    onRanking: () => void;
    onRetry: () => void;
    onNormal: () => void;
}) {
    const t = s.trial!, r = t.result!;
    const [name, setName] = useState(t.nickname), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const rank=useResultRanking(s,!!t.nickname);
    const {blob:image,url:imageUrl,failed:imageFailed}=useResultImage(s,t.nickname,rank.ranking,!!t.nickname&&rank.status!=="loading");
    const share=async()=>{const text=resultShareText(s,t.nickname,rank.ranking),url=RESULT_POST_URL,file=image?new File([image],"dontwork.fun-30m.png",{type:"image/png"}):null;try{if(file&&navigator.canShare?.({files:[file]})&&navigator.share)await navigator.share({text,url,files:[file]});else if(navigator.share)await navigator.share({text,url});else window.open(resultXIntent(s,t.nickname,rank.ranking),"_blank","noopener,noreferrer");}catch(e){if(!(e instanceof DOMException&&e.name==="AbortError"))setError(_t("この画面をスクリーンショットで共有できます。"));}};
    const submit = async () => { setBusy(true); setError(''); try {
        const next = saveTrialName(s, name);
        onChange(run => run.id === s.id ? next : run);
        const ids = await flushTrialScores();
        onChange(run => run.trial && ids.includes(run.id) ? { ...run, trial: { ...run.trial, submitted: true } } : run);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : _t("保存できませんでした。"));
    }
    finally {
        setBusy(false);
    } };
    return <>{imageUrl?<img className="share-card-image" src={imageUrl} alt={_t("30分モードの記念カード")}/>:<section className="result-card trial-result"><div className="result-brand"><img src="/icons/dontwork.svg" alt="" width="34"/><strong>dontwork.fun</strong><span>TIME UP</span></div>
 <div className="result-hero"><span>{trialClock(r.durationMs)} · FINAL ASSETS</span><h3>{money(r.finalBankroll)}</h3><p>{t.nickname || _t("30分、おつかれさま！")}</p></div>
 <ResultRank s={s} rank={rank.ranking}/><WealthChart s={{ ...s, coinChartHold: null, settings: { ...s.settings, chartAxis: 'spins' } }} summary/>
 <div className="result-numbers"><div><b>{r.spins.toLocaleString()}</b><span>{_t("スピン")}</span></div><div><b>{money(s.spent)}</b><span>{_t("強化への投資")}</span></div><div><b>{s.maxChain}</b><span>{_t("最大連鎖")}</span></div></div>
 <div className="result-numbers"><div><b>{s.work.toLocaleString()}</b><span>{_t("WORK回数")}</span></div>{(s.settings.coinFlip || s.coinRounds > 0) && <><div><b>{money(s.coinWagered)}</b><span>{_t("FLIPの賭け金累計")}</span></div><div><b>{money(s.coinPaid - s.coinWagered)}</b><span>{_t("FLIPの損益")}</span></div></>}</div><footer>{r.ranked ? '30 MIN RECORD' : 'LAB RECORD'} · v{r.appVersion}</footer></section>}
 {t.nickname && <><ResultRankStatus status={rank.status} retry={rank.retry}/><a className="primary" href={rank.status==="loading"?undefined:resultXIntent(s,t.nickname,rank.ranking)} aria-disabled={rank.status==="loading"} target="_blank" rel="noopener noreferrer">{_t("Xで共有 ↗")}</a><button className="primary" disabled={rank.status==="loading"||(!image&&!imageFailed)} onClick={()=>void share()}>{_t("記念カードをシェア ↗")}</button><p className="setting-note">{_t("画像を長押しして保存、またはスクリーンショットで共有できます。")}</p></>}
 {!t.nickname ? <form className="trial-name" onSubmit={e => { e.preventDefault(); void submit(); }}><label>{_t("ランキングの名前")}<input value={name} maxLength={32} onChange={e => setName(e.target.value)} autoComplete="nickname" placeholder={_t("名前")}/></label><button className="primary" disabled={busy || !name.trim()}>{_t("名前を保存")}</button></form> : <p role="status">{!r.ranked ? _t("LABの記録を端末に保存しました。") : t.submitted ? _t("ランキングに登録しました。") : _t("名前を保存しました。通信できるときに自動で再送します。")}</p>}
 {t.nickname && r.ranked && !t.submitted && <button className="secondary" disabled={busy} onClick={() => void submit()}>{busy ? _t("送信中…") : _t("ランキングへ再送")}</button>}
 {error && <p role="alert">{_text(error)}</p>}
 <div className="menu-grid"><button className="primary" disabled={!t.nickname} onClick={onRanking}>{_t("30分ランキング →")}</button><button className="secondary" disabled={!t.nickname} onClick={onRetry}>{_t("もう一度挑戦")}</button><button className="secondary" disabled={!t.nickname} onClick={onNormal}>{_t("通常モードに戻る")}</button></div>
 </>;
}
interface TrialPage extends PeriodInfo {
    averageBankroll: number | null;
    scores: {
        id: number;
        nickname: string;
        appVersion: string;
        finalBankroll: number;
        spins: number;
    }[];
    total: number;
    versions: string[];
    pageSize: number;
}
export function TrialLeaderboard() {
    const [period,setPeriod]=useState<RankingPeriod>('all');
    const [scoring,setScoring]=useState('assets');
    const [version, setVersion] = useState('all'), [offset, setOffset] = useState(0), [page, setPage] = useState<TrialPage | null>(null), [error, setError] = useState(''), [reload, setReload] = useState(0);
    useEffect(() => { let live = true; setPage(null); setError(''); void request<TrialPage>(trialRankingPath(version, offset,scoring,period)).then(p => { if (live)
        setPage(p); }).catch(e => { if (live)
        setError(e instanceof Error ? e.message : _t("読み込めませんでした。")); }); return () => { live = false; }; }, [version, offset, reload,scoring,period]);
    return <section><RankingPeriods value={period} onChange={p=>{setPeriod(p);setOffset(0)}}/><h3>{_t(scoring==="assets"?"30分・総資産ランキング":"30分・現金ランキング")}</h3><label className="setting-row"><span>{_t("採点ルール")}</span><select value={scoring} onChange={e=>{setScoring(e.target.value);setVersion("all");setOffset(0)}}><option value="assets">{_t("現金＋強化への投資")}</option><option value="cash">{_t("旧ルール · 現金のみ")}</option></select></label><label className="setting-row"><span>{_t("表示")}</span><select value={version} onChange={e => { setVersion(e.target.value); setOffset(0); }}><option value="all">{_t("全バージョン")}</option>{[...new Set([VERSION, ...page?.versions ?? []])].map(v => <option key={v} value={v}>v{v}</option>)}</select></label>
 {error ? <p role="alert">{_text(error)} <button onClick={() => setReload(n => n + 1)}>{_t("再試行")}</button></p> : !page ? <p role="status">{_t("読み込み中…")}</p> : <><RankingSummary page={page} label={_t(scoring==="assets"?"平均総資産":"平均現金")} value={page.averageBankroll==null?"—":money(page.averageBankroll)}/><ol className="trial-ranking" start={offset + 1}>{page.scores.map((r, i) => <li key={r.id}><span>{offset + i + 1}</span><div><strong>{r.nickname}</strong><small>{_t("v{0} · {1}スピン", r.appVersion, r.spins.toLocaleString())}</small></div><b>{money(r.finalBankroll)}</b></li>)}</ol>{page.total === 0 && <p>{_t("まだ記録がありません。最初の挑戦者になろう。")}</p>}<div className="button-row"><button disabled={!offset} onClick={() => setOffset(n => Math.max(0, n - 50))}>{_t("前へ")}</button><span>{_t("{0}件", page.total)}</span><button disabled={offset + 50 >= page.total} onClick={() => setOffset(n => n + 50)}>{_t("次へ")}</button></div></>}
 </section>;
}
