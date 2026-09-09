import { servicesEnabled,sharedServiceOrigin } from "./serviceConfig";
import { t as _t } from "./i18n";
import { useEffect, useState } from 'react';
export const validReleaseUrl = (url: unknown) => typeof url === 'string' && (/^https:\/\/(?:dontwork|bebullish)\.fun\/?$/.test(url) || /^https:\/\/[a-z0-9-]+\.realnuun\.chatgpt\.site\/?$/.test(url));
const SERVICE = sharedServiceOrigin();
export const newerVersion = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i])
        return x[i] > y[i];
} return false; };
export function useReleaseCheck(version: string, enabled = true) {
    enabled=enabled&&servicesEnabled();
    const [checked, setChecked] = useState(!enabled || typeof document === "undefined"), [latest, setLatest] = useState<{
        version: string;
        url: string;
    } | null>(null), [dismissed, setDismissed] = useState(false);
    useEffect(() => {
        if (!enabled)
            return;
        let alive = true;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        void fetch(SERVICE + '/api/release', { signal: controller.signal, cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (!alive || !data)
            return; const url = validReleaseUrl(data.canonicalUrl) ? data.canonicalUrl : data.url; if (/^\d+\.\d+\.\d+$/.test(data.version) && validReleaseUrl(url) && newerVersion(data.version, version) && new URL(url).origin !== location.origin)
            setLatest({ ...data, url }); }).catch(() => { }).finally(() => { clearTimeout(timer); if (alive)
            setChecked(true); });
        return () => { alive = false; clearTimeout(timer); controller.abort(); };
    }, [version, enabled]);
    return { checked, latest: !dismissed ? latest : null, dismiss: () => setDismissed(true) };
}
export function ReleaseNotice({ check }: {
    check: ReturnType<typeof useReleaseCheck>;
}) { if (!check.checked)
    return <div className="version-notice" role="status"><section><h1>dontwork.fun</h1><p>{_t("起動しています…")}</p></section></div>; if (!check.latest)
    return null; return <div className="version-notice" role="dialog" aria-modal="true" aria-label={_t("新しいバージョン")}><section><h2>{_t("新しいdontwork.funがあります。")}</h2><p>{_t("ホーム画面に追加する前に、最新版へ。")}</p><a className="primary" href={check.latest.url}>{_t("最新版 v{0}へ →", check.latest.version)}</a><button className="secondary intro-start" onClick={check.dismiss}>{_t("この版を開く")}</button></section></div>; }
export function VersionLinks() { return <div><div className="version-links"><a href="https://dontwork.fun/">{_t("本番 · dontwork.fun →")}</a>{['2-3', '2-2', '2-1', '2-0', '1-11-0', '1-10-0', '1-9-0'].map(v => <a key={v} href={`https://bebullish-v${v}.realnuun.chatgpt.site/`}>v{v.replaceAll('-', '.')} →</a>)}</div></div>; }
