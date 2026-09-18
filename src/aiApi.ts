import { t } from './i18n';
import { servicesEnabled } from './serviceConfig';
import type { Run, Settings } from './game/engine';
import type { aiChoices } from './game/ai';
import type { SweepSnapshot } from './game/sweep';
export const AI_SESSION_KEY = 'dontwork-ai-session-v1';
const AI_CONNECTIONS_KEY = 'dontwork-ai-connections-v1';
export interface AiSpinView {
  spinId: number;
  sweep: SweepSnapshot;
  intervalMs: number;
  jackpotHigh: boolean;
  jackpotRule: Settings['jackpotRule'];
}
export interface AiSnapshot {
  id: string; nickname: string; agentName: string; ruleset: string; version: number;
  createdAt: number; expiresAt: number; startedAt: number | null; updatedAt: number;
  status: 'waiting' | 'active' | 'paused' | 'finished' | 'revoked' | 'expired';
  elapsedMs: number; nextWorkAt: number; nextSpinAt: number; strategy: string; run: Run;
  choices: ReturnType<typeof aiChoices>;
  spinView?: AiSpinView;
  log: { version: number; at: number; type: string; reason: string; cash: number; roll?: number; betId?: string; delta?: number; upgrade?: string }[];
}
export interface AiConnection { id: string; connectionUrl: string; spectatorUrl: string; ownerToken: string }
export class AiApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export function loadAiConnection(id?: string): AiConnection | null {
  try {
    const latest = JSON.parse(localStorage.getItem(AI_SESSION_KEY) ?? 'null');
    const value = id ? JSON.parse(localStorage.getItem(AI_CONNECTIONS_KEY) ?? '{}')[id] ?? (latest?.id === id ? latest : null) : latest;
    return value && typeof value.id === 'string' && /^[a-f0-9]{64}$/.test(value.ownerToken) && typeof value.connectionUrl === 'string' ? value : null;
  } catch { return null; }
}
export function saveAiConnection(value: AiConnection) {
  const connections = JSON.parse(localStorage.getItem(AI_CONNECTIONS_KEY) ?? '{}');
  const previous = loadAiConnection();
  if (previous) connections[previous.id] = previous;
  connections[value.id] = value;
  localStorage.setItem(AI_CONNECTIONS_KEY, JSON.stringify(connections));
  localStorage.setItem(AI_SESSION_KEY, JSON.stringify(value));
}
export async function aiRequest<T>(path: string, options: { body?: unknown; ownerToken?: string; signal?: AbortSignal } = {}): Promise<T> {
  if (!servicesEnabled()) throw new Error(t('このビルドではオンライン機能が無効です。進行は端末に保存されます。'));
  const response = await fetch(path, { method: options.body ? 'POST' : 'GET', signal: options.signal ?? AbortSignal.timeout(15000), cache: 'no-store',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.ownerToken ? { Authorization: `Bearer ${options.ownerToken}` } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  if (!response.ok) {
    const code = (await response.json().catch(() => ({})))?.error;
    throw new AiApiError(t(code === 'creation_rate_limit' ? 'AIプレイの作成上限です。1時間ほど待ってください。' : code === 'connection_closed' ? 'このAI接続は終了しました。新しくプレイを作成してください。' : code === 'version_conflict' ? 'AIの操作と重なりました。もう一度お試しください。' : response.status === 503 ? 'AIモードは現在利用できません。少し待って再度お試しください。' : response.status === 404 ? 'AIプレイが見つかりません。' : '通信できませんでした。時間をおいて再度お試しください。'), response.status);
  }
  return response.json();
}
