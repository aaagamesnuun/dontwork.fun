import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AI_SESSION_KEY, loadAiConnection, saveAiConnection } from './aiApi';
import { SAVE_KEY } from './game/engine';
beforeEach(() => { const data = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) }); });
afterEach(() => vi.unstubAllGlobals());
const connection = (id: string) => ({ id, ownerToken: 'a'.repeat(64), connectionUrl: `https://example.test/api/ai/connect/${id}`, spectatorUrl: `https://example.test/?ai=${id}` });
it('keeps previous owner credentials after new games and URL rotations, without changing the human save', () => {
  localStorage.setItem(SAVE_KEY, 'existing human progress');
  const a = connection('first'), b = connection('second');
  saveAiConnection(a); saveAiConnection(b);
  expect(loadAiConnection()).toEqual(b); expect(loadAiConnection(a.id)).toEqual(a);
  saveAiConnection({ ...a, connectionUrl: 'https://example.test/new-url' });
  expect(loadAiConnection(b.id)).toEqual(b); expect(loadAiConnection(a.id)?.connectionUrl).toBe('https://example.test/new-url');
  expect(localStorage.getItem(SAVE_KEY)).toBe('existing human progress');
});
it('retains the previous single-record owner connection when migrating and never grants another spectator controls', () => {
  const old = connection('previous'); localStorage.setItem(AI_SESSION_KEY, JSON.stringify(old));
  expect(loadAiConnection(old.id)).toEqual(old); expect(loadAiConnection('unknown')).toBeNull();
  saveAiConnection(connection('new')); expect(loadAiConnection(old.id)).toEqual(old);
});
