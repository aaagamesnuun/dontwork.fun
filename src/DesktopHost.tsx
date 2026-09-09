import { t as _t, textValue as _text } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import App from "./App";
import { needsPwa } from "./Pwa";
import { MIGRATION_PENDING, recoverMigration } from './domainMigration';
// Only the owning window mounts the game, including its saver and audio loops.
export function holdGameLock(locks: LockManager, enter: () => void, failed: () => void) {
    const abort = new AbortController();
    let release: (() => void) | undefined, alive = true;
    void locks.request("bebullish-active-game", { signal: abort.signal }, async () => {
        if (!alive)
            return;
        await new Promise<void>(resolve => { release = resolve; enter(); });
    }).catch(e => { if (alive && e?.name !== "AbortError")
        failed(); });
    return () => { alive = false; abort.abort(); release?.(); };
}
function OwnedGame({ onOpenDesk }: {
    onOpenDesk?: () => void;
}) {
    // The mobile install guide must not hold a game lock against the installed PWA.
    const supported = typeof navigator !== "undefined" && !!navigator.locks && !needsPwa();
    const [owned, setOwned] = useState(!supported), [failed, setFailed] = useState(false);
    useEffect(() => supported ? holdGameLock(navigator.locks, () => {
        // A waiting tab may acquire ownership after an interrupted migration.
        let pending = false;
        try {
            pending = !!localStorage.getItem(MIGRATION_PENDING);
        }
        catch { /* App supports unavailable storage. */ }
        if (pending)
            recoverMigration(localStorage);
        setOwned(true);
    }, () => setFailed(true)) : undefined, [supported]);
    return owned ? <App onOpenDesk={supported ? onOpenDesk : undefined}/> : <main className="desk-handoff"><section><h1>dontwork.fun</h1><h2>{failed ? _t("プレイを開けませんでした") : _t("別の画面でプレイ中")}</h2><p>{failed ? _t("この画面を開き直してください。セーブはそのまま残っています。") : _t("もう一つのdontwork.funの画面を閉じると、続きから開きます。")}</p></section></main>;
}
export const deskFeatures = (area: {
    availWidth: number;
    availHeight: number;
    availLeft?: number;
    availTop?: number;
}) => {
    const width = Math.min(420, area.availWidth), height = Math.min(820, area.availHeight);
    return `popup=yes,width=${width},height=${height},left=${(area.availLeft ?? 0) + area.availWidth - width},top=${area.availTop ?? 0},resizable=yes,scrollbars=yes`;
};
export function DesktopHost() {
    const isDesk = new URLSearchParams(location.search).get("desk") === "1";
    const [parked, setParked] = useState(false), [error, setError] = useState(""), [returning, setReturning] = useState(false);
    const child = useRef<Window | null>(null);
    useEffect(() => {
        const message = (event: MessageEvent) => {
            if (event.origin !== location.origin)
                return;
            if (isDesk && event.source === window.opener && event.data?.type === "bebullish-desk-park") {
                // Unmounting the game flushes its latest save and stops its timers before the handoff.
                flushSync(() => setParked(true));
                window.opener?.postMessage({ type: "bebullish-desk-parked" }, location.origin);
            }
            if (event.source === child.current && child.current && event.data?.type === "bebullish-desk-parked") {
                child.current.close();
                child.current = null;
                setReturning(false);
                setParked(false);
            }
        };
        addEventListener("message", message);
        return () => removeEventListener("message", message);
    }, [isDesk]);
    useEffect(() => {
        if (!parked || isDesk)
            return;
        const timer = setInterval(() => { if (child.current?.closed) {
            child.current = null;
            setReturning(false);
            setParked(false);
        } }, 700);
        return () => clearInterval(timer);
    }, [parked, isDesk]);
    useEffect(() => {
        if (!returning)
            return;
        const timer = setTimeout(() => {
            // A loading or navigated popup cannot acknowledge. Close it before mounting a new saver.
            child.current?.close();
            if (!child.current || child.current.closed) {
                child.current = null;
                setParked(false);
            }
            setReturning(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, [returning]);
    const openDesk = () => {
        const popup = window.open("about:blank", "_blank", deskFeatures(screen));
        if (!popup) {
            setError(_t("別ウィンドウを開けませんでした。このサイトのポップアップを許可して、もう一度お試しください。"));
            return;
        }
        child.current = popup;
        setError("");
        flushSync(() => setParked(true));
        const url = new URL(location.href);
        url.searchParams.set("desk", "1");
        url.hash = "";
        popup.location.replace(url.href);
        popup.focus();
    };
    const returnHere = () => {
        if (child.current && !child.current.closed) {
            setReturning(true);
            child.current.postMessage({ type: "bebullish-desk-park" }, location.origin);
        }
        else {
            child.current = null;
            setParked(false);
        }
    };
    return parked ? <main className="desk-handoff"><section>
    <img src="/icons/dontwork.svg" width="80" height="80" alt=""/>
    <h1>dontwork.fun</h1><h2>{isDesk ? _t("プレイを引き継ぎました") : _t("縦長ウィンドウでプレイ中")}</h2>
    <p>{isDesk ? _t("元の画面で続きを遊べます。") : _t("ウィンドウを画面端に置いて、作業の横で遊べます。")}</p>
    {!isDesk && <><button className="primary" onClick={returnHere} disabled={returning}>{returning ? _t("プレイを引き継いでいます…") : _t("この画面に戻す")}</button><p className="setting-note">{_t("別ウィンドウを閉じても、この画面に戻れます。最前面への固定はOS側で設定してください。")}</p></>}
  </section></main> : <><OwnedGame onOpenDesk={isDesk ? undefined : openDesk}/>{error && <div role="alert" className="toast" onClick={() => setError("")}>{_text(error)}</div>}</>;
}
