import { readSave, migrateLegacy, SAVE_KEY, type Run } from "./game/engine";

export const TRANSFER_PROTOCOL = "bebullish-transfer-v1";
export const MAX_SAVE_LENGTH = 2_000_000;
export const PREVIOUS_SITE = "https://bebullish-v1-10-0.realnuun.chatgpt.site";
export const BACKUP_KEY = "bebullish-before-transfer-v1";
export type TransferMessage = {
  protocol: string;
  nonce: string;
  type: string;
  save?: string;
  message?: string;
};
export function trustedTransfer(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  popup: Window,
  origin: string,
  nonce: string,
): event is MessageEvent<TransferMessage> {
  return (
    event.origin === origin &&
    event.source === popup &&
    event.data?.protocol === TRANSFER_PROTOCOL &&
    event.data?.nonce === nonce &&
    ["ready", "save", "error"].includes(event.data?.type)
  );
}
export function decodeTransfer(
  raw: string,
  current: Run,
  trusted: boolean,
  sourceVersion = "1.10.0",
): Run | null {
  if (typeof raw !== "string" || raw.length > MAX_SAVE_LENGTH) return null;
  const old = readSave(raw) ?? migrateLegacy(raw);
  if (!old) return null;
  let completion = old.completion;
  if (trusted && !completion && old.clearAt !== null) {
    const source = JSON.parse(raw);
    completion = {
      id: source.id,
      appVersion: sourceVersion,
      rulesetVersion: `astra-v${source.economyRevision ?? 5}:` + old.catalog,
      catalog: old.catalog,
      timeMs: Math.max(1000, Math.round(old.clearActiveMs ?? old.activeMs)),
      spins: old.clearSpins ?? old.spins,
      ranked:
        source.debug === false &&
        source.economyRevision >= 5 &&
        (old.clearActiveMs ?? old.activeMs) <= 14 * 86400000 &&
        (old.clearSpins ?? old.spins) <= 1e8,
    };
  }
  return {
    ...old,
    completion: completion
      ? { ...completion, ranked: trusted && completion.ranked }
      : null,
    id: old.trial?old.id:crypto.randomUUID(),
    trial:old.trial?{...old.trial,paused:true,anchor:null,result:old.trial.result?{...old.trial.result,ranked:trusted&&old.trial.result.ranked}:null}:null,
    background: null, running: false, backgroundJackpot:false,
    last: null,
    debug: old.debug || !trusted,
    telemetry: old.telemetry && current.telemetry,
    entryKind: "transfer",
  };
}
export function persistTransfer(
  storage: Pick<Storage, "getItem" | "setItem">,
  next: Run,
) {
  const previous = storage.getItem(SAVE_KEY);
  if (previous !== null) storage.setItem(BACKUP_KEY, previous);
  storage.setItem(SAVE_KEY, JSON.stringify(next));
}
