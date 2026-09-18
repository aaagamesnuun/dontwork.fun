// Local API using the exact built Worker and an isolated SQLite database.
// Start after npm run build, alongside VITE_ENABLE_SERVICES=true npm run dev.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import worker from '../dist/server/index.js';
mkdirSync('.wrangler', { recursive: true });
const sqlite = new DatabaseSync('.wrangler/ai-dev.sqlite');
sqlite.exec(readFileSync(new URL('../drizzle/0011_ai_sessions.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql) { let args = []; return {
  bind(...values) { args = values; return this; },
  async first() { return sqlite.prepare(sql).get(...args) ?? null; },
  async all() { return { results: sqlite.prepare(sql).all(...args) }; },
  async run() { return { meta: sqlite.prepare(sql).run(...args) }; },
}; } };
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://${incoming.headers.host}`);
    if (!url.pathname.startsWith('/api/ai/')) { outgoing.writeHead(404); outgoing.end(); return; }
    const request = new Request(url, { method: incoming.method, headers: incoming.headers,
      ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
    const response = await worker.fetch(request, { DB });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end('Local AI API failed'); }
});
server.listen(8787, '127.0.0.1', () => console.log('Local AI API ready: http://127.0.0.1:8787 (isolated local data)'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { sqlite.close(); process.exit(0); }));
