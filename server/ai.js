import { AI_RULESET, AI_WORK_INTERVAL, AI_WORKS_PER_SECOND, AiActionError, aiChoices, newAiRun, parseAiAction, performAiAction } from '../src/game/ai.ts';
import { canSpin, interval } from '../src/game/engine.ts';
import { sweepSnapshot } from '../src/game/sweep.ts';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
const bearer = request => request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1] ?? '';
const object = body => body && typeof body === 'object' && !Array.isArray(body);
const label = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 32 && !/[\u0000-\u001f\u007f]/u.test(value);
async function bodyOf(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AiActionError('json_required', 415);
  // Bound the actual stream too; a missing/false Content-Length cannot bypass this.
  const reader = request.body?.getReader();
  if (!reader) throw new AiActionError('invalid_json');
  let size = 0, chunks = [];
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 8192) { await reader.cancel(); throw new AiActionError('body_too_large', 413); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AiActionError('invalid_json'); }
}
function snapshot(row, now = Date.now()) {
  const run = JSON.parse(row.state_json);
  const storedLog = JSON.parse(row.log_json);
  const latestView = [...storedLog].reverse().find(entry => entry.spinView)?.spinView;
  const spinView = latestView && latestView.spinId === run.last?.id ? latestView : undefined;
  // The view is stored beside its accepted spin, but sent only once. Older
  // sessions and views aged out of the bounded log remain valid snapshots.
  const log = storedLog.map(({ spinView: _view, ...entry }) => entry);
  return { id: row.id, nickname: row.nickname, agentName: row.agent_name, ruleset: row.ruleset, version: row.version,
    createdAt: row.created_at, expiresAt: row.expires_at, startedAt: row.started_at, updatedAt: row.updated_at,
    status: row.finished_at !== null ? 'finished' : row.revoked_at !== null ? 'revoked' : row.expires_at <= now ? 'expired' : row.paused ? 'paused' : row.started_at === null ? 'waiting' : 'active',
    elapsedMs: row.duration_ms ?? (row.started_at === null ? 0 : Math.max(0, now - row.started_at)),
    nextWorkAt: row.last_work_at === null ? now : row.last_work_at + AI_WORK_INTERVAL, nextSpinAt: row.next_spin_at,
    strategy: row.strategy, log, ...(spinView ? { spinView } : {}), run, choices: aiChoices(run) };
}
function guide(row, origin, controlToken) {
  const base = `${origin}/api/ai/sessions/${row.id}`;
  return {
    game: 'dontwork.fun', ruleset: AI_RULESET, sessionId: row.id, nickname: row.nickname,
    instructions: [
      'You control only this separate AI game. Discuss a strategy with your user before acting; use strategy to publish the agreed plan and reason to explain individual actions to spectators.',
      'Goal: reach $1B cash. Rankings measure server wall time from the first accepted action, including thinking and pauses. No real money is involved.',
      'GET state before deciding. Use its current version in every action. A 409 means stale state: read again and reconsider. Never blindly retry a timed-out mutation with a new version.',
      `WORK earns $1 and is limited to ${AI_WORKS_PER_SECOND} calls/second: one accepted call per rolling ${AI_WORK_INTERVAL} ms, with no burst credit. SPIN has its own nextSpinAt deadline. On 429, use retryAfterMs or nextWorkAt for precise scheduling; HTTP Retry-After is rounded up to whole seconds.`,
      'Equip is free, delta is exactly +1 or -1. Changing equipment ends the current Jackpot. Upgrades spend cash; use choices for prices, unlocks and bet IDs.',
      'Spins run only when you call spin. You may run a local loop for your agreed strategy, using fresh versions and server deadlines. The browser is a spectator and need not remain open.',
      'This connection URL grants control. Keep it private. Stop on paused, revoked, expired or finished. Never submit AI records to human ranking endpoints.',
      'No reset, imported save, forced roll, batch work or client-supplied score is accepted. Model/agent name is a user label, not a verified identity.'
    ],
    authentication: { type: 'Bearer', token: controlToken },
    api: { state: base, action: `${base}/actions`, method: 'POST', example: { version: row.version, type: 'work', reason: 'Build starting cash' }, actionTypes: ['work', 'spin', 'equip', 'upgrade', 'strategy'] },
    mcp: { url: `${origin}/api/ai/mcp/${row.id}`, protocolVersion: '2025-11-25', bearerToken: controlToken,
      codexConfig: `[mcp_servers.dontwork]\nurl = "${origin}/api/ai/mcp/${row.id}"\nbearer_token_env_var = "DONTWORK_AI_TOKEN"`,
      claudeCommand: `claude mcp add --transport http dontwork ${origin}/api/ai/mcp/${row.id} --header "Authorization: Bearer $DONTWORK_AI_TOKEN"` },
    spectatorUrl: `${origin}/?ai=${row.id}`, state: snapshot(row),
  };
}
const connection = (origin, row, controlToken) => ({ id: row.id, connectionUrl: `${origin}/api/ai/connect/${controlToken}`, spectatorUrl: `${origin}/?ai=${row.id}` });
async function authenticated(request, db, id, owner = false) {
  const secret = bearer(request);
  if (!secret) throw new AiActionError('unauthorized', 401);
  const row = await db.prepare(`SELECT * FROM ai_sessions WHERE id = ? AND ${owner ? 'owner_hash' : 'control_hash'} = ?`).bind(id, await hash(secret)).first();
  if (!row) throw new AiActionError('unauthorized', 401);
  return row;
}
function available(row, now) {
  if (row.revoked_at !== null) throw new AiActionError('revoked', 410);
  if (row.expires_at <= now) throw new AiActionError('expired', 410);
  if (row.ruleset !== AI_RULESET) throw new AiActionError('ruleset_changed', 409);
  if (row.finished_at !== null) throw new AiActionError('finished', 409);
  if (row.paused) throw new AiActionError('paused', 423);
}
async function act(request, db, id, body) {
  const action = parseAiAction(body), row = await authenticated(request, db, id), now = Date.now();
  available(row, now);
  if (action.version !== row.version) throw new AiActionError('version_conflict', 409);
  if (action.type === 'work' && row.last_work_at !== null && now < row.last_work_at + AI_WORK_INTERVAL) throw new AiActionError('work_rate_limit', 429, row.last_work_at + AI_WORK_INTERVAL - now);
  if (action.type === 'spin' && now < row.next_spin_at) throw new AiActionError('spin_cooldown', 429, row.next_spin_at - now);
  const before = JSON.parse(row.state_json), started = row.started_at ?? now;
  const run = performAiAction(before, action, now, started);
  let nextSpin = row.next_spin_at;
  if (action.type === 'spin' || (!canSpin(before) && canSpin(run)) || action.type === 'equip') nextSpin = now + interval(run);
  else if (canSpin(before) && canSpin(run) && interval(before) !== interval(run)) nextSpin = Math.max(now, nextSpin - interval(before) + interval(run));
  const finished = run.clearAt === null ? null : now;
  const spinView = action.type === 'spin' ? {
    spinId: run.last.id,
    sweep: sweepSnapshot(before),
    intervalMs: interval(before),
    jackpotHigh: before.jackpotHigh,
    jackpotRule: before.settings.jackpotRule,
  } : undefined;
  const previousLog = JSON.parse(row.log_json);
  // A subsequent spin supersedes only the cosmetic view, never action history.
  // Non-spin operations retain the latest view until its log entry ages out.
  const retainedLog = spinView ? previousLog.map(({ spinView: _view, ...entry }) => entry) : previousLog;
  const log = [...retainedLog, { version: row.version + 1, at: now, type: action.type, reason: action.reason ?? '', betId: action.betId, upgrade: action.upgrade, delta: action.delta, cash: run.cash, roll: action.type === 'spin' ? run.last?.roll : undefined, ...(spinView ? { spinView } : {}) }].slice(-30);
  // A single conditional write linearizes all operations, including work, rotations and pauses.
  const updated = await db.prepare(`UPDATE ai_sessions SET state_json=?, log_json=?, strategy=?, version=version+1, started_at=?, updated_at=?, last_work_at=?, next_spin_at=?, finished_at=?, duration_ms=? WHERE id=? AND version=? AND control_hash=? AND revoked_at IS NULL AND paused=0 AND finished_at IS NULL RETURNING *`)
    .bind(JSON.stringify(run), JSON.stringify(log), action.type === 'strategy' ? action.text.trim() : row.strategy, started, now, action.type === 'work' ? now : row.last_work_at, nextSpin, finished, finished === null ? null : Math.max(1, now - started), id, row.version, row.control_hash).first();
  if (!updated) throw new AiActionError('version_conflict', 409);
  return snapshot(updated, now);
}
const actionSchema = { type: 'object', properties: { version: { type: 'integer', minimum: 0 }, type: { type: 'string', enum: ['work', 'spin', 'equip', 'upgrade', 'strategy'] }, betId: { type: 'string' }, delta: { type: 'integer', enum: [-1, 1] }, upgrade: { type: 'string', enum: ['slots', 'speed', 'capacity', 'trim', 'rush'] }, text: { type: 'string', maxLength: 1200 }, reason: { type: 'string', maxLength: 280 } }, required: ['version', 'type'], additionalProperties: false };
async function mcp(request, db, id) {
  const protocol = request.headers.get('mcp-protocol-version');
  if (protocol && !['2025-03-26', '2025-06-18', '2025-11-25'].includes(protocol)) throw new AiActionError('unsupported_protocol_version');
  const row = await authenticated(request, db, id);
  if (row.revoked_at !== null || row.expires_at <= Date.now()) throw new AiActionError('connection_closed', 410);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  const message = await bodyOf(request);
  const rpc = (result, error) => json({ jsonrpc: '2.0', id: message?.id ?? null, ...(error ? { error } : { result }) });
  if (!object(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' || (message.id !== undefined && typeof message.id !== 'number' && typeof message.id !== 'string')) return rpc(null, { code: -32600, message: 'Invalid Request' });
  if (message.id === undefined) return new Response(null, { status: 202, headers });
  if (message.method === 'initialize') return rpc({ protocolVersion: ['2025-03-26', '2025-06-18', '2025-11-25'].includes(message.params?.protocolVersion) ? message.params.protocolVersion : '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'dontwork-ai', version: '1.0.0' }, instructions: `Discuss strategy with your user. Read state and use its version for actions. WORK: max ${AI_WORKS_PER_SECOND}/second, once per rolling ${AI_WORK_INTERVAL}ms. Respect nextSpinAt and retryAfterMs. Scores are server wall time to $1B. Stop when paused, finished or revoked.` });
  if (message.method === 'ping') return rpc({});
  if (message.method === 'tools/list') return rpc({ tools: [
    { name: 'get_state', description: 'Read this AI game, current version, legal choices, prices, cooldowns, strategy and recent actions.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
    { name: 'act', description: `One game action. Pass fresh version; work max ${AI_WORKS_PER_SECOND}/second (one per ${AI_WORK_INTERVAL}ms); spin respects nextSpinAt. equip: betId + delta (+1/-1), upgrade: upgrade ID, strategy: text. Optional reason explains decisions to spectators. 409: reread, never blindly retry.`, inputSchema: actionSchema },
  ] });
  if (message.method === 'tools/call') {
    if (!['get_state', 'act'].includes(message.params?.name)) return rpc(null, { code: -32602, message: 'Unknown tool' });
    try {
      const result = message.params.name === 'get_state' ? snapshot(row) : await act(request, db, id, message.params.arguments);
      return rpc({ content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (e) { if (!(e instanceof AiActionError)) throw e; return rpc({ isError: true, content: [{ type: 'text', text: JSON.stringify({ error: e.code, status: e.status, retryAfterMs: e.retryAfterMs }) }] }); }
  }
  return rpc(null, { code: -32601, message: 'Method not found' });
}
export async function aiApi(request, env, url = new URL(request.url)) {
  // Browser requests must be same origin. Bearer clients without Origin are supported.
  if (request.headers.has('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'origin_not_allowed' }, 403);
  if (!env.DB) return json({ error: 'ai_unavailable' }, 503);
  try {
    const db = env.DB, path = url.pathname, now = Date.now();
    if (path === '/api/ai/sessions' && request.method === 'POST') {
      const body = await bodyOf(request);
      if (!object(body) || Object.keys(body).some(key => !['nickname', 'agentName'].includes(key)) || !label(body.nickname) || !label(body.agentName)) throw new AiActionError('invalid_name');
      const bucket = Math.floor(now / 3600000), rateHash = await hash(`ai-create:${bucket}:${request.headers.get('cf-connecting-ip') ?? 'local'}`);
      const rate = await db.prepare('INSERT INTO ai_creation_limits(request_hash,request_count,expires_at) VALUES(?,1,?) ON CONFLICT(request_hash) DO UPDATE SET request_count=request_count+1 WHERE request_count<10 RETURNING request_count').bind(rateHash, now + 3600000).first();
      if (!rate) throw new AiActionError('creation_rate_limit', 429, 3600000 - now % 3600000);
      const ownerToken = token(), controlToken = token(), run = newAiRun();
      const row = await db.prepare('INSERT INTO ai_sessions(id,owner_hash,control_hash,nickname,agent_name,ruleset,state_json,created_at,expires_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING *')
        .bind(run.id, await hash(ownerToken), await hash(controlToken), body.nickname.trim(), body.agentName.trim(), AI_RULESET, JSON.stringify(run), now, now + 7 * 86400000, now).first();
      return json({ ...connection(url.origin, row, controlToken), ownerToken, state: snapshot(row, now) }, 201);
    }
    if (path === '/api/ai/rankings' && request.method === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw new AiActionError('invalid_offset');
      const scores = await db.prepare('SELECT nickname,agent_name AS agentName,duration_ms AS timeMs,finished_at AS finishedAt,json_extract(state_json,\'$.spins\') AS spins,json_extract(state_json,\'$.work\') AS work FROM ai_sessions WHERE ruleset=? AND finished_at IS NOT NULL ORDER BY duration_ms,finished_at,id LIMIT 50 OFFSET ?').bind(AI_RULESET, offset).all();
      return json({ ruleset: AI_RULESET, scores: scores.results, offset });
    }
    const connect = path.match(/^\/api\/ai\/connect\/([a-f0-9]{64})$/);
    if (connect && request.method === 'GET') {
      const row = await db.prepare('SELECT * FROM ai_sessions WHERE control_hash=?').bind(await hash(connect[1])).first();
      if (!row || row.revoked_at !== null || row.expires_at <= now) throw new AiActionError('connection_closed', 410);
      return json(guide(row, url.origin, connect[1]));
    }
    const rpc = path.match(/^\/api\/ai\/mcp\/([a-f0-9-]{36})$/);
    if (rpc) return await mcp(request, db, rpc[1]);
    const session = path.match(/^\/api\/ai\/sessions\/([a-f0-9-]{36})(?:\/(actions|owner))?$/);
    if (session) {
      const [, id, operation] = session;
      if (!operation && request.method === 'GET') {
        const row = await db.prepare('SELECT * FROM ai_sessions WHERE id=?').bind(id).first();
        if (!row) throw new AiActionError('not_found', 404);
        return json(snapshot(row, now));
      }
      if (operation === 'actions' && request.method === 'POST') return json(await act(request, db, id, await bodyOf(request)));
      if (operation === 'owner' && request.method === 'POST') {
        const row = await authenticated(request, db, id, true), body = await bodyOf(request);
        if (!object(body) || Object.keys(body).some(key => key !== 'type') || !['pause', 'resume', 'rotate', 'revoke'].includes(body.type)) throw new AiActionError('invalid_owner_action');
        if (row.revoked_at !== null || row.expires_at <= now) throw new AiActionError('connection_closed', 410);
        const controlToken = body.type === 'rotate' ? token() : null;
        // Owner stop/rotation cannot be starved by a busy agent. Update only the
        // intended fields; never restore a control hash read before another rotation.
        const change = body.type === 'pause' ? ['paused=1', []] : body.type === 'resume' ? ['paused=0,next_spin_at=?', [now + interval(JSON.parse(row.state_json))]] : body.type === 'rotate' ? ['control_hash=?', [await hash(controlToken)]] : ['revoked_at=?,paused=1', [now]];
        const updated = await db.prepare(`UPDATE ai_sessions SET ${change[0]},version=version+1,updated_at=? WHERE id=? AND owner_hash=? AND revoked_at IS NULL AND expires_at>? RETURNING *`)
          .bind(...change[1], now, id, row.owner_hash, now).first();
        if (!updated) throw new AiActionError('connection_closed', 410);
        return json({ state: snapshot(updated, now), ...(controlToken ? connection(url.origin, updated, controlToken) : {}) });
      }
      return json({ error: 'method_not_allowed' }, 405);
    }
    return json({ error: 'not_found' }, 404);
  } catch (error) {
    if (error instanceof AiActionError) return json({ error: error.code, retryAfterMs: error.retryAfterMs }, error.status, error.retryAfterMs ? { 'Retry-After': String(Math.ceil(error.retryAfterMs / 1000)) } : {});
    // Missing migrations/quota/backend outages are not success and must not create local fake games.
    console.error('ai backend unavailable');
    return json({ error: 'ai_unavailable' }, 503);
  }
}
