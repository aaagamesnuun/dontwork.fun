import { t as _t } from "./i18n";
export interface ShellBuild {
    id: string;
    createdAt: number;
}
export interface UpdateStatus {
    available: ShellBuild | null;
    offlineReady: boolean;
    error: string;
}
const initial: UpdateStatus = { available: null, offlineReady: false, error: "" };
let status = initial;
const listeners = new Set<() => void>();
export const getPwaUpdate = () => status;
export const getServerPwaUpdate = () => initial;
export const subscribePwaUpdate = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};
const publish = (patch: Partial<UpdateStatus>) => {
    status = { ...status, ...patch };
    listeners.forEach(listener => listener());
};
export const newerShell = (page: ShellBuild, worker: ShellBuild) => worker.id !== page.id && worker.createdAt > page.createdAt;
function askBuild(worker: ServiceWorker): Promise<ShellBuild | null> {
    return new Promise(resolve => {
        const channel = new MessageChannel();
        const finish = (build: ShellBuild | null) => {
            clearTimeout(timer);
            channel.port1.close();
            channel.port2.close();
            resolve(build);
        };
        const timer = setTimeout(() => finish(null), 1500);
        channel.port1.onmessage = ({ data }) => finish(typeof data?.id === "string" && Number.isFinite(data.createdAt) ? data : null);
        try {
            worker.postMessage({ type: "BEBULLISH_BUILD" }, [channel.port2]);
        }
        catch {
            finish(null);
        }
    });
}
// Runs outside OwnedGame: a parked or lock-waiting window can discover an
// update, but only the owning App can save and decide to reload itself.
export function watchPwaUpdates(workers: ServiceWorkerContainer, page: ShellBuild, doc: Document, win: Window, report: (patch: Partial<UpdateStatus>) => void, readBuild = askBuild) {
    let alive = true, registration: ServiceWorkerRegistration | undefined;
    let updating = false;
    const cleanupWorkers: (() => void)[] = [];
    const inspect = async () => {
        const controller = workers.controller;
        if (!controller)
            return;
        const build = await readBuild(controller);
        if (!alive || workers.controller !== controller)
            return;
        report({ offlineReady: true });
        if (build && newerShell(page, build))
            report({ available: build, error: "" });
        if (build)
            controller.postMessage({ type: "BEBULLISH_PRUNE" });
    };
    const check = async () => {
        if (!alive || updating || doc.hidden)
            return;
        updating = true;
        try {
            if (!registration)
                await connect();
            if (alive && registration)
                await registration.update();
        }
        catch {
            if (alive && !registration)
                report({ error: _t("通信できる状態になると、更新とオフラインの準備を再試行します。") });
            // The installed shell and saved game remain usable offline.
        }
        finally {
            updating = false;
            if (alive)
                void inspect();
        }
    };
    const foreground = () => { if (!doc.hidden)
        void check(); };
    const identify = (event: MessageEvent) => {
        if (event.data?.type === "BEBULLISH_PAGE_BUILD")
            event.ports[0]?.postMessage(page.id);
    };
    workers.addEventListener("controllerchange", inspect);
    workers.addEventListener("message", identify);
    doc.addEventListener("visibilitychange", foreground);
    win.addEventListener("pageshow", foreground);
    win.addEventListener("online", foreground);
    const interval = setInterval(foreground, 5 * 60000);
    const connect = async () => {
        const reg = await workers.register("/sw.js", { scope: "/", updateViaCache: "none" });
        if (!alive)
            return;
        registration = reg;
        report({ offlineReady: !!reg.active, error: "" });
        const track = () => {
            const worker = reg.installing;
            if (!worker)
                return;
            const change = () => { if (alive && worker.state === "activated")
                void inspect(); };
            worker.addEventListener("statechange", change);
            cleanupWorkers.push(() => worker.removeEventListener("statechange", change));
        };
        track();
        reg.addEventListener("updatefound", track);
        cleanupWorkers.push(() => reg.removeEventListener("updatefound", track));
    };
    void check();
    return () => {
        alive = false;
        clearInterval(interval);
        workers.removeEventListener("controllerchange", inspect);
        workers.removeEventListener("message", identify);
        doc.removeEventListener("visibilitychange", foreground);
        win.removeEventListener("pageshow", foreground);
        win.removeEventListener("online", foreground);
        cleanupWorkers.forEach(cleanup => cleanup());
    };
}
let started = false;
export function startPwaUpdates() {
    if (started || !import.meta.env.PROD || !("serviceWorker" in navigator))
        return;
    started = true;
    const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? "";
    watchPwaUpdates(navigator.serviceWorker, {
        id: meta("bebullish-build"), createdAt: Number(meta("bebullish-built-at")),
    }, document, window, publish);
}
export const updateDialogSafe = (modal: string | null) => modal === null || ["intro", "install", "pwa", "menu"].includes(modal);
export function safeToApplyUpdate({ visible, pending, purchasing, running, modal }: {
    visible: boolean;
    pending: boolean;
    purchasing: boolean;
    running: boolean;
    modal: string | null;
}) {
    return visible && !pending && !purchasing && !running &&
        updateDialogSafe(modal);
}
// Save the authoritative run synchronously before leaving. A session marker
// prevents repeated refreshes even if a browser restores a stale document.
export function saveAndReload(build: ShellBuild, save: () => boolean, getStorage: () => Pick<Storage, "getItem" | "setItem">, reload: () => void): "reloading" | "save-failed" | "already-tried" {
    const key = "bebullish-reloaded-build";
    try {
        const storage = getStorage();
        if (storage.getItem(key) === build.id)
            return "already-tried";
        if (!save())
            return "save-failed";
        storage.setItem(key, build.id);
    }
    catch {
        return "save-failed";
    }
    reload();
    return "reloading";
}
