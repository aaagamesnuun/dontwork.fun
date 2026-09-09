import { t as _t } from "./i18n";
import type { Run } from "./game/engine";
export const notificationsSupported = () => typeof Notification !== "undefined" && typeof navigator !== "undefined" && "serviceWorker" in navigator;
export function notificationTransition(steps: {
    before: Run;
    after: Run;
}[], now: number, clockAt: number, returning: boolean) {
    if (returning)
        return null;
    const waiting = steps.find(({ after }) => after.backgroundJackpot && after.settings.jackpotNotifications)?.after;
    if (waiting)
        return waiting;
    if (now - clockAt > 2000)
        return null;
    return steps.filter(({ before, after }) => after.settings.jackpotNotifications && after.last?.jackpot && (before.rushLeft === 0 || after.last.infinity)).at(-1)?.after ?? null;
}
const sent = new Set<string>();
export async function notifyJackpot(run: Run) {
    if (!run.settings.jackpotNotifications || !notificationsSupported() || Notification.permission !== "granted" || !document.hidden || !run.last?.jackpot)
        return false;
    const key = `${run.id}:${run.last.id}`;
    if (sent.has(key))
        return false;
    sent.add(key);
    if (sent.size > 64)
        sent.delete(sent.values().next().value!);
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.active || !document.hidden) {
            sent.delete(key);
            return false;
        }
        const clientId = await notificationClientId(registration);
        if (!document.hidden || Notification.permission !== "granted") {
            sent.delete(key);
            return false;
        }
        await registration.showNotification(run.last.infinity ? "INFINITY JACKPOT · dontwork.fun" : "JACKPOT! · dontwork.fun", {
            body: run.last.infinity ? _t("世界は100だけに。タップしてゲームへ。") : _t("残り{0}スピン。タップしてジャックポットへ。", run.rushLeft),
            icon: "/icons/icon-192-dw.png", badge: "/icons/icon-192-dw.png", tag: `bebullish-jackpot-${run.id}`, renotify: true, data: { url: "/play", clientId },
        } as NotificationOptions & {
            renotify: boolean;
        });
        return true;
    }
    catch {
        sent.delete(key);
        return false;
    }
}
function notificationClientId(registration: ServiceWorkerRegistration): Promise<string | null> {
    return new Promise(resolve => {
        if (typeof MessageChannel === "undefined") {
            resolve(null);
            return;
        }
        const channel = new MessageChannel();
        const finish = (id: unknown) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(typeof id === "string" ? id : null); };
        const timer = setTimeout(() => finish(null), 250);
        channel.port1.onmessage = event => finish(event.data);
        try {
            registration.active?.postMessage({ type: "BEBULLISH_CLIENT_ID" }, [channel.port2]);
        }
        catch {
            finish(null);
        }
    });
}
let lastBigNotice = 0;
export async function notifyBigChange(before: Run, after: Run) {
    const delta = after.cash - before.cash;
    if (!after.settings.bigChangeNotifications || !after.settings.jackpotNotifications || !notificationsSupported() || Notification.permission !== "granted" || !document.hidden || Date.now() - lastBigNotice < 60000 || Math.abs(delta) < Math.max(1000, before.cash * .25))
        return false;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.active || !document.hidden)
            return false;
        await registration.showNotification("dontwork.fun", { body: _t("{0}${1} · 資産が大きく動きました。", delta >= 0 ? "+" : "", Math.round(delta).toLocaleString()), icon: "/icons/icon-192-dw.png", tag: "dontwork-big-change", silent: true, data: { url: "/play" } });
        lastBigNotice = Date.now();
        return true;
    }
    catch {
        return false;
    }
}
