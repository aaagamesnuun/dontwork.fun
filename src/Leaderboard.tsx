import { t as _t, textValue as _text } from "./i18n";
import { flushRankings, completionTarget } from "./rankingOutbox";
import { useEffect, useState } from "react";
import { CATALOGS } from "./game/catalog";
import { VERSION, duration, money, type Run } from "./game/engine";
import { request } from "./api";
import { ResultCard, clearCardRun, effortStats } from "./ResultCard";
import { resultImage, resultShareText, resultXIntent, RESULT_POST_URL } from "./resultShare";
import { rankingPath, rankingVersion, type RankingPage, } from "./rankings";
import type { Change } from "./App";
export function Leaderboard({ s, change, clear = false, notify, saveName, onRanking, }: {
    s: Run;
    change: Change;
    clear?: boolean;
    notify: (message: string) => void;
    saveName: (name: string) => Run;
    onRanking?: () => void;
}) {
    const [resultRun] = useState(() => clearCardRun(s));
    const [view, setView] = useState<"all" | "version">("all"), [version, setVersion] = useState(VERSION), [offset, setOffset] = useState(0);
    const [page, setPage] = useState<RankingPage | null>(null), [versions, setVersions] = useState([VERSION]), [refresh, setRefresh] = useState(0);
    const [name, setName] = useState(s.completionNickname ?? ""), [error, setError] = useState(""), [postError, setPostError] = useState(""), [busy, setBusy] = useState(false);
    useEffect(() => {
        if (clear)
            return;
        let alive = true;
        setPage(null);
        setError("");
        void request<RankingPage>(rankingPath(view === "all" ? "all" : version, offset))
            .then((result) => {
            if (!alive)
                return;
            setPage(result);
            setVersions([...new Set([VERSION, ...result.versions])].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
        })
            .catch((e) => {
            if (alive)
                setError(e instanceof Error
                    ? e.message
                    : _t("ランキングを読み込めませんでした。"));
        });
        return () => {
            alive = false;
        };
    }, [clear, view, version, offset, refresh]);
    const completion = s.completion;
    const named = !!s.completionNickname;
    const [cardImage, setCardImage] = useState<Blob | null>(null), [imageFailed, setImageFailed] = useState(false);
    useEffect(() => { let live = true; setCardImage(null); setImageFailed(false); if (clear && named)
        void resultImage(resultRun, s.completionNickname).then(blob => { if (live)
            setCardImage(blob); }).catch(() => { if (live)
            setImageFailed(true); }); return () => { live = false; }; }, [clear, named, s.completionNickname, resultRun]);
    const [imageUrl, setImageUrl] = useState("");
    useEffect(() => { if (!cardImage) {
        setImageUrl("");
        return;
    } const url = URL.createObjectURL(cardImage); setImageUrl(url); return () => URL.revokeObjectURL(url); }, [cardImage]);
    const share = async () => {
        if (!named)
            return;
        const text = resultShareText(resultRun, s.completionNickname), url = RESULT_POST_URL;
        const file = cardImage ? new File([cardImage], 'dontwork.fun-clear.png', { type: 'image/png' }) : null;
        try {
            if (file && navigator.canShare?.({ files: [file] }) && navigator.share)
                await navigator.share({ title: 'dontwork.fun', text, url, files: [file] });
            else if (navigator.share)
                await navigator.share({ title: 'dontwork.fun', text, url });
            else if (cardImage) {
                window.open(resultXIntent(resultRun, s.completionNickname), '_blank', 'noopener,noreferrer');
            }
            else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text + '\n' + url);
                notify(_t("結果をコピーしました。"));
            }
            else
                notify(_t("この画面をスクリーンショットで共有できます。"));
        }
        catch (e) {
            if (!(e instanceof DOMException && e.name === 'AbortError'))
                notify(_t("共有できませんでした。記念画像の長押しかスクリーンショットをお使いください。"));
        }
    };
    return (<>
      {clear && (named ? imageUrl ? <img className="share-card-image" src={imageUrl} alt={_t(resultRun.settings.coinFlip || resultRun.coinRounds > 0 ? "{0}のクリア記念カード。WORK {1}回、FLIP賭け金 {2}、損益 {3}" : "{0}のクリア記念カード。WORK {1}回。", s.completionNickname, effortStats(resultRun).work, effortStats(resultRun).wager, effortStats(resultRun).profit)}/> : <ResultCard s={resultRun} name={s.completionNickname}/> : <div className="clear-name-intro"><span>GOAL CLEARED</span><h3>{_t("{0}達成！", money(completionTarget(resultRun)))}</h3><strong>{duration(resultRun.completion?.timeMs ?? resultRun.clearActiveMs ?? resultRun.activeMs)}</strong><p>{_t("この記録に、あなたの名前を。")}</p><small>{completion?.ranked ? _t("名前とクリア時間がランキングに公開されます。") : _t("LABの記録です。名前は端末だけに保存します。")}</small></div>)}
      {!clear && <>
      <div className="leaderboard-title">
        <h3>{_t("クリア時間ランキング")}</h3>
        <span className="micro">FASTEST TO {money(completionTarget(s))}</span>
      </div>
      </>}
      {completion && s.clearAt !== null && !named && (<form className="score-form" onSubmit={async (e) => {
                e.preventDefault();
                if (busy)
                    return;
                setBusy(true);
                setPostError("");
                const id = completion.id;
                try {
                    const named = saveName(name);
                    change(run => run.completion?.id === id ? { ...run, completionNickname: named.completionNickname } : run);
                    notify(completion.ranked ? _t("名前を保存しました。通信できるときにランキングへ送信します。") : _t("名前を保存しました。LABの記録は公開されません。"));
                    const sent = await flushRankings();
                    if (sent.includes(id)) {
                        change(run => run.completion?.id === id ? { ...run, submitted: true } : run);
                        setRefresh(n => n + 1);
                    }
                }
                catch (e) {
                    setPostError(e instanceof Error ? e.message : _t("投稿できませんでした。"));
                }
                finally {
                    setBusy(false);
                }
            }}>
          {!clear && <p className="score-form-note">{_t("{0} {1}の記録として登録します。", completion.ranked ? _t("名前とクリア時間を公開して、友達と比べよう。") : _t("このLABプレイはランキング対象外。名前は端末に保存します。"), rankingVersion(completion.appVersion))}</p>}
          <input required maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-label={_t("ランキングに公開する名前")} placeholder={_t("名前（16文字まで）")} autoComplete="nickname"/>
          <button className="primary" disabled={busy || !name.trim()}>
            {busy ? _t("送信中…") : s.completionNickname ? _t("名前を保存・再送") : _t("名前を保存して登録")}
          </button>
        </form>)}
      {named && !s.submitted && completion?.ranked && <p role="status" className="setting-note">{_t("送信待ち · 閉じても自動で再試行します。")}{!clear && <button className="text-button" disabled={busy} onClick={async () => { setBusy(true); try {
        const sent = await flushRankings();
        if (sent.includes(completion.id)) {
            change(run => run.completion?.id === completion.id ? { ...run, submitted: true } : run);
            setRefresh(n => n + 1);
        }
    }
    finally {
        setBusy(false);
    } }}>{_t("再送")}</button>}</p>}
      {!clear && s.submitted && (<p className="setting-note">{_t("このクリアは登録済みです。")}</p>)}
      {!clear && !s.submitted && !completion?.ranked && (<p className="setting-note">
          {s.debug
                ? _t("LABでルールを変えたプレイはランキング対象外です。") : _t("クリアすると、ここから名前と時間を登録できます。")}
        </p>)}
      {postError && (<p className="negative" role="status">
          {_text(postError)}
        </p>)}
      {clear && named && <><div className="result-actions"><a className="primary" href={resultXIntent(resultRun, s.completionNickname)} target="_blank" rel="noopener noreferrer">{_t("Xで引用して共有 ↗")}</a><button className="primary" disabled={!cardImage && !imageFailed} onClick={() => void share()}>{imageFailed ? _t("結果をテキストで共有") : cardImage ? _t("記念カードをシェア ↗") : _t("画像を準備中…")}</button></div><p className="setting-note">{_t("画像を長押しして保存、またはスクリーンショットで共有できます。")}</p>{imageFailed && <p className="setting-note">{_t("画像を作成できませんでした。このカードをスクリーンショットで共有できます。")}</p>}<button className="text-button result-ranking" onClick={onRanking}>{_t("ランキングを見る →")}</button></>}
      {!clear && <>
      <div className="ranking-controls">
        <div className="ranking-tabs" role="group" aria-label={_t("ランキングの範囲")}>
          <button className={view === "all" ? "selected" : ""} aria-pressed={view === "all"} onClick={() => {
                setView("all");
                setOffset(0);
            }}>{_t("全体ランキング")}</button>
          <button className={view === "version" ? "selected" : ""} aria-pressed={view === "version"} onClick={() => {
                setView("version");
                setOffset(0);
            }}>{_t("バージョン別")}</button>
        </div>
        {view === "version" && (<label className="setting-row">
            <span>{_t("バージョン")}</span>
            <select aria-label={_t("ランキングのバージョン")} value={version} onChange={(e) => {
                    setVersion(e.target.value);
                    setOffset(0);
                }}>
              {versions.map((v) => (<option value={v} key={v}>
                  {rankingVersion(v)}
                </option>))}
            </select>
          </label>)}
      </div>
      {error ? (<div role="status">
          <p className="negative">{_text(error)}</p>
          <button className="secondary" onClick={() => setRefresh((n) => n + 1)}>{_t("もう一度読み込む")}</button>
        </div>) : !page ? (<p role="status">{_t("ランキングを読み込んでいます…")}</p>) : (<>
          <p className="setting-note">{_t("{0}件のクリア記録 · 実プレイ時間の短い順", page.total.toLocaleString())}</p>
          {page.scores.length ? (<table className="scores">
              <thead>
                <tr>
                  <th>{_t("順位")}</th>
                  <th>{_t("名前")}</th>
                  <th>{_t("クリア時間")}</th>
                  <th>ver</th>
                </tr>
              </thead>
              <tbody>
                {page.scores.map((score, i) => (<tr key={score.id}>
                    <td>{offset + i + 1}</td>
                    <td>
                      <strong>{score.nickname}</strong>
                      <small className="score-catalog">
                        {score.appVersion === "pe-legacy"
                            ? _t("旧版の記録") : (CATALOGS.find((c) => c.id === score.catalog)
                            ?.name ?? score.catalog)}
                      </small>
                    </td>
                    <td>{duration(score.timeMs)}</td>
                    <td>{rankingVersion(score.appVersion)}</td>
                  </tr>))}
              </tbody>
            </table>) : (<div className="empty-state">{_t("このバージョンは、最初のクリアを待っています。")}</div>)}
          {(offset > 0 || offset + page.scores.length < page.total) && (<div className="button-row">
              <button className="secondary" disabled={offset === 0} onClick={() => setOffset((n) => Math.max(0, n - 50))}>{_t("前の50件")}</button>
              <button className="secondary" disabled={offset + page.scores.length >= page.total} onClick={() => setOffset((n) => n + 50)}>{_t("次の50件")}</button>
            </div>)}
        </>)}
      </>}
    </>);
}
