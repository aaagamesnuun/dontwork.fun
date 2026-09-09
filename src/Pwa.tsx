import { t as _t } from "./i18n";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getPwaUpdate, getServerPwaUpdate, subscribePwaUpdate } from "./pwaUpdates";
import { fileAudioRequested } from "./fileAudio";
interface InstallPrompt extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
        outcome: "accepted" | "dismissed";
    }>;
}
export const detectStandalone = () => (typeof matchMedia !== "undefined" &&
    matchMedia("(display-mode: standalone)").matches) ||
    (typeof navigator !== "undefined" &&
        (navigator as Navigator & {
            standalone?: boolean;
        }).standalone === true);
export function usePwa() {
    const update = useSyncExternalStore(subscribePwaUpdate, getPwaUpdate, getServerPwaUpdate);
    const [prompt, setPrompt] = useState<InstallPrompt | null>(null), [standalone, setStandalone] = useState(detectStandalone), [installError, setInstallError] = useState("");
    useEffect(() => {
        const display = matchMedia("(display-mode: standalone)");
        const detect = () => setStandalone(display.matches ||
            (navigator as Navigator & {
                standalone?: boolean;
            }).standalone ===
                true);
        detect();
        display.addEventListener("change", detect);
        const available = (e: Event) => {
            e.preventDefault();
            setPrompt(e as InstallPrompt);
        };
        const installed = () => {
            setPrompt(null);
            detect();
        };
        window.addEventListener("beforeinstallprompt", available);
        window.addEventListener("appinstalled", installed);
        return () => {
            display.removeEventListener("change", detect);
            window.removeEventListener("beforeinstallprompt", available);
            window.removeEventListener("appinstalled", installed);
        };
    }, []);
    const install = async () => {
        if (!prompt)
            return false;
        setInstallError("");
        try {
            await prompt.prompt();
            return (await prompt.userChoice).outcome === "accepted";
        }
        catch {
            setInstallError(_t("ブラウザのメニューからホーム画面に追加できます。"));
            return false;
        }
        finally {
            setPrompt(null);
        }
    };
    return {
        standalone,
        waiting: !!update.available,
        update: update.available,
        offlineReady: update.offlineReady,
        installError: installError || update.error,
        canInstall: !!prompt,
        install,
    };
}
export const isMobileDevice = (nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> | undefined = typeof navigator === "undefined" ? undefined : navigator) => !!nav && (/Android|iPhone|iPad|iPod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1));
// The explicit recording trial must be reachable from its Safari link; normal
// mobile visits retain the installation requirement.
export const needsPwa = () => isMobileDevice() && !detectStandalone() && !fileAudioRequested();
function InstallDiagram({ kind }: {
    kind: "share" | "home" | "launch";
}) {
    return <svg viewBox="0 0 96 72" className="install-diagram" role="img" aria-label={kind === "share" ? _t("共有ボタン") : kind === "home" ? _t("ホーム画面に追加") : _t("ホーム画面のアイコンをタップ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
 {kind === "share" ? <><path d="M31 35v25h34V35M48 45V12m-10 10 10-10 10 10"/></> : kind === "home" ? <><rect x="13" y="15" width="70" height="44" rx="5"/><rect x="23" y="26" width="22" height="22" rx="3"/><path d="M34 31v12m-6-6h12M55 32h17m-17 11h12"/></> : <><rect x="27" y="9" width="42" height="54" rx="8"/><path d="m35 46 9-13 8 5 9-16m-8 0h8v8"/></>}
 </svg>;
}
export function InstallInstructions() {
    const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const [platform, setPlatform] = useState(/Android/i.test(ua) ? 'android' : /CriOS/i.test(ua) ? 'ios-chrome' : 'ios-safari');
    const copy = () => void navigator.clipboard?.writeText(location.origin + '/').catch(() => { });
    return <div className="install-guide"><label className="setting-row"><span>{_t("使っているブラウザ")}</span><select value={platform} onChange={e => setPlatform(e.target.value)}><option value="ios-safari">iPhone / iPad · Safari</option><option value="ios-chrome">iPhone / iPad · Chrome</option><option value="android">Android · Chrome</option></select></label>
 <ol className="install-picture-steps"><li><InstallDiagram kind="share"/><b>1</b><p>{platform === 'android' ? _t("右上の「⋮」を開く") : platform === 'ios-chrome' ? _t("アドレスバー右の共有ボタンを押す") : _t("共有ボタンを押す（「…」の中にある場合も）")}</p></li><li><InstallDiagram kind="home"/><b>2</b><p>{platform === 'android' ? _t("「インストール」または「ホーム画面に追加」を選ぶ") : _t("「ホーム画面に追加」→「追加」を押す")}{platform === 'ios-safari' && <small>{_t("「Webアプリとして開く」があればON。")}</small>}</p></li><li><InstallDiagram kind="launch"/><b>3</b><p>{_t("ホーム画面に戻って")}<br />{_t("dontwork.funのアイコンを開く")}</p></li></ol>
 <details><summary>{_t("追加の項目が見つからない")}</summary><p>{_t("LINEなどのアプリ内では、メニューからSafariまたはChromeで開いてください。共有メニュー内を下にスクロールすると「ホーム画面に追加」が見つかる場合もあります。")}</p><button className="secondary" onClick={copy}>{_t("このURLをコピー")}</button><p className="selectable-url">{typeof location !== 'undefined' ? location.origin : ''}</p></details>
 </div>;
}
export function InstallWelcome({ pwa }: {
    pwa: ReturnType<typeof usePwa>;
}) {
    return <div className="install-welcome"><img src="/icons/icon-192-dw.png" alt="dontwork.fun" width="64" height="64"/><p className="large-copy">{_t("ホーム画面への追加が必須です。")}</p><p>{_t("追加したアイコンから起動すると、ゲームが始まります。")}</p>
 {pwa.canInstall && <button className="primary intro-start" onClick={() => void pwa.install()}>{_t("ホーム画面に追加")}</button>}
 <InstallInstructions />{pwa.installError && <p role="status">{pwa.installError}</p>}
 </div>;
}
export function PwaHelp({ pwa }: {
    pwa: ReturnType<typeof usePwa>;
}) { return <div className="pwa-help">{pwa.standalone && <p className="install-status">{_t("✓ ホーム画面から起動しています")}</p>}<InstallInstructions />{pwa.canInstall && <button className="primary" onClick={() => void pwa.install()}>{_t("ホーム画面に追加")}</button>}<p>{_t("本番の更新は、同じアイコン・同じセーブで続けられます。更新のための再インストールは不要です。")}</p>{pwa.waiting && <p>{_t("最新版の準備ができています。この説明を閉じ、ゲーム画面の「保存して更新」を押してください。")}</p>}<p className="setting-note">{_t("ランキング・問い合わせの送信には通信が必要です。")}</p></div>; }
