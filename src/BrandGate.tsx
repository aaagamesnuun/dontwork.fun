import { t as _t, textValue as _text } from "./i18n";
import { useEffect, useState } from 'react';
import { DesktopHost } from './DesktopHost';
import { SAVE_KEY, VERSION, money, readSave } from './game/engine';
import { applyMigration, freezeMigration, migrationApplied, oldGameOrigin, readMigration, recoverMigration, withMigrationLock, NEW_ORIGIN, MIGRATION_PENDING, type Migration } from './domainMigration';
import { normalizeSaveCode, saveCodeRequest, validSaveCode } from './saveCodes';
export function BrandGate() {
    const [recover, setRecover] = useState(() => { try {
        return !!localStorage.getItem(MIGRATION_PENDING);
    }
    catch {
        return false;
    } }), [error, setError] = useState('');
    useEffect(() => { if (recover)
        void withMigrationLock(async () => recoverMigration(localStorage)).then(() => setRecover(false)).catch(e => setError(e instanceof Error ? e.message : _t("セーブを復元できませんでした。"))); }, [recover]);
    return recover ? <main className="domain-migration"><section><h1>dontwork.fun</h1><p>{error || _t("移行前のセーブを復元しています…")}</p>{error && <button className="primary" onClick={() => location.reload()}>{_t("もう一度試す")}</button>}</section></main> : <MigrationScreen />;
}
const alreadyApplied = (code: string) => { try {
    return migrationApplied(localStorage, code);
}
catch {
    return false;
} };
const hasLocalSave = () => { try {
    return !!readSave(localStorage.getItem(SAVE_KEY));
}
catch {
    return false;
} };
function MigrationScreen() {
    const old = oldGameOrigin(location.origin), hash = new URLSearchParams(location.hash.slice(1)), incoming = normalizeSaveCode(hash.get('migrate') || '');
    const [done, setDone] = useState(!old && (alreadyApplied(incoming) || (!incoming && !hash.has('migration'))));
    const [code, setCode] = useState(incoming), [issued, setIssued] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [candidate, setCandidate] = useState<{
        bundle: Migration;
        code: string;
    } | null>(null), [restored, setRestored] = useState(false), [source, setSource] = useState<Migration | null>(null);
    const finish = () => { history.replaceState(null, '', location.pathname + location.search); setDone(true); };
    useEffect(() => { if (done && incoming)
        history.replaceState(null, '', location.pathname + location.search); }, [done, incoming]);
    useEffect(() => { if (!old || !hasLocalSave())
        return; let live = true; setBusy(true); void withMigrationLock(async () => freezeMigration(localStorage)).then(bundle => { if (live)
        setSource(bundle); }).catch(e => { if (live)
        setError(e instanceof Error ? e.message : _t("セーブを読み取れませんでした。")); }).finally(() => { if (live)
        setBusy(false); }); return () => { live = false; }; }, [old]);
    const request = async <T,>(path: '' | '/restore', body: unknown) => { const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000); try {
        return await saveCodeRequest<T>(path, body, controller.signal);
    }
    finally {
        clearTimeout(timer);
    } };
    const issue = async () => {
        setBusy(true);
        setError('');
        try {
            await withMigrationLock(async () => {
                const bundle = source ?? freezeMigration(localStorage);
                setSource(bundle);
                const result = await request<{
                    code: string;
                }>('', { save: JSON.stringify(bundle), appVersion: VERSION });
                setIssued(result.code);
            });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : _t("移行の準備ができませんでした。もう一度お試しください。"));
        }
        finally {
            setBusy(false);
        }
    };
    const restore = async () => {
        setBusy(true);
        setError('');
        setCandidate(null);
        try {
            const result = await request<{
                save: string;
            }>('/restore', { code: normalizeSaveCode(code) }), bundle = readMigration(result.save);
            if (!bundle)
                throw Error(_t("この合言葉は移行用ではありません。旧URLの移行画面で発行してください。"));
            setCandidate({ bundle, code: normalizeSaveCode(code) });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : _t("通信できませんでした。"));
        }
        finally {
            setBusy(false);
        }
    };
    const accept = async () => { if (!candidate)
        return; setBusy(true); setError(''); try {
        await withMigrationLock(async () => { applyMigration(localStorage, candidate.bundle, candidate.code); });
        setRestored(true);
        setCandidate(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : _t("保存できませんでした。端末の空き容量を確認してください。"));
    }
    finally {
        setBusy(false);
    } };
    const active = candidate ? readSave(candidate.bundle.entries[SAVE_KEY] || null) : null;
    if (done)
        return <DesktopHost />;
    const existing = hasLocalSave();
    return <main className="domain-migration"><section><img src="/icons/dontwork.svg" alt="" width="76" height="76"/><h1>dontwork<span>.fun</span></h1>
 {old ? <><p className="migration-lead">{_t("BeBullish.funは")}<br />{_t("dontwork.funになりました。")}</p><p>{_t("ランキングはそのまま。続きも、新しいURLへ引き継げます。")}</p>
 {!existing && !source ? <a className="primary" href={NEW_ORIGIN + '/'}>{_t("dontwork.funへ →")}</a> : issued ? <><p>{_t("引き継ぎ用の合言葉")}</p><output className="migration-code">{issued}</output><button className="secondary" onClick={() => void navigator.clipboard?.writeText(issued).catch(() => setError(_t("上の合言葉を控えてください。")))}>{_t("合言葉をコピー")}</button><a className="primary" href={`${NEW_ORIGIN}/#migrate=${issued}`} rel="noreferrer">{_t("続きからdontwork.funへ →")}</a><p>{_t("スマホは移転先をホーム画面に追加してください。新しいアイコンでセーブが見つからない場合も、この合言葉で引き継げます。")}</p></> : <><button className="primary" disabled={busy} onClick={() => void issue()}>{busy ? _t("セーブを保存しています…") : _t("セーブを引き継いで移動")}</button><a className="secondary" href={NEW_ORIGIN + '/'}>{_t("セーブを持たずに新しいURLへ →")}</a></>}
 <p className="setting-note">{_t("旧URLのセーブは残ります。通常モード・30分モードと、送信待ちのランキング記録をまとめて引き継ぎます。")}</p></>
            : restored ? <><h2>{_t("続きの準備ができました。")}</h2><p>{_t("ランキングとセーブを引き継ぎました。AUTOと30分モードの時計は、再開するまで停止しています。")}</p><output className="migration-code">{code}</output><p>{_t("新しいホーム画面のアイコンで開いた時にセーブがなければ、この合言葉を使ってください。")}</p><button className="primary" onClick={finish}>{_t("続ける →")}</button></>
                : <><h2>{_t("旧URLから引き継ぐ")}</h2><p>{_t("BeBullish.funの移行画面で発行した6文字の合言葉を入力してください。")}</p><label className="migration-input">{_t("合言葉")}<input value={code} disabled={busy} maxLength={9} autoCapitalize="characters" autoCorrect="off" spellCheck={false} onChange={e => { setCode(normalizeSaveCode(e.target.value)); setCandidate(null); }}/></label><button className="primary" onClick={() => void restore()} disabled={busy || !validSaveCode(code)}>{busy ? _t("読み込み中…") : _t("セーブを確認")}</button>
 {candidate && <div className="migration-preview"><strong>{active?.trial ? _t("30分チャレンジ") : _t("通常モード")} · {active ? money(active.cash) : _t("記録の引き継ぎ")}</strong><p>{existing ? _t("この端末の続きを置き換えます。現在のセーブを端末内に退避し、送信待ちのランキング記録は両方残します。") : _t("通常モード・30分モード・送信待ちの記録を引き継ぎます。")}</p><button className="primary" disabled={busy} onClick={() => void accept()}>{_t("このセーブを引き継ぐ")}</button></div>}
 <button className="secondary" disabled={busy} onClick={finish}>{_t("戻る")}</button></>}
 {error && <p role="alert" className="migration-error">{_text(error)}</p>}</section></main>;
}
