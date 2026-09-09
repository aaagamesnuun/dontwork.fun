import { describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker, { feedbackApi, parseEvent, parseFeedback, refreshReports, sanitizeProps } from "./worker.js";

const validEvent = () => ({
  eventId: "11111111-1111-4111-8111-111111111111",
  runId: "22222222-2222-4222-8222-222222222222",
  sessionId: "33333333-3333-4333-8333-333333333333",
  sequence: 4,
  activeMs: 1_250,
  eventName: "draft_choose",
  appVersion: "0.7.0",
  rulesetVersion: "all-pool-copies-v1",
  schemaVersion: 1,
  debug: false,
  language: "en",
  deviceClass: "mobile",
  viewportClass: "small",
  props: { chosenId: "odd-job", copiesBefore: 1, copiesAfter: 2, nickname: "must-not-survive" },
});

describe("telemetry ingestion validation", () => {
  it("keeps upgrade base prices numeric instead of replacing them with validation booleans", () => {
    expect(sanitizeProps({positionPriceBase:120,speedPriceBase:25})).toEqual({positionPriceBase:120,speedPriceBase:25});
    for(const value of [true,0,-1,2.5,Infinity,"120"])
      expect(sanitizeProps({positionPriceBase:value,speedPriceBase:value})).toEqual({});
  });
  it("accepts an allowlisted anonymous game event", () => {
    const parsed = parseEvent(validEvent());
    expect(parsed?.props).toEqual({ chosenId: "odd-job", copiesBefore: 1, copiesAfter: 2 });
  });

  it("rejects invalid identifiers and event names", () => {
    expect(parseEvent({ ...validEvent(), eventId: "bad" })).toBeNull();
    expect(parseEvent({ ...validEvent(), eventName: "key_press" })).toBeNull();
  });

  it("drops personal and arbitrary text fields", () => {
    expect(sanitizeProps({ nickname: "name", ip: "127.0.0.1", message: "free text", cardId: "odd-job" }))
      .toEqual({ cardId: "odd-job" });
    expect(sanitizeProps({ cardId: "invented-card", chosenId: "invented-card" })).toEqual({});
  });

  it("accepts v2 engagement and allowlisted per-card economy maps", () => {
    const parsed = parseEvent({
      ...validEvent(),
      schemaVersion: 2,
      engagedMs: 900,
      eventName: "spin_batch",
      props: {
        spins: 3,
        clicks: -2,
        wager: "not-a-number",
        wagerByCard: { "edge-50": 30, "even-money": "not-a-number", "invented-card": 999, "bad key": 999 },
        profitByCard: { "edge-50": -15 },
        hitByCard: { "edge-50": -1 },
        builds: ["full-coverage"],
      },
    });
    expect(parsed?.engagedMs).toBe(900);
    expect(parsed?.props).toEqual({
      spins: 3,
      wagerByCard: { "edge-50": 30 },
      profitByCard: { "edge-50": -15 },
      builds: ["full-coverage"],
    });
  });

  it("keeps valid experiment settings and drops invented variants", () => {
    expect(sanitizeProps({
      names: ["reelStyle", "jackpotSpinGrant"],
      source: "lab",
      reelStyle: "payoff",
      revealDurationMs: 260,
      jackpotSpinGrant: 50,
      interestRate: 0.005,
      leverageMode: false,
      settingsLanguage: "ja",
      soundMuted: true,
    })).toEqual({
      names: ["reelStyle", "jackpotSpinGrant"],
      source: "lab",
      reelStyle: "payoff",
      revealDurationMs: 260,
      jackpotSpinGrant: 50,
      interestRate: 0.005,
      leverageMode: false,
      settingsLanguage: "ja",
      soundMuted: true,
    });
    expect(sanitizeProps({ reelStyle: "invented", jackpotSpinGrant: 9_999, interestRate: -1 }))
      .toEqual({});
  });
});

const validFeedback = () => ({
  category: "idea",
  identityMode: "anonymous",
  displayName: "",
  replyContact: "",
  message: "The opening tutorial could move faster.",
  appVersion: "0.7.1",
  language: "en",
  bankroll: 42,
  totalSpins: 12,
  totalDraws: 1,
  page: "spin",
});

describe("feedback ingestion validation", () => {
  it("accepts anonymous feedback without retaining identity fields", () => {
    expect(parseFeedback(validFeedback())).toMatchObject({ identityMode: "anonymous", displayName: null, replyContact: null });
  });

  it("accepts an explicitly named message and normalizes the name", () => {
    expect(parseFeedback({ ...validFeedback(), identityMode: "named", displayName: "  Ｎｕｕｎ  ", replyContact: " discord: nuun " }))
      .toMatchObject({ identityMode: "named", displayName: "Nuun", replyContact: "discord: nuun" });
  });

  it("enforces anonymous-or-name exclusivity", () => {
    expect(parseFeedback({ ...validFeedback(), displayName: "Someone" })).toBeNull();
    expect(parseFeedback({ ...validFeedback(), identityMode: "named", displayName: "" })).toBeNull();
  });

  it("rejects unknown categories and messages outside the length bounds", () => {
    expect(parseFeedback({ ...validFeedback(), category: "support" })).toBeNull();
    expect(parseFeedback({ ...validFeedback(), message: "no" })).toBeNull();
    expect(parseFeedback({ ...validFeedback(), message: "x".repeat(2001) })).toBeNull();
  });
});

const fakeFeedbackEnv = (requestCount = 1) => {
  const calls = [];
  return {
    calls,
    env: {
      TELEMETRY_HASH_KEY: "test-feedback-secret",
      DB: {
        prepare: (sql) => ({
          bind: (...args) => ({
            first: async () => {
              calls.push({ method: "first", sql, args });
              return sql.includes("feedback_rate_limits") ? (requestCount === null ? null : { requestCount }) : null;
            },
            run: async () => {
              calls.push({ method: "run", sql, args });
              return { success: true };
            },
          }),
        }),
      },
    },
  };
};

describe("feedback write-only endpoint", () => {
  it("stores a valid same-origin anonymous message without identity fields", async () => {
    const { env, calls } = fakeFeedbackEnv();
    const url = new URL("https://game.example/api/feedback");
    const response = await feedbackApi(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin, "cf-connecting-ip": "203.0.113.10" },
      body: JSON.stringify(validFeedback()),
    }), env, url);
    expect(response.status).toBe(201);
    const insert = calls.find((call) => call.method === "run" && call.sql.includes("INSERT INTO feedback_messages"));
    expect(insert?.args.slice(1, 5)).toEqual(["idea", "anonymous", null, null]);
  });

  it("rejects cross-origin posts and caps a rate-limit bucket", async () => {
    const url = new URL("https://game.example/api/feedback");
    const first = fakeFeedbackEnv();
    const crossOrigin = await feedbackApi(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify(validFeedback()),
    }), first.env, url);
    expect(crossOrigin.status).toBe(403);
    expect(first.calls).toHaveLength(0);

    const limited = fakeFeedbackEnv(null);
    const rateLimited = await feedbackApi(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin, "cf-connecting-ip": "203.0.113.11" },
      body: JSON.stringify(validFeedback()),
    }), limited.env, url);
    expect(rateLimited.status).toBe(429);
    expect(limited.calls.some((call) => call.sql.includes("INSERT INTO feedback_messages"))).toBe(false);
  });
});

const sqliteD1 = () => {
  const database = new DatabaseSync(":memory:");
  let queryCount = 0;
  for (const name of ["0000_leaderboard.sql", "0001_telemetry.sql", "0002_feedback.sql", "0003_telemetry_v2.sql", "0004_leaderboard_rulesets.sql", "0005_feedback_context.sql", "0006_clear_records.sql", "0007_save_codes.sql", "0008_ratings.sql"]) {
    database.exec(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8"));
  }
  const prepare = (sql) => {
    const bound = (args = []) => ({
      bind: (...next) => bound(next),
      all: async () => { queryCount += 1; return { results: database.prepare(sql).all(...args) }; },
      first: async () => { queryCount += 1; return database.prepare(sql).get(...args) ?? null; },
      run: async () => {
        queryCount += 1;
        const result = database.prepare(sql).run(...args);
        return { success: true, meta: { changes: Number(result.changes ?? 0) } };
      },
    });
    return bound();
  };
  return {
    prepare,
    getQueryCount: () => queryCount,
    resetQueryCount: () => { queryCount = 0; },
    batch: async (statements) => {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
};

describe("production sound experiment ingestion", () => {
  it("keeps the recent-run ruleset aligned when an existing save moves from v9 to v10",async()=>{
    const DB=sqliteD1(),installId=crypto.randomUUID(),base=validEvent();
    for(const [appVersion,rulesetVersion,activeMs] of [["2.3.0","astra-v9:classic",1000],["2.4.0","astra-v10:classic",2000]]) {
      const event={...base,eventId:crypto.randomUUID(),eventName:"snapshot",appVersion,rulesetVersion,activeMs,sequence:activeMs/1000,
        schemaVersion:2,props:{bankroll:120,totalSpins:5,totalWork:10}};
      const response=await worker.fetch(new Request("https://game.example/api/telemetry",{method:"POST",headers:{origin:"https://game.example","content-type":"application/json"},body:JSON.stringify({installId,events:[event]})}),{DB,TELEMETRY_HASH_KEY:"test"});
      expect(response.status).toBe(202);
    }
    for(const table of ["telemetry_runs","telemetry_recent_runs"])
      expect(await DB.prepare(`SELECT ruleset_version FROM ${table} WHERE run_id=?`).bind(base.runId).first()).toMatchObject({ruleset_version:"astra-v10:classic"});
  });
  it("persists assigned variants and exposes aggregate counts only in the owner report table",async()=>{
    const DB=sqliteD1(),props={soundExperiment:"sound-default-v1",soundVariant:"retro-arcade",soundAssignedAt:Date.now(),soundPack:"retro-arcade"};
    const event={...validEvent(),eventId:crypto.randomUUID(),eventName:"sound_assignment",appVersion:"2.3.0",rulesetVersion:"astra-v9:classic",activeMs:0,schemaVersion:2,props};
    const response=await worker.fetch(new Request("https://game.example/api/telemetry",{method:"POST",headers:{origin:"https://game.example","content-type":"application/json"},body:JSON.stringify({installId:crypto.randomUUID(),events:[event]})}),{DB,TELEMETRY_HASH_KEY:"test"});
    expect(response.status).toBe(202);
    expect(JSON.parse((await DB.prepare('SELECT props_json FROM telemetry_events').first()).props_json)).toEqual(props);
    const report=JSON.parse((await DB.prepare('SELECT payload_json FROM telemetry_reports WHERE report_key=?').bind('experiment:sound-default-v1').first()).payload_json);
    expect(report.groups.find(g=>g.variant==='retro-arcade')).toMatchObject({assigned:1,return24to48h:{eligible:0,rate:null}});
    expect(sanitizeProps({...props,soundVariant:"uncontrolled",soundAssignedAt:"tomorrow",workspaceMode:"wrong",baccarat:"yes"})).toEqual({soundExperiment:"sound-default-v1",soundPack:"retro-arcade"});
  });
});

describe("telemetry v2 report refresh", () => {
  it("ingests an engaged run and materializes corrected reports", async () => {
    const DB = sqliteD1();
    const base = {
      runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      appVersion: "0.7.2",
      rulesetVersion: "all-pool-copies-v1",
      schemaVersion: 2,
      debug: false,
      language: "en",
      deviceClass: "desktop",
      viewportClass: "large",
    };
    const event = (eventId, sequence, activeMs, engagedMs, eventName, props = {}) => ({
      ...base, eventId, sequence, activeMs, engagedMs, eventName, props,
    });
    const events = [
      event("00000000-0000-4000-8000-000000000001", 0, 0, 0, "session_start", { entryKind: "fresh" }),
      event("00000000-0000-4000-8000-000000000002", 1, 100, 0, "interaction_start", { input: "pointer" }),
      event("00000000-0000-4000-8000-000000000003", 2, 200, 100, "milestone", { name: "first_work", bankroll: 1 }),
      event("00000000-0000-4000-8000-000000000004", 3, 250, 150, "work_batch", { clicks: 1, potentialCompute: 1, wastedCompute: 1 }),
      event("00000000-0000-4000-8000-000000000005", 4, 300, 200, "snapshot", {
        bankroll: 1, peakBankroll: 1, fuel: 5, fuelCapacity: 5, slotCount: 1, spinSpeedLevel: 0,
        totalSpins: 0, totalDraws: 0, totalWork: 1, bankruptcies: 0, cleared: false,
        status: "ready", deck: [], copies: [],
      }),
      event("00000000-0000-4000-8000-000000000006", 5, 400, 300, "draft_offer", {
        transactionId: "draw-1", drawIndex: 1, price: 25, bankrollBefore: 100,
        offers: [{ id: "trim-reaper", copiesBefore: 0, rarity: "epic", tier: 4, baseCost: 100000, basePayout: 195000 }],
      }),
      event("00000000-0000-4000-8000-000000000007", 6, 500, 400, "draft_choose", {
        transactionId: "draw-1", drawIndex: 1, chosenId: "trim-reaper", duplicate: false, offerIndex: 0, rarity: "epic",
      }),
      event("00000000-0000-4000-8000-000000000008", 7, 600, 500, "spin_batch", {
        spins: 10, wager: 3000000, payout: 5000000, profit: 2000000, rushSpins: 8, rushProfit: 1800000,
        deck: [{ id: "trim-reaper", count: 1 }, { id: "rush-hour", count: 1 }, { id: "memory-leak", count: 1 }],
        builds: ["jackpot-loop"], hitByCard: { "trim-reaper": 5 }, wagerByCard: { "trim-reaper": 1000000 },
        payoutByCard: { "trim-reaper": 1500000 }, profitByCard: { "trim-reaper": 500000 }, effectsByCard: { "trim-reaper": 1 },
      }),
      event("00000000-0000-4000-8000-000000000009", 8, 700, 600, "clear", {
        bankroll: 100000000, wallTimeMs: 5000, spins: 10, draws: 1, builds: ["jackpot-loop"],
      }),
      event("00000000-0000-4000-8000-000000000010", 9, 750, 650, "snapshot", {
        bankroll: 100000000, peakBankroll: 100000000, fuel: 5, fuelCapacity: 5, slotCount: 3, spinSpeedLevel: 2,
        totalSpins: 10, totalDraws: 1, totalWork: 1, bankruptcies: 0, cleared: true, status: "cleared",
        deck: [{ id: "odd-job", count: 1 }, { id: "even-money", count: 1 }],
        copies: [{ id: "trim-reaper", count: 1 }],
      }),
    ];
    const url = new URL("https://game.example/api/telemetry");
    const response = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin },
      body: JSON.stringify({ installId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", events }),
    }), { DB, TELEMETRY_HASH_KEY: "test-secret" });
    expect(response.status).toBe(202);
    expect(DB.getQueryCount()).toBeLessThanOrEqual(50);
    const delayed = {
      ...event("00000000-0000-4000-8000-000000000011", 999, 250, 150, "snapshot", {
        bankroll: 2, peakBankroll: 2, fuel: 0, fuelCapacity: 5, slotCount: 1, spinSpeedLevel: 0,
        totalSpins: 0, totalDraws: 0, totalWork: 1, bankruptcies: 0, cleared: false, status: "ready",
        deck: [], copies: [],
      }),
      sessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };
    const delayedResponse = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin },
      body: JSON.stringify({ installId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", events: [delayed] }),
    }), { DB, TELEMETRY_HASH_KEY: "test-secret" });
    expect(delayedResponse.status).toBe(202);
    const mixedResponse = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin },
      body: JSON.stringify({
        installId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        events: [
          event("00000000-0000-4000-8000-000000000012", 12, 800, 700, "session_end", { reason: "test" }),
          { ...event("00000000-0000-4000-8000-000000000013", 0, 801, 701, "session_start", { entryKind: "resume" }),
            sessionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
        ],
      }),
    }), { DB, TELEMETRY_HASH_KEY: "test-secret" });
    expect(mixedResponse.status).toBe(400);
    await refreshReports(DB, "all-pool-copies-v1");
    const overview = await DB.prepare("SELECT sample_size, payload_json FROM telemetry_reports WHERE report_key = ?")
      .bind("all-pool-copies-v1:overview").first();
    expect(overview.sample_size).toBe(1);
    expect(JSON.parse(overview.payload_json)).toMatchObject({ observedRuns: 1, passiveRuns: 0, engagedRuns: 1, totalWork: 1, totalSpins: 10, clears: 1 });
    const run = await DB.prepare("SELECT bankroll, snapshot_active_ms FROM telemetry_runs WHERE run_id = ?")
      .bind(base.runId).first();
    expect(run).toMatchObject({ bankroll: 100000000, snapshot_active_ms: 750 });
    const onboarding = await DB.prepare("SELECT payload_json FROM telemetry_reports WHERE report_key = ?")
      .bind("all-pool-copies-v1:onboarding_30m").first();
    expect(JSON.parse(onboarding.payload_json).funnel.first_work.reachedWithin30m).toBe(1);
    const cardsReport = await DB.prepare("SELECT payload_json FROM telemetry_reports WHERE report_key = ?")
      .bind("all-pool-copies-v1:cards").first();
    const card = JSON.parse(cardsReport.payload_json).cards.find((row) => row.cardId === "trim-reaper");
    expect(card).toMatchObject({ offered: 1, chosen: 1, spinExposures: 10, profit: 500000,
      firstDeployMedianMs: 600, acquisitionToDeployMedianMs: 100 });
    const buildsReport = await DB.prepare("SELECT payload_json FROM telemetry_reports WHERE report_key = ?")
      .bind("all-pool-copies-v1:builds").first();
    const builds = JSON.parse(buildsReport.payload_json).builds;
    expect(builds.find((row) => row.buildId === "jackpot-loop"))
      .toMatchObject({ deployedRuns: 1, clearRuns: 1, spinExposures: 10 });
    expect(builds.find((row) => row.buildId === "full-coverage").clearRuns).toBe(0);
  });

  it("keeps a worst-case 20-event ingestion below the D1 per-invocation query budget", async () => {
    const DB = sqliteD1();
    const events = Array.from({ length: 20 }, (_, index) => ({
      eventId: crypto.randomUUID(),
      runId: "12121212-1212-4121-8121-121212121212",
      sessionId: "34343434-3434-4343-8343-343434343434",
      sequence: index,
      activeMs: index,
      engagedMs: index,
      eventName: index === 0 ? "session_start" : "milestone",
      appVersion: "0.7.2",
      rulesetVersion: "all-pool-copies-v1",
      schemaVersion: 2,
      debug: false,
      language: "en",
      deviceClass: "desktop",
      viewportClass: "large",
      props: index === 0 ? { entryKind: "fresh" } : { name: "first_work" },
    }));
    const url = new URL("https://game.example/api/telemetry");
    const response = await worker.fetch(new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: url.origin },
      body: JSON.stringify({ installId: "56565656-5656-4565-8565-565656565656", events }),
    }), { DB, TELEMETRY_HASH_KEY: "test-secret" });
    expect(response.status).toBe(202);
    expect(DB.getQueryCount()).toBeLessThanOrEqual(50);
  });

  it("backfills the snapshot watermark so delayed pre-upgrade snapshots cannot roll state back", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(readFileSync(new URL("../drizzle/0001_telemetry.sql", import.meta.url), "utf8"));
    database.prepare(`INSERT INTO telemetry_runs
      (run_id, player_id, first_session_id, app_version, ruleset_version, language, device_class, active_ms, bankroll)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "player", "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "0.7.1", "all-pool-copies-v1", "en", "desktop", 1_000, 1_000,
    );
    database.exec(readFileSync(new URL("../drizzle/0003_telemetry_v2.sql", import.meta.url), "utf8"));
    expect(database.prepare("SELECT snapshot_active_ms FROM telemetry_runs").get().snapshot_active_ms).toBe(1_000);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_telemetry_rate_bucket'").get())
      .toEqual({ name: "idx_telemetry_rate_bucket" });
  });
});

describe('BeBullish catalog isolation', () => {
  const catalogs = ['classic', 'curated', 'streaks', 'reversals', 'dryspell', 'spectrum', 'rush', 'longgame', 'legacy'];
  const post = (DB, events) => worker.fetch(new Request('https://game.example/api/telemetry', {
    method: 'POST', headers: {'content-type':'application/json',origin:'https://game.example'},
    body: JSON.stringify({installId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',events}),
  }), {DB, TELEMETRY_HASH_KEY:'test-secret'});
  it.each(catalogs)('accepts v1 telemetry for %s and retains new bet economics', async catalog => {
    const DB=sqliteD1();
    const event={...validEvent(),appVersion:'1.0.0',rulesetVersion:`astra-v1:${catalog}`,schemaVersion:2,engagedMs:1000,eventName:'spin_batch',props:{spins:2,deck:[{id:'streak-1',count:1},{id:'step-4',count:1},{id:'long-edge-50',count:1}],spinByCard:{'step-4':2,unknown:5},jackpotSpinGrant:55,catalogId:catalog,trimLevel:3}};
    const response=await post(DB,[event]);expect(response.status).toBe(202);
    const record=await DB.prepare('SELECT props_json FROM telemetry_events WHERE event_id = ?').bind(event.eventId).first();
    const props=JSON.parse(record.props_json);expect(props.deck).toHaveLength(3);expect(props.spinByCard).toEqual({'step-4':2});expect(props.jackpotSpinGrant).toBe(55);expect(props.catalogId).toBe(catalog);
  });
  it('rejects mismatched app/ruleset pairs and mixed catalogs', async()=>{
    const DB=sqliteD1(),base={...validEvent(),schemaVersion:2,engagedMs:1000};
    for(const pair of [['1.0.0','astra-v1:unknown'],['0.7.2','astra-v1:curated'],['1.0.0','all-pool-copies-v1']])expect((await post(DB,[{...base,appVersion:pair[0],rulesetVersion:pair[1]}])).status).toBe(400);
    expect((await post(DB,[{...base,appVersion:'1.0.0',rulesetVersion:'astra-v1:classic'},{...base,eventId:crypto.randomUUID(),appVersion:'1.0.0',rulesetVersion:'astra-v1:curated'}])).status).toBe(400);
  });
  it('accepts bounded Rush grants and drops malformed ones',()=>{
    expect(sanitizeProps({jackpotSpinGrant:55})).toEqual({jackpotSpinGrant:55});
    for(const value of [-1,55.5,9999])expect(sanitizeProps({jackpotSpinGrant:value})).toEqual({});
  });
  it('preserves existing scores when adding the ruleset column',()=>{
    const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_leaderboard.sql',import.meta.url),'utf8'));
    db.prepare('INSERT INTO leaderboard_scores(nickname,mode,time_ms) VALUES(?,?,?)').run('old friend','deck',5000);
    db.exec(readFileSync(new URL('../drizzle/0004_leaderboard_rulesets.sql',import.meta.url),'utf8'));
    expect(db.prepare('SELECT nickname,ruleset_version FROM leaderboard_scores').get()).toEqual({nickname:'old friend',ruleset_version:'legacy-v0'});
  });
  it('keeps old, curated, and legacy-catalog rankings separate',async()=>{
    const DB=sqliteD1();
    const score=async(name,rulesetVersion)=>{
      const response=await worker.fetch(new Request('https://game.example/api/leaderboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({nickname:name,mode:'deck',rulesetVersion,timeMs:20000,spins:10,draws:0,bankruptcies:0})}),{DB});expect(response.status).toBe(201);return response.json();
    };
    await score('old player',undefined);await score('curated player','astra-v1:curated');const result=await score('legacy player','astra-v1:legacy');expect(result.scores.map(s=>s.nickname)).toEqual(['legacy player']);
    for(const [rulesetVersion,name] of [['legacy-v0','old player'],['astra-v1:curated','curated player']]){const response=await worker.fetch(new Request(`https://game.example/api/leaderboard?mode=deck&rulesetVersion=${rulesetVersion}`),{DB});expect((await response.json()).scores.map(s=>s.nickname)).toEqual([name]);}
    expect((await worker.fetch(new Request('https://game.example/api/leaderboard?rulesetVersion=unknown'),{DB})).status).toBe(400);
  });
});

describe('upgrade gacha telemetry', () => {
  it('accepts the new app version and preserves mode, result, and independent draw count', async () => {
    const DB=sqliteD1();
    const event={...validEvent(),appVersion:'1.1.0',rulesetVersion:'astra-v1:classic',schemaVersion:2,engagedMs:1000,eventName:'upgrade_purchase',debug:true,props:{upgradeMode:'gacha',upgradeDraws:3,source:'gacha',kind:'trim',levels:1,price:35}};
    const response=await worker.fetch(new Request('https://game.example/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify({installId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',events:[event]})}),{DB,TELEMETRY_HASH_KEY:'test-secret'});
    expect(response.status).toBe(202);
    const stored=await DB.prepare('SELECT props_json FROM telemetry_events WHERE event_id = ?').bind(event.eventId).first();
    expect(JSON.parse(stored.props_json)).toEqual(event.props);
    expect(sanitizeProps({upgradeMode:'unknown',upgradeDraws:1.5})).toEqual({});
  });
});

describe("v1.2 analytics and ruleset isolation", () => {
  it("persists wait, audio, UI, upgrade and twenty-spin Jackpot data in one bounded batch", async () => {
    const DB = sqliteD1();
    const templates = [
      [
        "wait_enter",
        {
          waitId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          reason: "cash",
          requiredCostStart: 10,
          bankrollStart: 7,
          requested: true,
        },
      ],
      [
        "wait_exit",
        {
          waitId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          reason: "cash",
          resolution: "work",
          durationMs: 1500,
          wallTimeMs: 1600,
          workClicksDuringWait: 3,
          statusEnd: "running",
        },
      ],
      [
        "audio_health_batch",
        {
          requests: 12,
          scheduled: 10,
          resumeFailures: 1,
          interruptedStates: 1,
          contextFailures: 0,
        },
      ],
      [
        "tab_view",
        { tab: "upgrades", name: "upgrades", screen: "game", modal: "none" },
      ],
      [
        "upgrade_purchase",
        {
          kind: "speed",
          levels: 2,
          price: 55,
          source: "direct",
          upgradeMode: "direct",
        },
      ],
      ["jackpot", { phase: "start", remaining: 20, floor: 2, trimApplied: 1 }],
      [
        "snapshot",
        {
          reelStyle: "payoff",
          soundMuted: false,
          haptics: true,
          jackpotSpinGrant: 20,
          runMode: "classic",
          upgradeMode: "direct",
        },
      ],
    ];
    const events = templates.map(([eventName, props], i) => ({
      ...validEvent(),
      eventId: crypto.randomUUID(),
      sequence: i,
      appVersion: "1.2.0",
      rulesetVersion: "astra-v2:classic",
      schemaVersion: 2,
      eventName,
      props,
    }));
    const send = (events) =>
      worker.fetch(
        new Request("https://game.example/api/telemetry", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://game.example",
          },
          body: JSON.stringify({
            installId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            events,
          }),
        }),
        { DB, TELEMETRY_HASH_KEY: "test-secret" },
      );
    expect((await send(events)).status).toBe(202);
    for (const event of events) {
      const row = await DB.prepare(
        "SELECT props_json FROM telemetry_events WHERE event_id = ?",
      )
        .bind(event.eventId)
        .first();
      expect(JSON.parse(row.props_json)).toEqual(event.props);
    }
    expect(
      (
        await send([
          {
            ...events[0],
            eventId: crypto.randomUUID(),
            rulesetVersion: "astra-v1:classic",
          },
        ])
      ).status,
    ).toBe(400);
    const response = await worker.fetch(
      new Request(
        "https://game.example/api/leaderboard?mode=classic&rulesetVersion=astra-v2:classic",
      ),
      { DB },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).scores).toEqual([]);
  });
});

describe('v1.3 inquiry-linked playtests', () => {
  const installId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const context = () => ({installId,runId:validEvent().runId,sessionId:validEvent().sessionId,rulesetVersion:'astra-v2:classic',activeMs:1250,
    snapshot:{bankroll:764,totalSpins:89,totalDraws:0,deck:[{id:'edge-50',count:1}],tab:'positions',soundPack:'wood',soundVolume:.8,lossVolume:.35,soundDensity:'all',shake:'light',impactFlash:'soft',chartAxis:'spins',revealDurationMs:120}});
  const message = () => ({message:'テストの問い合わせ',displayName:'',appVersion:'1.3.0',language:'ja',telemetryEnabled:true,context:context()});
  const send = (env,path,body,method='POST') => worker.fetch(new Request(`https://game.example/api/${path}`,{method,headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify(body)}),env);
  it('accepts optional names without a category and drops disabled or invalid context',()=>{
    expect(parseFeedback(message())).toMatchObject({category:'other',identityMode:'anonymous',displayName:null,bankroll:764,totalSpins:89});
    expect(parseFeedback({...message(),displayName:' Ｎｕｕｎ '})).toMatchObject({identityMode:'named',displayName:'Nuun'});
    for(const payload of [{...message(),telemetryEnabled:false},{...message(),context:{...context(),runId:'bad'}}])
      expect(parseFeedback(payload)).toMatchObject({context:null,bankroll:0,totalSpins:0});
    expect(parseFeedback({...message(),context:{...context(),snapshot:{...context().snapshot,message:'do not copy',email:'private',soundVolume:5}}}).context.snapshot).not.toHaveProperty('email');
    expect(sanitizeProps({soundVolume:5,lossVolume:-1,shake:'unknown',chartAxis:'bad'})).toEqual({});
  });
  it('stores the same player/run/session as telemetry, and deletion removes only the linked data', async()=>{
    const DB=sqliteD1(),env={DB,TELEMETRY_HASH_KEY:'test-secret'};
    const event={...validEvent(),appVersion:'1.3.0',rulesetVersion:'astra-v2:classic',schemaVersion:2,eventName:'snapshot',props:context().snapshot};
    expect((await send(env,'telemetry',{installId,events:[event]})).status).toBe(202);
    expect((await send(env,'feedback',message())).status).toBe(201);
    const row=await DB.prepare('SELECT * FROM feedback_messages').first();
    const run=await DB.prepare('SELECT * FROM telemetry_runs').first();
    expect(row.player_id).toBe(run.player_id);expect(row.player_id).not.toBe(installId);
    expect(row.run_id).toBe(run.run_id);expect(row.session_id).toBe(event.sessionId);
    expect(row.active_ms).toBe(1250);
    expect(JSON.parse(row.snapshot_json)).toEqual(context().snapshot);
    expect(JSON.stringify(row)).not.toContain(installId);
    expect((await send(env,'telemetry',{installId},'DELETE')).status).toBe(200);
    expect(await DB.prepare('SELECT * FROM feedback_messages').first()).toMatchObject({message:message().message,player_id:null,run_id:null,session_id:null,snapshot_json:null,bankroll:0,total_spins:0});
    expect(await DB.prepare('SELECT * FROM telemetry_runs').first()).toBeNull();
  });
  it('preserves old inquiry content and leaves old rows unlinked during migration',()=>{
    const db=new DatabaseSync(':memory:');
    db.exec(readFileSync(new URL('../drizzle/0002_feedback.sql',import.meta.url),'utf8'));
    db.exec("INSERT INTO feedback_messages (feedback_id,category,identity_mode,message,app_version,language) VALUES ('old','other','anonymous','old message','1.2.0','ja')");
    db.exec(readFileSync(new URL('../drizzle/0005_feedback_context.sql',import.meta.url),'utf8'));
    expect(db.prepare('SELECT message,player_id,run_id,snapshot_json FROM feedback_messages').get()).toEqual({message:'old message',player_id:null,run_id:null,snapshot_json:null});
    db.close();
  });
});


describe('v1.4 sound comparison telemetry',()=>{
  it('ingests classic packs and gauge settings under the unchanged economic ruleset',async()=>{
    const DB=sqliteD1();
    const props={soundPack:'retro-arcade',chargeSound:'rise',chargeVolume:.6,payoffStyle:'classic'};
    const event={...validEvent(),appVersion:'1.4.0',rulesetVersion:'astra-v2:classic',schemaVersion:2,eventName:'setting_change',props};
    const response=await worker.fetch(new Request('https://game.example/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify({installId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',events:[event]})}),{DB,TELEMETRY_HASH_KEY:'test-secret'});
    expect(response.status).toBe(202);
    expect(JSON.parse((await DB.prepare('SELECT props_json FROM telemetry_events').first()).props_json)).toEqual(props);
    expect(sanitizeProps({chargeSound:'unknown',chargeVolume:9,payoffStyle:'unknown'})).toEqual({});
  });
});

describe('v1.5 Jackpot tempo telemetry',()=>{
  it('accepts all six pacing experiments while preserving the standard economic ruleset',async()=>{
    const DB=sqliteD1();
    for(const ms of [100,200,300,500,750,1000]) {
      const event={...validEvent(),eventId:crypto.randomUUID(),sequence:ms,appVersion:'1.5.0',rulesetVersion:'astra-v2:classic',schemaVersion:2,eventName:'setting_change',debug:ms!==100,props:{jackpotSpinIntervalMs:ms}};
      const response=await worker.fetch(new Request('https://game.example/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify({installId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',events:[event]})}),{DB,TELEMETRY_HASH_KEY:'test-secret'});
      expect(response.status).toBe(202);
      expect(JSON.parse((await DB.prepare('SELECT props_json FROM telemetry_events WHERE event_id=?').bind(event.eventId).first()).props_json)).toEqual({jackpotSpinIntervalMs:ms});
    }
    expect(sanitizeProps({jackpotSpinIntervalMs:150})).toEqual({});
  });
});

describe('v1.6 music and economic cohorts',()=>{
  it.each(['1.6.0','1.6.1'])('stores presentation settings for %s with the rebalanced ruleset',async(appVersion)=>{
    const DB=sqliteD1();
    const props={music:true,musicPack:'pulse',musicVolume:.18,sweepMotion:'slow'};
    const event={...validEvent(),appVersion,rulesetVersion:'astra-v3:curated',schemaVersion:2,eventName:'setting_change',props};
    const response=await worker.fetch(new Request('https://game.example/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify({installId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',events:[event]})}),{DB,TELEMETRY_HASH_KEY:'test-secret'});
    expect(response.status).toBe(202);
    expect(JSON.parse((await DB.prepare('SELECT props_json FROM telemetry_events').first()).props_json)).toEqual(props);
    expect(sanitizeProps({musicVolume:5,musicPack:'bad',sweepMotion:'bad'})).toEqual({});
  });
  it('keeps new and original leaderboard cohorts separate',async()=>{
    const DB=sqliteD1(), env={DB};
    for(const ruleset of ['astra-v3:curated','astra-v2:classic','astra-v2:legacy']) {
      const response=await worker.fetch(new Request(`https://game.example/api/leaderboard?mode=deck&rulesetVersion=${encodeURIComponent(ruleset)}`),env);
      expect(response.status).toBe(200); expect(await response.json()).toEqual({scores:[]});
    }
    expect((await worker.fetch(new Request('https://game.example/api/leaderboard?mode=deck&rulesetVersion=astra-v3:classic'),env)).status).toBe(400);
  });
});

describe('v1.7 growth cohorts',()=>{
  it.each(['curated','streak80','crashes'])('links new cards, telemetry and inquiry in %s',async(catalog)=>{
    const DB=sqliteD1(), env={DB,TELEMETRY_HASH_KEY:'test-secret'};
    const installId='cccccccc-cccc-4ccc-8ccc-cccccccccccc', rulesetVersion=`astra-v4:${catalog}`;
    const props={catalogId:catalog,deck:[{id:'flow-1',count:1},{id:'risk-1',count:1}],profitByCard:{'flow-1':-14,'risk-1':-400}};
    const event={...validEvent(),appVersion:'1.7.0',rulesetVersion,schemaVersion:2,eventName:'spin_batch',props};
    const send=(path,body)=>worker.fetch(new Request(`https://game.example/api/${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify(body)}),env);
    expect((await send('telemetry',{installId,events:[event]})).status).toBe(202);
    const message={message:'連勝のテスト',displayName:'',appVersion:'1.7.0',language:'ja',telemetryEnabled:true,context:{installId,runId:event.runId,sessionId:event.sessionId,rulesetVersion,activeMs:1250,snapshot:props}};
    expect((await send('feedback',message)).status).toBe(201);
    const run=await DB.prepare('SELECT * FROM telemetry_runs').first(), feedback=await DB.prepare('SELECT * FROM feedback_messages').first();
    expect(feedback.player_id).toBe(run.player_id);expect(feedback.ruleset_version).toBe(rulesetVersion);
    expect(JSON.parse(feedback.snapshot_json)).toEqual(props);
    expect((await worker.fetch(new Request(`https://game.example/api/leaderboard?mode=deck&rulesetVersion=${rulesetVersion}`),env)).status).toBe(200);
    expect((await send('telemetry',{installId,events:[{...event,eventId:crypto.randomUUID(),rulesetVersion:`astra-v3:${catalog}`}]})).status).toBe(400);
  });
});

describe('v1.8 onboarding and capacity cohorts',()=>{
  it.each(['classic','curated','streaks','streak80','crashes','reversals','dryspell','spectrum','rush','longgame','legacy'])('accepts v5 and links inquiry settings in %s',async(catalog)=>{
    const DB=sqliteD1(), env={DB,TELEMETRY_HASH_KEY:'test-secret'};
    const installId='cccccccc-cccc-4ccc-8ccc-cccccccccccc', rulesetVersion=`astra-v5:${catalog}`;
    const props={catalogId:catalog,fuelEnabled:false,assistUsed:true,newsPosition:'bottom',assist:true,assistAfter:50,jackpotSpinIntervalMs:300,music:false};
    const event={...validEvent(),appVersion:'1.8.0',rulesetVersion,schemaVersion:2,eventName:'spin_batch',props};
    const send=(path,body)=>worker.fetch(new Request(`https://game.example/api/${path}`,{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify(body)}),env);
    expect((await send('telemetry',{installId,events:[event]})).status).toBe(202);
    const message={message:'案内について',displayName:'',appVersion:'1.8.0',language:'ja',telemetryEnabled:true,context:{installId,runId:event.runId,sessionId:event.sessionId,rulesetVersion,activeMs:1250,snapshot:props}};
    expect((await send('feedback',message)).status).toBe(201);
    const run=await DB.prepare('SELECT * FROM telemetry_runs').first(), feedback=await DB.prepare('SELECT * FROM feedback_messages').first();
    expect(feedback.player_id).toBe(run.player_id);
    expect(feedback.ruleset_version).toBe(rulesetVersion);
    expect(JSON.parse(feedback.snapshot_json)).toEqual(props);
    expect((await worker.fetch(new Request(`https://game.example/api/leaderboard?mode=${catalog==='classic'?'classic':'deck'}&rulesetVersion=${rulesetVersion}`),env)).status).toBe(200);
    expect((await send('telemetry',{installId,events:[{...event,eventId:crypto.randomUUID(),rulesetVersion:`astra-v4:${catalog}`}]})).status).toBe(400);
  });
  it('rejects invalid new settings but retains false values',()=>{
    expect(sanitizeProps({fuelEnabled:'false',assistUsed:1,newsPosition:'middle'})).toEqual({});
    expect(sanitizeProps({fuelEnabled:false,assistUsed:false,newsPosition:'top'})).toEqual({fuelEnabled:false,assistUsed:false,newsPosition:'top'});
  });
  it.each([['/sw.js','application/javascript'],['/manifest.webmanifest','application/manifest+json']])('serves revalidated install resources at %s',async(path,type)=>{
    const response=await worker.fetch(new Request('https://game.example'+path),{ASSETS:{fetch:async()=>new Response('content',{headers:{'content-type':'text/plain','cache-control':'max-age=999'}})}});
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('content-type')).toContain(type);
  });
});

describe('v1.9 continuity',()=>{
  it('accepts the same economy with transfer entry and bounded chart preferences',async()=>{
    const DB=sqliteD1(), env={DB,TELEMETRY_HASH_KEY:'test-secret'};
    const installId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const event={...validEvent(),appVersion:'1.9.0',rulesetVersion:'astra-v5:classic',schemaVersion:2,eventName:'session_start',props:{entryKind:'transfer',chartWindowSpins:100,chargeSound:'off'}};
    const response=await worker.fetch(new Request('https://game.example/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify({installId,events:[event]})}),env);
    expect(response.status).toBe(202);
    expect(parseEvent(event).props).toEqual(event.props);
    expect(sanitizeProps({chartWindowSpins:0})).toEqual({});
    expect(sanitizeProps({chartWindowSpins:1001})).toEqual({});
  });
});

describe('v1.10 sensory settings',()=>{
  it('accepts the revised economy and new sound/motion preferences',async()=>{
    const DB=sqliteD1(), env={DB,TELEMETRY_HASH_KEY:'test-secret'};
    const installId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const event={...validEvent(),appVersion:'1.10.0',rulesetVersion:'astra-v6:classic',schemaVersion:2,eventName:'session_start',props:{entryKind:'transfer',spinSound:'rhythm',sweepMotion:'focus',revealDurationMs:700,chargeSound:'off',lossVolume:.9}};
    const response=await worker.fetch(new Request('https://game.example/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://game.example'},body:JSON.stringify({installId,events:[event]})}),env);
    expect(response.status).toBe(202);
    expect(parseEvent(event).props).toEqual(event.props);
    for(const sweepMotion of ['focus','recoil','lock','mix'])expect(sanitizeProps({sweepMotion})).toEqual({sweepMotion});
    expect(sanitizeProps({spinSound:'invalid',sweepMotion:'invalid'})).toEqual({});
  });
});

describe('shared clear rankings', () => {
  const score = () => ({ completionId: crypto.randomUUID(), nickname: 'テスト', appVersion: '1.10.0', rulesetVersion: 'astra-v6:classic', catalog: 'classic', timeMs: 18000000, spins: 3000, ranked: true });
  const post = (DB, body, origin = 'https://bebullish-v1-11-0.realnuun.chatgpt.site') => worker.fetch(new Request('https://game.example/api/rankings', {method:'POST', headers:{'content-type':'application/json',origin}, body:JSON.stringify(body)}), {DB});
  const get = (DB, query = '') => worker.fetch(new Request('https://game.example/api/rankings' + query), {DB});
  it('starts empty, keeps per-version scores, and deduplicates a transferred clear', async () => {
    const DB = sqliteD1(), first = score();
    expect((await post(DB, first)).status).toBe(201);
    const duplicate = await post(DB, {...first, nickname:'別の名前',timeMs:1000});
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({duplicate:true,nickname:'テスト'});
    expect((await post(DB, {...score(),appVersion:'1.9.0',rulesetVersion:'astra-v5:classic',timeMs:9000000})).status).toBe(201);
    const all = await (await get(DB)).json();
    expect(all.total).toBe(2);
    expect(all.scores.map(s=>s.appVersion)).toEqual(['1.9.0','1.10.0']);
    expect(all.scores.every(s=>!('completionId' in s))).toBe(true);
    expect((await (await get(DB)).json()).total).toBe(2);
    const version = await (await get(DB,'?version=1.10.0')).json();
    expect(version.total).toBe(1);
    expect(version.scores[0].timeMs).toBe(first.timeMs);
    const empty = await (await get(DB,'?version=1.12.0')).json();
    expect(empty.total).toBe(0);
  });
  it('validates records and allows the shared service only from supported origins',async()=>{
    const DB = sqliteD1();
    for(const patch of [{ranked:false},{timeMs:0},{timeMs:1209600001},{nickname:' '},{rulesetVersion:42},{appVersion:'1.10.0',rulesetVersion:'astra-v5:classic'}]) expect((await post(DB,{...score(),...patch})).status).toBe(400);
    expect((await post(DB,score(),'https://unrelated.example')).status).toBe(403);
    const r=await post(DB,score());
    expect(r.headers.get('access-control-allow-origin')).toBe('https://bebullish-v1-11-0.realnuun.chatgpt.site');
    expect((await get(DB,'?offset=-1')).status).toBe(400);
  });
  it('paginates every score with a stable time/id ordering',async()=>{
    const DB=sqliteD1();
    for(let i=0;i<52;i++) await post(DB,{...score(),nickname:'player'+i,timeMs:10000+i});
    const first=await(await get(DB,'?version=1.10.0')).json(),second=await(await get(DB,'?version=1.10.0&offset=50')).json();
    expect(first.scores).toHaveLength(50); expect(second.scores).toHaveLength(2);
    expect(first.total).toBe(52);expect(second.scores[0].nickname).toBe('player50');
  });
});

describe('six-character cloud saves',()=>{
  const snapshot=()=>JSON.stringify({version:1,id:crypto.randomUUID(),catalog:'classic',cash:12345,spins:50,settings:{},history:[],rushLeft:17});
  const environment=()=>({DB:sqliteD1(),SAVE_CODE_SECRET:'test-save-secret'});
  const post=(env, body, path='',origin='https://bebullish-v1-11-0.realnuun.chatgpt.site')=>worker.fetch(new Request('https://game.example/api/save-codes'+path,{method:'POST',headers:{'content-type':'application/json',origin,'cf-connecting-ip':'192.0.2.1'},body:JSON.stringify(body)}),env);
  it('creates immutable six-character snapshots and restores them across release origins',async()=>{
    const env=environment(),save=snapshot();
    const create=await post(env,{save,appVersion:'1.10.0'}), issued=await create.json();
    expect(create.status).toBe(201);expect(issued.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const next=await(await post(env,{save:snapshot(),appVersion:'1.10.0'})).json();
    expect(next.code).not.toBe(issued.code);
    const restored=await post(env,{code:issued.code.toLowerCase().slice(0,3)+'-'+issued.code.slice(3)},'/restore');
    expect(restored.status).toBe(200);
    expect(restored.headers.get('access-control-allow-origin')).toBe('https://bebullish-v1-11-0.realnuun.chatgpt.site');
    expect(await restored.json()).toMatchObject({save,appVersion:'1.10.0',createdAt:issued.createdAt});
    const stored=await env.DB.prepare('SELECT * FROM save_codes').all();
    expect(stored.results).toHaveLength(2);
    expect(stored.results[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(issued.code);
  });
  it('rejects malformed saves/codes, missing configuration and unsupported origins without replacing existing data',async()=>{
    const env=environment();
    expect((await post(env,{save:'{}',appVersion:'1.10.0'})).status).toBe(400);
    expect((await post(env,{save:snapshot(),appVersion:'wrong'})).status).toBe(400);
    expect((await post(env,{save:'x'.repeat(2100001),appVersion:'1.10.0'})).status).toBe(400);
    expect((await post(env,{code:'OOO111'},'/restore')).status).toBe(400);
    expect((await post(env,{code:'ABC234'},'/restore')).status).toBe(404);
    expect((await post(env,{save:snapshot(),appVersion:'1.10.0'},'','https://unrelated.example')).status).toBe(403);
    expect((await post({DB:env.DB},{code:'ABC234'},'/restore')).status).toBe(503);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM save_codes').first()).n).toBe(0);
  });
  it('limits repeated guessing and creation independently, keeping only anonymous rate keys',async()=>{
    const env=environment();
    for(let i=0;i<60;i++) expect((await post(env,{code:'ABC234'},'/restore')).status).toBe(404);
    expect((await post(env,{code:'ABC234'},'/restore')).status).toBe(429);
    expect((await post(env,{save:snapshot(),appVersion:'1.10.0'})).status).toBe(201);
    const rates=await env.DB.prepare('SELECT * FROM save_code_rate_limits').all();
    expect(rates.results).toHaveLength(2);
    expect(JSON.stringify(rates)).not.toContain('192.0.2.1');
  });
});

it('never overwrites a save when code generation collides',async()=>{
  const env={DB:sqliteD1(),SAVE_CODE_SECRET:'test-save-secret'};
  const create=save=>worker.fetch(new Request('https://game.example/api/save-codes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({appVersion:'1.10.0',save:JSON.stringify({version:1,id:'test',catalog:'classic',cash:save,spins:1,settings:{},history:[]})})}),env);
  const mock=vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{array.fill(0);return array;});
  try {
    expect((await create(10)).status).toBe(201);
    expect((await create(20)).status).toBe(503);
    const rows=await env.DB.prepare('SELECT snapshot_json FROM save_codes').all();
    expect(rows.results).toHaveLength(1);
    expect(JSON.parse(rows.results[0].snapshot_json).cash).toBe(10);
  } finally {mock.mockRestore();}
});

it('accepts the v1.11 display-only release on the existing shared ranking service', async () => {
  const DB=sqliteD1();
  const record={completionId:crypto.randomUUID(),nickname:'compatibility',appVersion:'1.11.0',rulesetVersion:'astra-v6:classic',catalog:'classic',timeMs:18000000,spins:3000,ranked:true};
  const response=await worker.fetch(new Request('https://game.example/api/rankings',{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish-v1-11-0.realnuun.chatgpt.site'},body:JSON.stringify(record)}),{DB});
  expect(response.status).toBe(201);
  const page=await worker.fetch(new Request('https://game.example/api/rankings?version=1.11.0'),{DB});
  expect(await page.json()).toMatchObject({total:1,scores:[{appVersion:'1.11.0',timeMs:18000000}]});
});


it('accepts v2.0 without changing the economy cohort or shared ranking storage', async () => {
  const DB=sqliteD1();
  const record={completionId:crypto.randomUUID(),nickname:'version-two',appVersion:'2.0.0',rulesetVersion:'astra-v6:classic',catalog:'classic',timeMs:18000000,spins:3000,ranked:true};
  const response=await worker.fetch(new Request('https://game.example/api/rankings',{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish-v2-0.realnuun.chatgpt.site'},body:JSON.stringify(record)}),{DB});
  expect(response.status).toBe(201);
  const page=await worker.fetch(new Request('https://game.example/api/rankings?version=2.0.0'),{DB});
  expect(await page.json()).toMatchObject({total:1,scores:[{appVersion:'2.0.0',rulesetVersion:'astra-v6:classic'}]});
});


describe('v2.1 shared compatibility',()=>{
  it('keeps new settings in telemetry and feedback, including OFF values',()=>{
    const props={bassMode:false,jackpotAutoTab:false,jackpotMusic:'on',economyProfile:'v21'};
    expect(sanitizeProps(props)).toEqual(props);
    expect(sanitizeProps({bassMode:1,jackpotAutoTab:'on',jackpotMusic:'bad',economyProfile:'bad'})).toEqual({});
    const event={...validEvent(),appVersion:'2.1.0',rulesetVersion:'astra-v7:classic',schemaVersion:2,eventName:'session_start',props};
    expect(parseEvent(event).props).toEqual(props);
    expect(parseFeedback({message:'音と成長について',displayName:'',appVersion:'2.1.0',language:'ja',telemetryEnabled:true,context:{installId:crypto.randomUUID(),runId:event.runId,sessionId:event.sessionId,rulesetVersion:event.rulesetVersion,activeMs:1250,snapshot:props}}).context.snapshot).toEqual(props);
  });
  it('accepts v2.1 clears, retains the older cohort and restores old codes from the new origin',async()=>{
    const env={DB:sqliteD1(),SAVE_CODE_SECRET:'unchanged-test-key'};
    const post=(path,body)=>worker.fetch(new Request('https://game.example'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish-v2-1.realnuun.chatgpt.site'},body:JSON.stringify(body)}),env);
    const score={completionId:crypto.randomUUID(),nickname:'local-test',appVersion:'2.1.0',rulesetVersion:'astra-v7:classic',catalog:'classic',timeMs:3600000,spins:1500,ranked:true};
    expect((await post('/api/rankings',score)).status).toBe(201);
    expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),appVersion:'2.0.0',rulesetVersion:'astra-v6:classic'})).status).toBe(201);
    expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),rulesetVersion:'astra-v6:classic'})).status).toBe(400);
    const page=await worker.fetch(new Request('https://game.example/api/rankings?version=2.1.0'),env);
    expect(await page.json()).toMatchObject({total:1,scores:[{appVersion:'2.1.0',rulesetVersion:'astra-v7:classic'}]});
    const save=JSON.stringify({version:1,id:crypto.randomUUID(),catalog:'classic',cash:1234,spins:50,settings:{},history:[]});
    const issued=await(await post('/api/save-codes',{appVersion:'2.0.0',save})).json();
    expect(issued.code).toHaveLength(6);
    const restored=await post('/api/save-codes/restore',{code:issued.code});
    expect(restored.headers.get('access-control-allow-origin')).toBe('https://bebullish-v2-1.realnuun.chatgpt.site');
    expect(await restored.json()).toMatchObject({save,appVersion:'2.0.0'});
  });
});

describe('v2.2 shared compatibility',()=>{
  it('keeps new settings in telemetry and feedback, including OFF values',()=>{
    const props={bassMode:false,jackpotAutoTab:false,jackpotMusic:'on',economyProfile:'v22',revealDurationMs:5000,revealPacing:'ratio',revealRatio:.8};
    expect(sanitizeProps({revealRatio:3})).toEqual({});
    expect(sanitizeProps({revealRatio:'0.8'})).toEqual({});
    expect(sanitizeProps(props)).toEqual(props);
    expect(sanitizeProps({bassMode:1,jackpotAutoTab:'on',jackpotMusic:'bad',economyProfile:'bad'})).toEqual({});
    const event={...validEvent(),appVersion:'2.2.0',rulesetVersion:'astra-v8:classic',schemaVersion:2,eventName:'session_start',props};
    expect(parseEvent(event).props).toEqual(props);
    expect(parseFeedback({message:'音と成長について',displayName:'',appVersion:'2.2.0',language:'ja',telemetryEnabled:true,context:{installId:crypto.randomUUID(),runId:event.runId,sessionId:event.sessionId,rulesetVersion:event.rulesetVersion,activeMs:1250,snapshot:props}}).context.snapshot).toEqual(props);
  });
  it('accepts v2.2 clears, retains the older cohort and restores old codes from the new origin',async()=>{
    const env={DB:sqliteD1(),SAVE_CODE_SECRET:'unchanged-test-key'};
    const post=(path,body)=>worker.fetch(new Request('https://game.example'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish-v2-2.realnuun.chatgpt.site'},body:JSON.stringify(body)}),env);
    const score={completionId:crypto.randomUUID(),nickname:'local-test',appVersion:'2.2.0',rulesetVersion:'astra-v8:classic',catalog:'classic',timeMs:3600000,spins:1500,ranked:true};
    expect((await post('/api/rankings',score)).status).toBe(201);
    expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),appVersion:'2.0.0',rulesetVersion:'astra-v6:classic'})).status).toBe(201);
    expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),rulesetVersion:'astra-v6:classic'})).status).toBe(400);
    const page=await worker.fetch(new Request('https://game.example/api/rankings?version=2.2.0'),env);
    expect(await page.json()).toMatchObject({total:1,scores:[{appVersion:'2.2.0',rulesetVersion:'astra-v8:classic'}]});
    const save=JSON.stringify({version:1,id:crypto.randomUUID(),catalog:'classic',cash:1234,spins:50,settings:{},history:[]});
    const issued=await(await post('/api/save-codes',{appVersion:'2.0.0',save})).json();
    expect(issued.code).toHaveLength(6);
    const restored=await post('/api/save-codes/restore',{code:issued.code});
    expect(restored.headers.get('access-control-allow-origin')).toBe('https://bebullish-v2-2.realnuun.chatgpt.site');
    expect(await restored.json()).toMatchObject({save,appVersion:'2.0.0'});
  });
});

describe('v2.3 release telemetry and compatibility',()=>{
 it('retains experiment and blocked-action context without a nickname',()=>{
  const props={sharedSpin:true,wealthTheme:'drawdown',adaptiveMusic:false,workMode:'gamble',workCosmetics:true,upgradeTutorial:'scripted',workFxLevel:2,pwaInstalled:false,browserFamily:'ios-chrome',payoffStyle:'net',cardId:'sequence-boost-1',action:'equip',reason:'positions-full',slotCount:1};
  expect(sanitizeProps({...props,completionNickname:'private'})).toEqual(props);
  for(const eventName of ['blocked_action','guidance_shown','guidance_resolved','pwa_gate']) expect(parseEvent({...validEvent(),appVersion:'2.3.0',rulesetVersion:'astra-v9:all-test',eventName,props})).not.toBeNull();
 });
 it('accepts the new ranked cohort, retains older scores, and preserves old save codes',async()=>{
  const env={DB:sqliteD1(),SAVE_CODE_SECRET:'unchanged-test-key'};
  const post=(path,body)=>worker.fetch(new Request('https://game.example'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish-v2-3.realnuun.chatgpt.site'},body:JSON.stringify(body)}),env);
  const score={completionId:crypto.randomUUID(),nickname:'local-only',appVersion:'2.3.0',rulesetVersion:'astra-v9:classic',catalog:'classic',timeMs:3600000,spins:1800,ranked:true};
  expect((await post('/api/rankings',score)).status).toBe(201);
  expect((await post('/api/rankings',score)).status).toBe(200);
  expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),appVersion:'2.2.0',rulesetVersion:'astra-v8:classic'})).status).toBe(201);
  const save=JSON.stringify({version:1,id:crypto.randomUUID(),catalog:'classic',cash:1234,spins:50,settings:{},history:[]});
  const issued=await(await post('/api/save-codes',{appVersion:'2.2.0',save})).json();
  expect(await(await post('/api/save-codes/restore',{code:issued.code})).json()).toMatchObject({save,appVersion:'2.2.0'});
 });
});


describe('production custom origin', () => {
 it('allows the exact production origin for shared rankings and save codes', async () => {
  for (const path of ['/api/rankings','/api/save-codes','/api/save-codes/restore']) {
   const response=await worker.fetch(new Request('https://service.example'+path,{method:'OPTIONS',headers:{origin:'https://bebullish.fun'}}),{});
   expect(response.status).toBe(204);
   expect(response.headers.get('access-control-allow-origin')).toBe('https://bebullish.fun');
   for (const origin of ['http://bebullish.fun','https://other.bebullish.fun','https://bebullish.fun.example']) {
    expect((await worker.fetch(new Request('https://service.example'+path,{method:'OPTIONS',headers:{origin}}),{})).status).toBe(403);
   }
  }
 });
 it('shares existing codes and completion records with production', async () => {
  const env={DB:sqliteD1(),SAVE_CODE_SECRET:'same-local-test-key'};
  const post=(path,body,origin='https://bebullish.fun')=>worker.fetch(new Request('https://service.example'+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}),env);
  const save=JSON.stringify({version:1,id:crypto.randomUUID(),catalog:'classic',cash:1234,spins:50,settings:{},history:[]});
  const issued=await(await post('/api/save-codes',{appVersion:'2.3.0',save},'https://bebullish-v2-3.realnuun.chatgpt.site')).json();
  const restored=await post('/api/save-codes/restore',{code:issued.code});
  expect(restored.headers.get('access-control-allow-origin')).toBe('https://bebullish.fun');
  expect(await restored.json()).toMatchObject({save});
  const score={completionId:crypto.randomUUID(),nickname:'local-only',appVersion:'2.3.0',rulesetVersion:'astra-v9:classic',catalog:'classic',timeMs:3600000,spins:1800,ranked:true};
  expect((await post('/api/rankings',score)).status).toBe(201);
  const page=await worker.fetch(new Request('https://service.example/api/rankings?version=2.3.0',{headers:{origin:'https://bebullish.fun'}}),env);
  expect(page.status).toBe(200);
  expect(page.headers.get('access-control-allow-origin')).toBe('https://bebullish.fun');
  expect((await page.json()).scores).toHaveLength(1);
 });
});

describe('v2.4 production compatibility',()=>{
 it('accepts new completion and telemetry cohorts while rejecting mismatched economy revisions',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret',SAVE_CODE_SECRET:'unchanged-test-key'};
  const post=(path,body)=>worker.fetch(new Request('https://bebullish.fun'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish.fun'},body:JSON.stringify(body)}),env);
  const score={completionId:crypto.randomUUID(),nickname:'local-only',appVersion:'2.4.0',rulesetVersion:'astra-v10:classic',catalog:'classic',timeMs:3600000,spins:1800,ranked:true};
  expect((await post('/api/rankings',score)).status).toBe(201);
  expect((await post('/api/rankings',score)).status).toBe(200);
  expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),rulesetVersion:'astra-v9:classic'})).status).toBe(400);
  expect((await post('/api/rankings',{...score,completionId:crypto.randomUUID(),appVersion:'2.3.0',rulesetVersion:'astra-v9:classic'})).status).toBe(201);
  const props={economyProfile:'v24',jackpotRule:'double-high',showJackpotCounter:true,spinsSinceJackpot:42,jackpotHigh:true};
  expect(sanitizeProps(props)).toEqual(props);
  const event={...validEvent(),eventId:crypto.randomUUID(),eventName:'session_start',appVersion:'2.4.0',rulesetVersion:'astra-v10:classic',schemaVersion:2,props};
  expect((await post('/api/telemetry',{installId:crypto.randomUUID(),consent:true,events:[event]})).status).toBe(202);
 });
});

describe('v2.5 ratings and coin telemetry',()=>{
 const installId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const context=()=>({installId,runId:validEvent().runId,sessionId:validEvent().sessionId,rulesetVersion:'astra-v11:classic',activeMs:4000,snapshot:{bankroll:1234,coinRounds:5,coinWins:3,coinWagered:50,coinPaid:60,coinEnabled:true,soundPack:'arcade-punch',winVisual:'cash',chartBackdrop:'flow'}});
 const rating=()=>({ratingId:crypto.randomUUID(),stars:4,source:'clear',appVersion:'2.5.0',language:'ja',telemetryEnabled:true,context:context()});
 const send=(env,path,body,method='POST',origin='https://game.example')=>worker.fetch(new Request(`https://game.example/api/${path}`,{method,headers:{origin,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})}),env);
 it('links feedback ratings to messages and play context, then anonymizes context on deletion',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret'};
  const feedback=await send(env,'feedback',{message:'とても楽しかった',appVersion:'2.5.0',language:'ja',telemetryEnabled:true,context:context()});
  expect(feedback.status).toBe(201);const {id}=await feedback.json();
  const input={...rating(),source:'feedback',feedbackId:id};expect((await send(env,'ratings',input)).status).toBe(201);
  const row=await env.DB.prepare('SELECT * FROM game_ratings').first();
  expect(row).toMatchObject({stars:4,source:'feedback',feedback_id:id,run_id:context().runId});expect(JSON.parse(row.snapshot_json)).toEqual(context().snapshot);
  expect(row.player_id).not.toBe(installId);
  expect((await send(env,'telemetry',{installId},'DELETE')).status).toBe(200);
  expect(await env.DB.prepare('SELECT * FROM game_ratings').first()).toMatchObject({stars:4,feedback_id:id,player_id:null,run_id:null,snapshot_json:null});
 });
 it('retries one immutable rating without duplicates and allows explicit ratings with telemetry off',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret'},input={...rating(),telemetryEnabled:false};
  expect((await send(env,'ratings',input)).status).toBe(201);expect((await send(env,'ratings',input)).status).toBe(200);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_ratings').first()).toEqual({count:1});
  expect(await env.DB.prepare('SELECT player_id,snapshot_json FROM game_ratings').first()).toEqual({player_id:null,snapshot_json:null});
 });
 it('rejects invalid stars, sources, unknown messages and cross-origin writes without storing records',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret'};
  for(const stars of [0,6,1.5,'5',null])expect((await send(env,'ratings',{...rating(),stars})).status).toBe(400);
  expect((await send(env,'ratings',{...rating(),source:'other'})).status).toBe(400);
  expect((await send(env,'ratings',{...rating(),source:'feedback',feedbackId:crypto.randomUUID()})).status).toBe(400);
  expect((await send(env,'ratings',rating(),'POST','https://other.example')).status).toBe(403);
  expect((await send(env,'ratings',{},'GET')).status).toBe(405);
  expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_ratings').first()).toEqual({count:0});
 });
 it('bounds new submissions but accepts a retry after the limit',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret'},first=rating();
  expect((await send(env,'ratings',first)).status).toBe(201);
  for(let i=0;i<4;i++)expect((await send(env,'ratings',rating())).status).toBe(201);
  expect((await send(env,'ratings',rating())).status).toBe(429);
  expect((await send(env,'ratings',first)).status).toBe(200);
 });
 it('stores new coin and visual settings while retaining v2.4 telemetry compatibility',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret'};
  for(const [appVersion,rulesetVersion] of [['2.5.0','astra-v11:classic'],['2.4.0','astra-v10:classic']]){
   const event={...validEvent(),sessionId:crypto.randomUUID(),runId:crypto.randomUUID(),eventId:crypto.randomUUID(),appVersion,rulesetVersion,eventName:'coin_batch',props:{...context().snapshot,rounds:5,wins:3,wager:50,payout:60}};
   expect((await send(env,'telemetry',{installId,events:[event]})).status).toBe(202);
   const row=await env.DB.prepare('SELECT props_json FROM telemetry_events WHERE event_id=?').bind(event.eventId).first();expect(JSON.parse(row.props_json)).toEqual(event.props);
  }
 });
});

it('accepts v2.7 refill Jackpot cohorts and presentation fields, preserving v2.6 and v2.5',async()=>{
 const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'test-secret'},url='https://bebullish.fun/api/rankings';
 for(const [appVersion,rulesetVersion] of [['2.7.0','astra-v13:classic'],['2.6.0','astra-v12:classic'],['2.5.0','astra-v11:classic']]){
  const response=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'https://bebullish.fun','content-type':'application/json'},body:JSON.stringify({nickname:'TEST',completionId:crypto.randomUUID(),appVersion,rulesetVersion,catalog:'classic',timeMs:100000,spins:100,ranked:true})}),env);
  expect(response.status).toBe(201);
 }
 const props={trimLevel:0,rushLevel:0,jackpotRule:'combined',winVisual:'festival',jackpotVisual:'festival',chartBackdrop:'pulse',handToys:true,dockToy:'beat',bestPayout:1000,winStreak:4};
 expect(sanitizeProps(props)).toEqual(props);
 const event={...validEvent(),eventId:crypto.randomUUID(),eventName:'session_start',appVersion:'2.7.0',rulesetVersion:'astra-v13:classic',schemaVersion:2,props};
 const post=body=>worker.fetch(new Request('https://bebullish.fun/api/telemetry',{method:'POST',headers:{'content-type':'application/json',origin:'https://bebullish.fun'},body:JSON.stringify(body)}),env);
 expect((await post({installId:crypto.randomUUID(),consent:true,events:[event]})).status).toBe(202);
 const invalid=await worker.fetch(new Request(url,{method:'POST',headers:{origin:'https://bebullish.fun','content-type':'application/json'},body:JSON.stringify({nickname:'TEST',completionId:crypto.randomUUID(),appVersion:'2.6.0',rulesetVersion:'astra-v11:classic',catalog:'classic',timeMs:100000,spins:100,ranked:true})}),env);
 expect(invalid.status).toBe(400);
});

// Local SQLite only: production records are never written by these checks.
describe('dontwork migration compatibility',()=>{
 const post=(env,path,body,origin='https://dontwork.fun')=>worker.fetch(new Request('https://service.example/api/'+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}),env);
 it('accepts the exact new origin and rejects lookalikes',async()=>{
  for(const path of ['rankings','bankroll-rankings','save-codes','save-codes/restore']){
   const r=await worker.fetch(new Request('https://service.example/api/'+path,{method:'OPTIONS',headers:{origin:'https://dontwork.fun'}}),{});
   expect(r.status).toBe(204);expect(r.headers.get('access-control-allow-origin')).toBe('https://dontwork.fun');
   for(const origin of ['http://dontwork.fun','https://dontwork.fun.example','https://other.dontwork.fun'])expect((await worker.fetch(new Request('https://service.example/api/'+path,{method:'OPTIONS',headers:{origin}}),{})).status).toBe(403);
  }
 });
 it('restores old six-character codes and bundles from the same database',async()=>{
  const env={DB:sqliteD1(),SAVE_CODE_SECRET:'unchanged'},save=JSON.stringify({version:1,id:crypto.randomUUID(),catalog:'classic',cash:1234,spins:50,settings:{},history:[]});
  const issued=await(await post(env,'save-codes',{appVersion:'2.8.0',save},'https://bebullish.fun')).json();
  expect(await(await post(env,'save-codes/restore',{code:issued.code})).json()).toMatchObject({save,appVersion:'2.8.0'});
  const bundle={kind:'dontwork-origin-migration-v1',version:1,createdAt:1000,entries:{'bebullish-save-v1':save,'bebullish-normal-slot-v1':save,'bebullish-30m-slot-v1':save,'bebullish-ranking-outbox-v1':'[]','bebullish-30m-outbox-v1':'[]'}};
  const response=await post(env,'save-codes',{appVersion:'2.9.0',save:JSON.stringify(bundle)},'https://bebullish.fun');expect(response.status).toBe(201);
  const code=(await response.json()).code;expect((await(await post(env,'save-codes/restore',{code})).json()).save).toBe(JSON.stringify(bundle));
  for(const extra of [{secret:'x'},{'bebullish-save-v1':'{}'},{'bebullish-30m-outbox-v1':'{}'},{'bebullish-save-v1':JSON.stringify(bundle)}])expect((await post(env,'save-codes',{appVersion:'2.9.0',save:JSON.stringify({...bundle,entries:{...bundle.entries,...extra}})})).status).toBe(400);
 });
 it('accepts 2.9 rankings and telemetry while preserving 2.8 record identity',async()=>{
  const env={DB:sqliteD1(),TELEMETRY_HASH_KEY:'unchanged'};
  for(const appVersion of ['2.8.0','2.9.0']){
   const score={completionId:crypto.randomUUID(),nickname:'local-test',appVersion,rulesetVersion:'astra-v13:classic',catalog:'classic',timeMs:3600000,spins:1000,ranked:true};
   expect((await post(env,'rankings',score)).status).toBe(201);expect((await post(env,'rankings',score)).status).toBe(200);
   const event={...validEvent(),eventId:crypto.randomUUID(),appVersion,rulesetVersion:'astra-v13:classic',eventName:'session_start',schemaVersion:2,props:{}};
   const r=await worker.fetch(new Request('https://dontwork.fun/api/telemetry',{method:'POST',headers:{origin:'https://dontwork.fun','content-type':'application/json'},body:JSON.stringify({installId:crypto.randomUUID(),consent:true,events:[event]})}),env);expect(r.status).toBe(202);
  }
 });
});
