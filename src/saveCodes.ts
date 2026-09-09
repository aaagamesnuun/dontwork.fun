import { servicesEnabled } from "./serviceConfig";
import { t as _t } from "./i18n";
import { RANKING_ORIGIN } from "./rankings";
// This is the shared save service. Keep it fixed when publishing a new game URL.
export const SAVE_SERVICE_ORIGIN = RANKING_ORIGIN;
export const normalizeSaveCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");
export const validSaveCode = (value: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(normalizeSaveCode(value));
export async function saveCodeRequest<T>(path: "" | "/restore", body: unknown, signal: AbortSignal): Promise<T> {
    if(!servicesEnabled())throw new Error(_t("このビルドではオンライン機能が無効です。進行は端末に保存されます。"));
    const response = await fetch(SAVE_SERVICE_ORIGIN + "/api/save-codes" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result)
        throw new Error(typeof result?.error === "string"
            ? result.error
            : _t("通信できませんでした。時間をおいて再度お試しください。"));
    return result as T;
}
