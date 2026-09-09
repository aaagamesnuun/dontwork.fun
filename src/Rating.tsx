import { language } from "./i18n";
import { t as _t, textValue as _text } from "./i18n";
import { useState } from "react";
import { VERSION } from "./game/engine";
export function Rating({ source, feedbackId, onSend, onDone }: {
    source: "feedback" | "clear";
    feedbackId?: string;
    onSend: (body: Record<string, unknown>) => Promise<unknown>;
    onDone?: () => void;
}) {
    const [stars, setStars] = useState(0), [busy, setBusy] = useState(false), [attempted, setAttempted] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
    const [ratingId] = useState(() => crypto.randomUUID());
    return <div className="rating-panel"><p>{source === "feedback" ? _t("メッセージが届きました。") : _t("クリア、おめでとう！")}</p><h3>{sent ? _t("評価ありがとう！") : _t("遊んでみて、どうだった？")}</h3>{sent ? <><p>{_t("次の改善に役立てます。")}</p>{onDone && <button className="primary" onClick={onDone}>{_t("ゲームに戻る")}</button>}</> : <>
 <div className="rating-stars" role="group" aria-label={_t("5段階の評価")}>{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-label={_t("{0}つ星", n)} aria-pressed={stars === n} className={n <= stars ? "selected" : ""} disabled={busy || attempted} onClick={() => setStars(n)}>★</button>)}</div>
 <p>{stars ? `${stars} / 5` : _t("星を選んでください")}</p>
 {error && <p role="alert" className="negative">{_text(error)}</p>}
 <button type="button" className="primary" disabled={!stars || busy} onClick={async () => { setAttempted(true); setBusy(true); setError(""); try {
            await onSend({ ratingId, stars, source, feedbackId, appVersion: VERSION, language: language() });
            setSent(true);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : _t("送信できませんでした。もう一度お試しください。"));
        }
        finally {
            setBusy(false);
        } }}>{busy ? _t("送信中…") : error ? _t("もう一度送る") : _t("評価を送る")}</button>
 {onDone && <button type="button" className="text-button" disabled={busy} onClick={onDone}>{_t("今はスキップ")}</button>}</>}</div>;
}
export const clearRatingKey = (id: string) => `bebullish-clear-rating-seen:${id}`;
export function shouldAskClearRating(id: string) { try {
    return localStorage.getItem(clearRatingKey(id)) !== "1";
}
catch {
    return true;
} }
export function markClearRating(id: string) { try {
    localStorage.setItem(clearRatingKey(id), "1");
}
catch { /* Optional device preference. */ } }
