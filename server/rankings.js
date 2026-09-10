import { clearRecordRank } from "./recordRank.js";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const columns =
  "id, nickname, app_version AS appVersion, ruleset_version AS rulesetVersion, catalog_id AS catalog, time_ms AS timeMs, spins, created_at AS createdAt";
const insert = `INSERT OR IGNORE INTO clear_records (completion_id, nickname, app_version, ruleset_version, catalog_id, time_ms, spins, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
async function bodyJson(request) {
  if (
    !request.headers.get("content-type")?.startsWith("application/json") ||
    !request.body
  )
    return null;
  const reader = request.body.getReader();
  let raw = "",
    bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export async function rankingsApi(request, db, url, acceptsScore) {
  const origin = request.headers.get("origin");
  const allowed =
    !origin ||
    origin === url.origin ||
    origin === "https://bebullish.fun" || origin === "https://dontwork.fun" ||
    /^https:\/\/[a-z0-9-]+\.realnuun\.chatgpt\.site$/.test(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (!allowed) return json({ error: "このページからは送信できません。" }, 403);
  const respond = (response) => {
    const headers = new Headers(response.headers);
    if (origin) headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type");
    return new Response(response.body, { status: response.status, headers });
  };
  if (request.method === "OPTIONS")
    return respond(new Response(null, { status: 204 }));
  if (!db)
    return respond(
      json({ error: "ランキングの保存先に接続できません。" }, 503),
    );
  try {
    if (request.method === "GET") {
      if (url.searchParams.has("completionId")) {
        const id = url.searchParams.get("completionId");
        if (!uuid(id)) return respond(json({ error: "Invalid completion ID" }, 400));
        return respond(json({ ranking: await clearRecordRank(db, id) ?? null }));
      }
      const version = url.searchParams.get("version") ?? "all";
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (
        !(
          version === "all" ||
          version === "pe-legacy" ||
          /^\d+\.\d+\.\d+$/.test(version)
        ) ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 1e7
      )
        return respond(json({ error: "表示条件を確認してください。" }, 400));
      const where = version === "all" ? "" : " WHERE app_version = ?";
      const params = version === "all" ? [] : [version];
      const [scores, count, versions] = await Promise.all([
        db
          .prepare(
            `SELECT ${columns} FROM clear_records${where} ORDER BY time_ms ASC, id ASC LIMIT 50 OFFSET ?`,
          )
          .bind(...params, offset)
          .all(),
        db
          .prepare(`SELECT COUNT(*) AS total FROM clear_records${where}`)
          .bind(...params)
          .first(),
        db
          .prepare("SELECT DISTINCT app_version AS version FROM clear_records")
          .all(),
      ]);
      return respond(
        json({
          scores: scores.results ?? [],
          total: Number(count?.total ?? 0),
          offset,
          pageSize: 50,
          versions: [
            ...new Set([
              "1.10.0",
              ...(versions.results ?? []).map((r) => r.version),
            ]),
          ],
        }),
      );
    }
    if (request.method !== "POST")
      return respond(json({ error: "Method Not Allowed" }, 405));
    const input = await bodyJson(request);
    if (!input || typeof input !== "object")
      return respond(json({ error: "記録を読み取れませんでした。" }, 400));
    const nickname =
      typeof input.nickname === "string"
        ? input.nickname.replace(/[\u0000-\u001f\u007f]/g, "").trim()
        : "";
    if (
      !nickname ||
      Array.from(nickname).length > 16 ||
      !uuid(input.completionId) ||
      !acceptsScore(input) ||
      input.ranked !== true ||
      !Number.isSafeInteger(input.timeMs) ||
      input.timeMs < 1000 ||
      input.timeMs > 1209600000 ||
      !Number.isSafeInteger(input.spins) ||
      input.spins < 0 ||
      input.spins > 1e8
    )
      return respond(
        json({ error: "クリア記録と名前を確認してください。" }, 400),
      );
    const result = await db
      .prepare(insert)
      .bind(
        input.completionId,
        nickname,
        input.appVersion,
        input.rulesetVersion,
        input.catalog,
        input.timeMs,
        input.spins,
        new Date().toISOString(),
      )
      .run();
    const saved = await db
      .prepare("SELECT nickname FROM clear_records WHERE completion_id = ?")
      .bind(input.completionId)
      .first();
    return respond(
      json(
        {
          ok: true,
          duplicate: Number(result.meta?.changes ?? 0) === 0,
          nickname: saved.nickname,
        },
        Number(result.meta?.changes ?? 0) ? 201 : 200,
      ),
    );
  } catch {
    return respond(
      json(
        {
          error:
            "ランキングを読み書きできませんでした。もう一度お試しください。",
        },
        500,
      ),
    );
  }
}
