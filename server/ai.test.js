import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { aiApi } from './ai.js';
import worker from './worker.js';
import { interval, spin, TARGET } from '../src/game/engine';
import { sweepSnapshot } from '../src/game/sweep';
let sqlite, db;
const origin = 'https://game.example';
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1800000000000);
  sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync(new URL('../drizzle/0011_ai_sessions.sql', import.meta.url), 'utf8'));
  db = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async first() { return sqlite.prepare(sql).get(...args) ?? null; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async run() { return { meta: sqlite.prepare(sql).run(...args) }; } }; } };
});
afterEach(() => { vi.useRealTimers(); sqlite.close(); });
const call = (path, body, token, extra = {}) => aiApi(new Request(origin + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined }), { DB: db });
async function create() {
  const response = await call('/api/ai/sessions', { nickname: 'Player', agentName: 'Codex' });
  expect(response.status).toBe(201);
  const session = await response.json();
  const control = session.connectionUrl.split('/').pop();
  return { ...session, control, action: (body, token = control) => call(`/api/ai/sessions/${session.id}/actions`, body, token), owner: type => call(`/api/ai/sessions/${session.id}/owner`, { type }, session.ownerToken), state: async () => (await call(`/api/ai/sessions/${session.id}`)).json() };
}
describe('AI games are server authoritative', () => {
  it('creates an isolated cohort and a self-contained connection guide without leaking owner credentials', async () => {
    const s = await create();
    const response = await call(new URL(s.connectionUrl).pathname);
    const guide = await response.json();
    expect(guide.authentication.token).toBe(s.control); expect(guide.mcp.url).toContain('/api/ai/mcp/');
    expect(JSON.stringify(guide)).not.toContain(s.ownerToken);
    expect(guide.state.run.cash).toBe(0); expect(guide.state.run.debug).toBe(true);
    const publicState = JSON.stringify(await s.state());
    expect(publicState).not.toContain(s.control); expect(publicState).not.toContain('owner_hash'); expect(publicState).not.toContain(s.ownerToken);
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('enforces a rolling 200 ms gap and cannot bank idle work', async () => {
    const s = await create();
    expect((await s.action({ version: 0, type: 'work' })).status).toBe(200);
    vi.advanceTimersByTime(199);
    const blocked = await s.action({ version: 1, type: 'work' }); expect(blocked.status).toBe(429); expect(blocked.headers.get('Retry-After')).toBe('1'); expect((await blocked.json()).retryAfterMs).toBe(1);
    vi.advanceTimersByTime(1); expect((await s.action({ version: 1, type: 'work' })).status).toBe(200);
    vi.advanceTimersByTime(100000); expect((await s.action({ version: 2, type: 'work' })).status).toBe(200);
    expect((await s.action({ version: 3, type: 'work' })).status).toBe(429); expect((await s.state()).run.cash).toBe(3);
  });
  it('accepts five spaced WORK calls in one second, rejecting a sixth before its deadline', async () => {
    const s = await create(), start = Date.now();
    for (let version = 0; version < 5; version++) {
      vi.setSystemTime(start + version * 200);
      expect((await s.action({ version, type: 'work' })).status).toBe(200);
    }
    vi.setSystemTime(start + 999);
    const blocked = await s.action({ version: 5, type: 'work' });
    expect(blocked.status).toBe(429); expect((await blocked.json()).retryAfterMs).toBe(1);
    expect((await s.state()).run.work).toBe(5);
    vi.setSystemTime(start + 1000); expect((await s.action({ version: 5, type: 'work' })).status).toBe(200);
  });
  it('linearizes simultaneous requests and makes retries with the same version harmless', async () => {
    const s = await create();
    const results = await Promise.all(Array.from({ length: 20 }, () => s.action({ version: 0, type: 'work' })));
    expect(results.filter(r => r.status === 200)).toHaveLength(1); expect(results.every(r => [200, 409].includes(r.status))).toBe(true);
    expect((await s.state()).run.work).toBe(1);
    vi.advanceTimersByTime(1000); expect((await s.action({ version: 0, type: 'work' })).status).toBe(409);
  });
  it.each([{ count: 100 }, { cash: 1e9 }, { now: 1 }, { forced: 100 }, { settings: {} }, { type: 'reset' }, { version: undefined }, { version: -1 }])('rejects injected state/batching/clock %o', async patch => {
    const s = await create(); expect((await s.action({ version: 0, type: 'work', ...patch })).status).toBe(400); expect((await s.state()).version).toBe(0);
  });
  it('rejects unavailable/invalid choices instead of claiming success', async () => {
    const s = await create();
    for (const body of [{ type: 'spin' }, { type: 'equip', betId: 'fake', delta: 1 }, { type: 'equip', betId: 'edge-50', delta: 5 }, { type: 'upgrade', upgrade: 'slots' }, { type: 'upgrade', upgrade: 'fake' }, { type: 'strategy', text: '' }]) expect((await s.action({ version: 0, ...body })).status).toBe(400);
    expect((await s.state()).version).toBe(0);
  });
  it('enforces spin cooldown from becoming funded/equipped, with no idle burst', async () => {
    const s = await create();
    for (let i = 0; i < 10; i++) { await s.action({ version: i, type: 'work' }); vi.advanceTimersByTime(1000); }
    const bet = (await s.state()).choices.bets.find(b => b.unlocked && b.stake <= 10);
    expect((await s.action({ version: 10, type: 'equip', betId: bet.id, delta: 1 })).status).toBe(200);
    let state = await s.state(); expect(state.nextSpinAt).toBe(Date.now() + state.choices.spinIntervalMs);
    expect((await s.action({ version: 11, type: 'spin' })).status).toBe(429);
    vi.setSystemTime(state.nextSpinAt); expect((await s.action({ version: 11, type: 'spin' })).status).toBe(200);
    expect((await s.action({ version: 12, type: 'spin' })).status).toBe(429);
    state = await s.state(); expect(state.run.spins).toBe(1); expect(state.run.activeMs).toBe(Date.now() - state.startedAt);
  });
  it('separates spectator/control/owner roles and cross-session authorization', async () => {
    const s = await create(), other = await create();
    for (const token of ['', s.ownerToken, other.control]) expect((await s.action({ version: 0, type: 'work' }, token)).status).toBe(401);
    expect((await call(`/api/ai/sessions/${s.id}/owner`, { type: 'rotate' }, s.control)).status).toBe(401);
    expect((await s.action({ version: 0, type: 'work' })).status).toBe(200);
    expect((await call(`/api/ai/sessions/${s.id}/actions`, { version: 1, type: 'strategy', text: 'plan' }, s.control, { origin: 'https://evil.example' })).status).toBe(403);
  });
  it('applies speed upgrades to remaining spin charge', async () => {
    const s = await create();
    const before = await s.state(); before.run.cash = 1000; before.run.peak = 1000; before.run.portfolio = [{ id: 'edge-50', count: 1 }];
    sqlite.prepare('UPDATE ai_sessions SET state_json=?,started_at=?,next_spin_at=? WHERE id=?').run(JSON.stringify(before.run), Date.now(), Date.now() + 5000, s.id);
    vi.advanceTimersByTime(2000);
    const result = await (await s.action({ version: 0, type: 'upgrade', upgrade: 'speed' })).json();
    expect(result.nextSpinAt - Date.now()).toBe(result.choices.spinIntervalMs - 2000);
    expect(result.choices.spinIntervalMs).toBeLessThan(5000);
  });
  it('lets owner pause win a concurrent action and preserves a simultaneous rotation', async () => {
    const s = await create();
    const [paused, rotated] = await Promise.all([s.owner('pause'), s.owner('rotate'), s.action({ version: 0, type: 'work' })]);
    expect(paused.status).toBe(200); expect(rotated.status).toBe(200);
    const fresh = await rotated.json(); expect((await s.state()).status).toBe('paused');
    expect((await s.action({ version: (await s.state()).version, type: 'work' })).status).toBe(401);
    expect((await s.action({ version: (await s.state()).version, type: 'work' }, fresh.connectionUrl.split('/').pop())).status).toBe(423);
  });
  it('rejects oversized bodies, invalid JSON and too many creations', async () => {
    const s = await create();
    expect((await s.action({ version: 0, type: 'strategy', text: 'x'.repeat(9000) })).status).toBe(413);
    expect((await aiApi(new Request(`${origin}/api/ai/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), { DB: db })).status).toBe(400);
    for (let i = 1; i < 10; i++) await create();
    expect((await call('/api/ai/sessions', { nickname: 'limit', agentName: 'AI' })).status).toBe(429);
  });
  it('pauses, resumes and rotates without resetting work limit or timer, and revokes old URLs', async () => {
    const s = await create(); await s.action({ version: 0, type: 'work' });
    await s.owner('pause'); expect((await s.action({ version: 2, type: 'work' })).status).toBe(423);
    await s.owner('resume'); expect((await s.action({ version: 3, type: 'work' })).status).toBe(429);
    const rotated = await (await s.owner('rotate')).json(); expect((await s.action({ version: 4, type: 'work' })).status).toBe(401);
    expect((await call(new URL(s.connectionUrl).pathname)).status).toBe(410);
    vi.advanceTimersByTime(1000); expect((await s.action({ version: 4, type: 'work' }, rotated.connectionUrl.split('/').pop())).status).toBe(200);
    await s.owner('revoke'); expect((await s.state()).status).toBe('revoked');
    expect((await s.action({ version: 6, type: 'work' }, rotated.connectionUrl.split('/').pop())).status).toBe(410);
  });
  it('cannot resurrect an owner-revoked session in an action race', async () => {
    const s = await create(); const [stopped] = await Promise.all([s.owner('revoke'), s.action({ version: 0, type: 'work' })]);
    expect(stopped.status).toBe(200);
    expect((await s.state()).status).toBe('revoked');
    expect((await s.action({ version: (await s.state()).version, type: 'work' })).status).toBe(410);
  });
  it('automatically ranks first clear using server elapsed time and freezes the score', async () => {
    const s = await create(); await s.action({ version: 0, type: 'work' }); vi.advanceTimersByTime(3210);
    // Server fixture only: no public endpoint accepts any part of this state.
    const state = await s.state(); state.run.cash = TARGET - 1;
    sqlite.prepare('UPDATE ai_sessions SET state_json=? WHERE id=?').run(JSON.stringify(state.run), s.id);
    expect((await s.action({ version: 1, type: 'work' })).status).toBe(200);
    const finished = await s.state(); expect(finished.status).toBe('finished'); expect(finished.elapsedMs).toBe(3210); expect(finished.run.completion.ranked).toBe(false); expect(finished.run.completion.rulesetVersion).toMatch(/^ai-/);
    const ranks = await (await call('/api/ai/rankings')).json(); expect(ranks.scores).toHaveLength(1); expect(ranks.scores[0].timeMs).toBe(3210); expect(JSON.stringify(ranks)).not.toContain(s.control);
    expect((await s.action({ version: 2, type: 'work' })).status).toBe(409);
    expect((await call('/api/ai/rankings', { timeMs: 1, nickname: 'cheat' })).status).toBe(404);
    expect((await call('/api/ai/rankings?offset=-1')).status).toBe(400);
  });
  it('bounds activity history and expires connections', async () => {
    const s = await create(); for (let version = 0; version < 35; version++) await s.action({ version, type: 'strategy', text: 'Patient growth', reason: 'Save for slots' });
    expect((await s.state()).log).toHaveLength(30);
    vi.setSystemTime((await s.state()).expiresAt); expect((await s.action({ version: 35, type: 'work' })).status).toBe(410);
  });
  it('provides MCP initialize, list, state, action and structured rate errors', async () => {
    const s = await create(), path = `/api/ai/mcp/${s.id}`;
    const rpc = (method, params, id = 1) => call(path, { jsonrpc: '2.0', id, method, params }, s.control);
    expect((await (await rpc('initialize', { protocolVersion: '2025-11-25' })).json()).result.protocolVersion).toBe('2025-11-25');
    expect((await (await rpc('tools/list')).json()).result.tools.map(t => t.name)).toEqual(['get_state', 'act']);
    expect((await call(path, { jsonrpc: '2.0', method: 'notifications/initialized' }, s.control)).status).toBe(202);
    const work = await (await rpc('tools/call', { name: 'act', arguments: { version: 0, type: 'work' } })).json(); expect(JSON.parse(work.result.content[0].text).run.cash).toBe(1);
    const blocked = await (await rpc('tools/call', { name: 'act', arguments: { version: 1, type: 'work' } })).json(); expect(blocked.result.isError).toBe(true); expect(JSON.parse(blocked.result.content[0].text).retryAfterMs).toBe(200);
    expect((await (await rpc('tools/call', { name: 'fake' })).json()).error.code).toBe(-32602);
    expect((await call(path)).status).toBe(401);
    expect((await call(path, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'act', arguments: { version: 1, type: 'work' } } }, s.control, { 'mcp-protocol-version': '2099-01-01' })).status).toBe(400);
    expect((await s.state()).run.work).toBe(1);
  });
  it('routes through the production Worker and reports missing schema as unavailable', async () => {
    expect((await worker.fetch(new Request(origin + '/api/ai/rankings'), { DB: db })).status).toBe(200);
    sqlite.exec('DROP TABLE ai_sessions'); expect((await call('/api/ai/rankings')).status).toBe(503);
  });
});

describe('AI spectator spin views', () => {
  async function seedRun(session, patch) {
    const state = await session.state();
    const run = { ...state.run, cash: 10000, peak: 10000, portfolio: [{ id: 'edge-50', count: 1 }], ...patch };
    sqlite.prepare('UPDATE ai_sessions SET state_json=? WHERE id=?').run(JSON.stringify(run), session.id);
    return run;
  }
  const storedLog = session => JSON.parse(sqlite.prepare('SELECT log_json FROM ai_sessions WHERE id=?').get(session.id).log_json);
  async function nextSpin(session) {
    const state = await session.state();
    vi.setSystemTime(Math.max(Date.now(), state.nextSpinAt));
    const response = await session.action({ version: state.version, type: 'spin' });
    expect(response.status).toBe(200);
    return response.json();
  }

  it('captures the actual pre-spin portfolio and interval after equipment and upgrade actions', async () => {
    const s = await create(), earlier = await seedRun(s, { slots: 2 });
    expect((await s.action({ version: 0, type: 'equip', betId: 'edge-25', delta: 1 })).status).toBe(200);
    expect((await s.action({ version: 1, type: 'upgrade', upgrade: 'speed' })).status).toBe(200);
    const before = await s.state(), result = await nextSpin(s);
    expect(result.spinView).toEqual({ spinId: result.run.last.id, sweep: sweepSnapshot(before.run), intervalMs: interval(before.run), jackpotHigh: before.run.jackpotHigh, jackpotRule: before.run.settings.jackpotRule });
    expect(result.spinView.sweep).not.toEqual(sweepSnapshot(earlier));
    expect(result.spinView.sweep.bars[99]).toEqual({ payout: 680, cost: 110 });
    expect(result.spinView.intervalMs).toBeLessThan(5000);
    expect(result.log.every(entry => !Object.hasOwn(entry, 'spinView'))).toBe(true);
    expect(storedLog(s).filter(entry => entry.spinView)).toHaveLength(1);
  });

  it('preserves the pre-jackpot cut range, interval and flag instead of using the result state', async () => {
    const s = await create(), before = await seedRun(s, { spins: 31, trim: 3 });
    const first = await nextSpin(s);
    expect(first.run.last.jackpot).toBe(true);
    expect(first.run.removed).toBe(3);
    expect(first.spinView.sweep).toEqual(sweepSnapshot(before));
    expect(first.spinView.sweep.bars.filter(bar => bar === null)).toHaveLength(0);
    expect(first.spinView).toMatchObject({ intervalMs: 5000, jackpotHigh: false, jackpotRule: 'combined' });
    expect(first.choices.spinIntervalMs).toBe(300);
    expect(first.run.jackpotHigh).toBe(true);
    const second = await nextSpin(s);
    expect(second.spinView.sweep).toEqual(sweepSnapshot(first.run));
    expect(second.spinView.sweep.bars.filter(bar => bar === null)).toHaveLength(3);
    expect(second.spinView).toMatchObject({ spinId: first.run.last.id + 1, intervalMs: 300, jackpotHigh: true });
  });

  it('stores one latest view, preserves it through non-spin operations and strips it from every public log', async () => {
    const s = await create();
    await seedRun(s, {});
    const first = await nextSpin(s);
    expect((await s.action({ version: first.version, type: 'work' })).status).toBe(200);
    const working = await s.state();
    expect(working.spinView).toEqual(first.spinView);
    expect((await s.action({ version: working.version, type: 'upgrade', upgrade: 'speed' })).status).toBe(200);
    const upgraded = await s.state();
    expect(upgraded.spinView).toEqual(first.spinView);
    const second = await nextSpin(s), saved = storedLog(s);
    expect(saved.filter(entry => entry.spinView)).toHaveLength(1);
    expect(saved.find(entry => entry.version === first.version)).not.toHaveProperty('spinView');
    expect(saved.at(-1).spinView).toEqual(second.spinView);
    const guide = await (await call(new URL(s.connectionUrl).pathname)).json();
    const mcp = await (await call(`/api/ai/mcp/${s.id}`, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_state', arguments: {} } }, s.control)).json();
    for (const result of [second, await s.state(), guide.state, JSON.parse(mcp.result.content[0].text)]) {
      expect(result.spinView).toEqual(second.spinView);
      expect(result.log.every(entry => !Object.hasOwn(entry, 'spinView'))).toBe(true);
      expect(JSON.stringify(result).match(/"spinView"/g)).toHaveLength(1);
    }
  });

  it('supports existing sessions without a view and never attaches a view to another spin', async () => {
    const s = await create();
    expect(await s.state()).not.toHaveProperty('spinView');
    const before = await seedRun(s, {}), existing = spin(before, 80, 0);
    const legacyLog = [{ version: 1, type: 'spin', at: Date.now(), cash: existing.cash, roll: 80 }];
    sqlite.prepare('UPDATE ai_sessions SET state_json=?,log_json=?,version=1 WHERE id=?').run(JSON.stringify(existing), JSON.stringify(legacyLog), s.id);
    expect(await s.state()).not.toHaveProperty('spinView');
    legacyLog[0].spinView = { spinId: existing.last.id - 1, sweep: sweepSnapshot(before), intervalMs: 5000, jackpotHigh: false, jackpotRule: 'combined' };
    sqlite.prepare('UPDATE ai_sessions SET log_json=? WHERE id=?').run(JSON.stringify(legacyLog), s.id);
    const stale = await s.state();
    expect(stale).not.toHaveProperty('spinView');
    expect(stale.log[0]).not.toHaveProperty('spinView');
    const next = await nextSpin(s);
    expect(next.spinView.spinId).toBe(next.run.last.id);
  });

  it('keeps the action history bounded when the latest view ages out', async () => {
    const s = await create();
    await seedRun(s, {});
    const first = await nextSpin(s);
    for (let version = first.version; version < first.version + 30; version++) {
      expect((await s.action({ version, type: 'strategy', text: 'Stay the course' })).status).toBe(200);
    }
    const state = await s.state();
    expect(state.log).toHaveLength(30);
    expect(state).not.toHaveProperty('spinView');
    expect(storedLog(s).some(entry => entry.spinView)).toBe(false);
    const next = await nextSpin(s);
    expect(next.spinView.spinId).toBe(next.run.last.id);
    expect(storedLog(s).filter(entry => entry.spinView)).toHaveLength(1);
  });
});
