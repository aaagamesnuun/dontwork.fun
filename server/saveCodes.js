const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const maxBytes = 2_100_000;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
export const normalizeCode = (value) =>
  typeof value === "string" ? value.toUpperCase().replace(/[\s-]/g, "") : "";
async function hash(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function readBody(request) {
  if (
    !request.headers.get("content-type")?.startsWith("application/json") ||
    !request.body
  )
    return null;
  const reader = request.body.getReader(),
    decoder = new TextDecoder();
  let raw = "",
    count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    return JSON.parse(raw + decoder.decode());
  } catch {
    return null;
  }
}
function validSave(input) {
  if (
    !input ||
    typeof input.save !== "string" ||
    input.save.length > 2_000_000 ||
    typeof input.appVersion !== "string" ||
    !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(input.appVersion)
  )
    return false;
  try {
    const s = JSON.parse(input.save);
    if (s?.kind === "dontwork-origin-migration-v1") {
      const keys = ["bebullish-save-v1", "bebullish-normal-slot-v1", "bebullish-30m-slot-v1", "bebullish-ranking-outbox-v1", "bebullish-30m-outbox-v1", "bebullish-intro-seen-v2", "bebullish-sound-default-v1", "bebullish-install-id", "bebullish-telemetry-pending"];
      if(s.version !== 1 || !Number.isFinite(s.createdAt) || !s.entries || typeof s.entries !== "object" || Array.isArray(s.entries)) return false;
      const entries = Object.entries(s.entries);
      return entries.length > 0 && entries.every(([key,value]) => typeof value === "string" && (keys.includes(key) || /^bebullish-clear-rating-seen:[a-zA-Z0-9-]{1,100}$/.test(key)))
        && keys.slice(0,3).every(key => !s.entries[key] || !JSON.parse(s.entries[key]).kind && validSave({save:s.entries[key],appVersion:input.appVersion}))
        && keys.slice(3,5).every(key => !s.entries[key] || Array.isArray(JSON.parse(s.entries[key])));
    }
    return (
      s?.version === 1 &&
      typeof s.id === "string" &&
      s.id.length <= 100 &&
      typeof s.catalog === "string" &&
      s.catalog.length <= 32 &&
      Number.isFinite(s.cash) &&
      Number.isSafeInteger(s.spins) &&
      s.spins >= 0 &&
      s.settings &&
      typeof s.settings === "object" &&
      Array.isArray(s.history)
    );
  } catch {
    return false;
  }
}
// Immutable snapshots: a fresh code never replaces a previously issued save.
export async function saveCodesApi(request, env, url) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== url.origin &&
    origin !== "https://bebullish.fun" && origin !== "https://dontwork.fun" &&
    !/^https:\/\/[a-z0-9-]+\.realnuun\.chatgpt\.site$/.test(origin) &&
    !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  )
    return json({ error: "このページからは利用できません。" }, 403);
  const respond = (response) => {
    const headers = new Headers(response.headers);
    if (origin) headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type");
    return new Response(response.body, { status: response.status, headers });
  };
  if (request.method === "OPTIONS")
    return respond(new Response(null, { status: 204 }));
  if (request.method !== "POST")
    return respond(json({ error: "Method Not Allowed" }, 405));
  if (!env.DB || !env.SAVE_CODE_SECRET)
    return respond(json({ error: "合言葉の保存先に接続できません。" }, 503));
  const restoring = url.pathname.endsWith("/restore");
  try {
    const bucket = Math.floor(Date.now() / 3600000);
    const ipHash = await hash(
      env.SAVE_CODE_SECRET,
      `rate:${restoring ? "read" : "write"}:${request.headers.get("cf-connecting-ip") ?? "unknown"}`,
    );
    const rate = await env.DB.prepare(
      `INSERT INTO save_code_rate_limits (request_hash, bucket, request_count)
      VALUES (?, ?, 1) ON CONFLICT(request_hash, bucket) DO UPDATE SET request_count = request_count + 1 RETURNING request_count`,
    )
      .bind(ipHash, bucket)
      .first();
    await env.DB.prepare("DELETE FROM save_code_rate_limits WHERE bucket < ?")
      .bind(bucket - 24)
      .run();
    if (!rate || rate.request_count > (restoring ? 60 : 30))
      return respond(
        json({ error: "時間をおいてから再度お試しください。" }, 429),
      );
    const input = await readBody(request);
    if (restoring) {
      const code = normalizeCode(input?.code);
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code))
        return respond(
          json({ error: "6文字の合言葉を確認してください。" }, 400),
        );
      const codeHash = await hash(env.SAVE_CODE_SECRET, "save:" + code);
      const row = await env.DB.prepare(
        "SELECT snapshot_json AS save, app_version AS appVersion, created_at AS createdAt FROM save_codes WHERE code_hash = ?",
      )
        .bind(codeHash)
        .first();
      return respond(
        row
          ? json(row)
          : json(
              { error: "合言葉が見つかりません。文字を確認してください。" },
              404,
            ),
      );
    }
    if (!validSave(input))
      return respond(json({ error: "セーブを読み取れませんでした。" }, 400));
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        (b) => alphabet[b & 31],
      ).join("");
      const codeHash = await hash(env.SAVE_CODE_SECRET, "save:" + code);
      const createdAt = new Date().toISOString();
      const result = await env.DB.prepare(
        "INSERT OR IGNORE INTO save_codes (code_hash, snapshot_json, app_version, created_at) VALUES (?, ?, ?, ?)",
      )
        .bind(codeHash, input.save, input.appVersion, createdAt)
        .run();
      if (Number(result.meta?.changes) === 1)
        return respond(json({ code, createdAt }, 201));
    }
    return respond(
      json(
        { error: "合言葉を作れませんでした。もう一度お試しください。" },
        503,
      ),
    );
  } catch {
    return respond(
      json(
        { error: "セーブを読み書きできませんでした。もう一度お試しください。" },
        500,
      ),
    );
  }
}
