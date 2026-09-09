import { t as _t, textValue as _text } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { catalogById } from "./game/catalog";
import { money, VERSION, type Run } from "./game/engine";
import { normalizeSaveCode, validSaveCode, saveCodeRequest } from "./saveCodes";
import { openDomainMigration, readMigration } from './domainMigration';
import { decodeTransfer, MAX_SAVE_LENGTH, persistTransfer, PREVIOUS_SITE, TRANSFER_PROTOCOL, trustedTransfer, } from "./transferProtocol";
export function SaveTransfer({ current, onApply, }: {
    current: Run;
    onApply: (run: Run) => void;
}) {
    const [pending, setPending] = useState(false), [message, setMessage] = useState(""), [candidate, setCandidate] = useState<Run | null>(null), [text, setText] = useState(""), [code, setCode] = useState(""), [issued, setIssued] = useState<{
        code: string;
        createdAt: string;
    } | null>(null), [cloudBusy, setCloudBusy] = useState<"save" | "restore" | null>(null);
    const cleanup = useRef<() => void>(() => { }), operation = useRef(0), live = useRef(current);
    live.current = current;
    useEffect(() => () => {
        operation.current++;
        cleanup.current();
    }, []);
    const read = (raw: string, trusted: boolean, generation: number, sourceVersion?: string) => {
        if (generation !== operation.current)
            return;
        setCandidate(null);
        const result = decodeTransfer(raw, live.current, trusted, sourceVersion);
        if (!result) {
            setMessage(_t("セーブを読み取れませんでした。書き出したファイルかJSONを確認してください。"));
            return;
        }
        setCandidate(result);
        setMessage("");
    };
    const cloud = async (restore: boolean) => {
        cleanup.current();
        const generation = ++operation.current;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        cleanup.current = () => {
            controller.abort();
            clearTimeout(timer);
            setCloudBusy(null);
        };
        setCloudBusy(restore ? "restore" : "save");
        setMessage("");
        setCandidate(null);
        try {
            if (restore) {
                const result = await saveCodeRequest<{
                    save: string;
                    appVersion: string;
                }>("/restore", { code: normalizeSaveCode(code) }, controller.signal);
                if (generation === operation.current && readMigration(result.save))
                    openDomainMigration(normalizeSaveCode(code));
                else
                    read(result.save, true, generation, result.appVersion);
            }
            else {
                const result = await saveCodeRequest<{
                    code: string;
                    createdAt: string;
                }>("", {
                    save: JSON.stringify({
                        ...live.current,
                        background: null,
                        running: false,
                        last: null,
                    }),
                    appVersion: VERSION,
                }, controller.signal);
                if (generation === operation.current)
                    setIssued(result);
            }
        }
        catch (error) {
            if (generation === operation.current)
                setMessage(error instanceof Error && error.name !== "AbortError"
                    ? error.message
                    : _t("通信が完了しませんでした。もう一度お試しください。"));
        }
        finally {
            clearTimeout(timer);
            if (generation === operation.current) {
                setCloudBusy(null);
                cleanup.current = () => { };
            }
        }
    };
    const begin = () => {
        cleanup.current();
        const generation = ++operation.current;
        setCandidate(null);
        setMessage("");
        const nonce = crypto.randomUUID();
        let popup: Window | null = null, timer: ReturnType<typeof setTimeout>, closed: ReturnType<typeof setInterval>;
        const finish = () => {
            window.removeEventListener("message", receive);
            clearTimeout(timer);
            clearInterval(closed);
            popup?.close();
            setPending(false);
            cleanup.current = () => { };
        };
        const receive = (event: MessageEvent) => {
            if (!popup || !trustedTransfer(event, popup, PREVIOUS_SITE, nonce))
                return;
            if (event.data.type === "ready") {
                popup.postMessage({ protocol: TRANSFER_PROTOCOL, nonce, type: "request" }, PREVIOUS_SITE);
            }
            else {
                if (event.data.type === "save" && typeof event.data.save === "string")
                    read(event.data.save, true, generation);
                else
                    setMessage(_t("旧版に保存データが見つからないか、保存を読み取れませんでした。遊んでいたブラウザやホーム画面版からファイルを書き出してください。"));
                finish();
            }
        };
        window.addEventListener("message", receive);
        const url = new URL("/transfer", PREVIOUS_SITE);
        url.searchParams.set("target", location.origin);
        url.searchParams.set("nonce", nonce);
        popup = window.open(url.href, "bebullish-transfer-" + nonce, "popup,width=500,height=650");
        if (!popup) {
            window.removeEventListener("message", receive);
            setMessage(_t("別画面を開けませんでした。ポップアップを許可して再試行するか、下のファイル読み込みを使ってください。"));
            return;
        }
        cleanup.current = finish;
        setPending(true);
        timer = setTimeout(() => {
            finish();
            setMessage(_t("引き継ぎを終了しました。もう一度開くか、ファイルを読み込んでください。"));
        }, 120000);
        closed = setInterval(() => {
            if (popup?.closed) {
                finish();
                setMessage(_t("旧版の画面が閉じられました。もう一度試せます。"));
            }
        }, 500);
    };
    return (<div className="save-transfer">
      <p className="large-copy">{_t("URLが変わっても、続きから。")}</p>
      <p>{_t("6文字の合言葉で、別のURLや端末でも再開できます。この端末への自動保存は、いつもどおり続きます。")}</p>
      <section className="save-code-section">
        <h3>{_t("今の進行を保存する")}</h3>
        <p className="setting-note">{_t("保存した時点の進行が残ります。続きを保存するときは、新しい合言葉を作ってください。")}</p>
        <button className="primary" disabled={pending || !!cloudBusy} onClick={() => void cloud(false)}>
          {cloudBusy === "save" ? _t("保存中…") : _t("保存して合言葉を作る")}
        </button>
        {issued && (<div className="issued-code" role="status">
            <output aria-label={_t("保存の合言葉")}>{issued.code}</output>
            <span>{_t("{0} の進行", new Date(issued.createdAt).toLocaleString())}</span>
            <button className="secondary" onClick={async () => {
                try {
                    await navigator.clipboard.writeText(issued.code);
                    setMessage(_t("合言葉をコピーしました。"));
                }
                catch {
                    setMessage(_t("コピーできませんでした。表示された6文字をメモしてください。"));
                }
            }}>{_t("合言葉をコピー")}</button>
          </div>)}
        <p className="setting-note">{_t("合言葉をメモしてください。合言葉を知っている人は、この進行を読み込めます。")}</p>
      </section>
      <section className="save-code-section">
        <h3>{_t("合言葉で再開する")}</h3>
        <form className="save-code-form" onSubmit={(e) => {
            e.preventDefault();
            if (validSaveCode(code) && !pending && !cloudBusy)
                void cloud(true);
        }}>
          <input aria-label={_t("6文字の合言葉")} placeholder={_t("6文字の合言葉")} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} value={code} onChange={(e) => setCode(normalizeSaveCode(e.target.value))}/>
          <button className="primary" disabled={!validSaveCode(code) || pending || !!cloudBusy}>
            {cloudBusy === "restore" ? _t("読み込み中…") : _t("内容を確認する")}
          </button>
        </form>
      </section>
      {message && <p role="status">{_text(message)}</p>}
      {candidate && (<section className="transfer-preview">
          <h3>{_t("この続きから遊ぶ")}</h3>
          <p>{_t("{0} · {1} ·{2} {3}スピン", catalogById(candidate.catalog).name, money(candidate.cash), " ", candidate.spins.toLocaleString())}</p>
          {candidate.rushLeft > 0 && (<p>{_t("Jackpot 残り{0} 回も引き継ぎます。", candidate.rushLeft.toLocaleString())}</p>)}
          <p className="setting-note">{_t("このURLの進行を置き換えます。読み込み元のセーブは残り、AUTOは停止した状態で再開します。")}</p>
          <div className="button-row">
            <button className="primary" onClick={() => {
                try {
                    persistTransfer(localStorage, candidate);
                }
                catch {
                    setMessage(_t("保存できませんでした。現在のゲームはそのままです。端末の空き容量や保存の許可を確認してください。"));
                    return;
                }
                onApply(candidate);
            }}>{_t("このセーブで始める")}</button>
            <button className="secondary" onClick={() => setCandidate(null)}>{_t("やめる")}</button>
          </div>
        </section>)}
      <details className="save-import">
        <summary>{_t("旧URL・ファイルから引き継ぐ")}</summary>
        <p>{_t("v1.10で遊んでいたブラウザからは、旧版を開いて「このセーブを送る」を押すと取り込めます。そのあと合言葉を作れます。")}</p>
        <button className="secondary" disabled={pending || !!cloudBusy} onClick={begin}>
          {pending ? _t("旧版からの送信を待っています…") : _t("v1.10のセーブを引き継ぐ")}
        </button>
        {pending && (<button className="secondary" onClick={() => {
                operation.current++;
                cleanup.current();
            }}>{_t("キャンセル")}</button>)}
        <p className="setting-note">{_t("旧版の「☰ → 音・振動・表示設定 → セーブを書き出す」で保存したファイルを選んでください。ホーム画面版は、実際に遊んでいたアプリから書き出します。ファイル読み込みは比較プレイとして記録されます。")}</p>
        <input type="file" accept=".json,application/json" aria-label={_t("セーブファイル")} onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file)
                return;
            cleanup.current();
            const generation = ++operation.current;
            setCandidate(null);
            if (file.size > MAX_SAVE_LENGTH) {
                setMessage(_t("ファイルが大きすぎます。セーブJSONを選んでください。"));
                return;
            }
            try {
                read(await file.text(), false, generation);
            }
            catch {
                if (generation === operation.current)
                    setMessage(_t("ファイルを読み取れませんでした。"));
            }
        }}/>
        <textarea value={text} maxLength={MAX_SAVE_LENGTH} onChange={(e) => setText(e.target.value)} rows={4} aria-label={_t("引き継ぎJSON")} placeholder={_t("JSONを貼り付けることもできます")}/>
        <button className="secondary" disabled={!text || pending} onClick={() => {
            cleanup.current();
            read(text, false, ++operation.current);
        }}>{_t("内容を確認する")}</button>
      </details>
    </div>);
}
