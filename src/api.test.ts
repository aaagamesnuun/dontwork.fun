import { initializeSoundExperiment, SOUND_EXPERIMENT_KEY } from "./soundExperiment";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Telemetry, apiMoney, localTelemetryHost } from "./api";
import {
  TARGET,
  playCoinFlip,
  configure,
  freshRun,
  readSave,
  spin,
  work,
  purchase,
  setCount,
} from "./game/engine";

describe("client telemetry and Lab persistence", () => {
  let bodies: {
    events: {
      eventName: string;
      runId: string;
      rulesetVersion: string;
      props: Record<string, number>;
    }[];
  }[];
  beforeEach(() => {
    const storage = new Map<string, string>();
    bodies = [];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    });
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("location", { hostname: "game.example" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it("measures each BGM and silence separately and stops collecting after opt-out", async()=>{
    const client=new Telemetry(),run={...freshRun(),startedAt:1,activeMs:1000};
    client.observe(run);await client.flush();
    client.musicPlayed(run,"pulse",true,true,false,200);
    client.musicPlayed(run,"pulse",true,true,false,300);
    client.musicPlayed(run,"night",true,true,false,400);
    client.musicPlayed(run,"arcade",false,false,false,500);
    client.musicPlayed(run,"arcade",false,true,false,100);
    client.checkpoint(run);await client.flush();
    await vi.waitFor(()=>expect(bodies.flatMap(b=>b.events).filter(e=>e.eventName==="music_play_batch")).toHaveLength(4));
    const batches=bodies.flatMap(b=>b.events).filter(e=>e.eventName==="music_play_batch");
    expect(batches.map(e=>e.props)).toEqual(expect.arrayContaining([
      expect.objectContaining({musicPack:"pulse",music:true,requested:true,durationMs:500,source:"foreground"}),
      expect.objectContaining({musicPack:"night",music:true,durationMs:400}),
      expect.objectContaining({musicPack:"arcade",music:false,requested:false,durationMs:500}),
      expect.objectContaining({musicPack:"arcade",music:false,requested:true,durationMs:100}),
    ]));
    const disabled={...run,telemetry:false};client.changed(run,disabled);
    client.musicPlayed(disabled,"pulse",true,true,false,500);client.musicPlayed(run,"pulse",true,true,false,NaN);
    client.checkpoint(disabled);await client.flush();
    expect(bodies.flatMap(b=>b.events).filter(e=>e.eventName==="music_play_batch")).toHaveLength(4);
  });
  it("keeps foreground and background batches separate without overflowing on Jackpot chains",async()=>{
    const client=new Telemetry();let s={...freshRun(),cash:1e6,peak:1e6,portfolio:[{id:"edge-50",count:1}]};client.observe(s);
    const first=spin(s,75);client.settled(s,first);s=configure(first,{backgroundPlay:true});
    for(let i=0;i<500;i++){
      const timed={...s,activeMs:s.activeMs+300,backgroundMs:s.backgroundMs+300};
      const next=spin(timed,100,0);client.settled(timed,next,true);s=next;
    }
    client.checkpoint(s);await client.flush();
    await vi.waitFor(()=>expect(bodies.flatMap(b=>b.events).filter(e=>e.eventName==="snapshot").at(-1)?.props.backgroundMs).toBe(150000));
    const all=bodies.flatMap(b=>b.events),batches=all.filter(e=>e.eventName==="spin_batch");
    const foreground=batches.filter(e=>(e.props as any).source==="foreground"),background=batches.filter(e=>(e.props as any).source==="background");
    expect(foreground.reduce((n,e)=>n+e.props.spins,0)).toBe(1);
    expect(background.reduce((n,e)=>n+e.props.spins,0)).toBe(500);
    expect(background.reduce((n,e)=>n+e.props.jackpots,0)).toBe(500);
    expect(background.every(e=>e.props.engagedDurationMs===0)).toBe(true);
    expect(all.filter(e=>e.eventName==="jackpot")).toHaveLength(0);
    const last=all.filter(e=>e.eventName==="snapshot").at(-1) as any;
    expect(last.engagedMs).toBe(5000);expect(last.props.backgroundMs).toBe(150000);
  });
  it("records a position-ended Jackpot without counting another spin",async()=>{
    const client=new Telemetry(),before={...freshRun(),cash:1000,portfolio:[{id:"edge-50",count:1}],rushLeft:20,removed:14};
    client.observe(before);const after=setCount(before,"edge-50",-1);client.changed(before,after);
    await client.flush();
    await vi.waitFor(()=>expect(bodies.flatMap(b=>b.events).filter(e=>e.eventName==="jackpot")).toHaveLength(1));
    const all=bodies.flatMap(b=>b.events);
    expect(all.find(e=>e.eventName==="jackpot")?.props).toMatchObject({phase:"end",remaining:0,floor:15});
    expect(all.some(e=>e.eventName==="spin_batch")).toBe(false);
  });
  it("aggregates rapid coins separately from main spins without dropping totals", async()=>{
    const client=new Telemetry();let s={...freshRun(),coinEnabled:true,cash:1000,peak:1e6};client.observe(s);
    for(let i=0;i<20;i++){const next=playCoinFlip(s,10,i%2===0);client.changed(s,next);s=next;}
    await client.flush();await vi.waitFor(()=>expect(bodies.flatMap(b=>b.events).filter(e=>e.eventName==="coin_batch")).toHaveLength(1));const events=bodies.flatMap(b=>b.events).filter(e=>e.eventName==="coin_batch");
    expect(events).toHaveLength(1);expect(events[0].props).toMatchObject({rounds:20,wins:10,wager:200,payout:200,coinRounds:20,coinWins:10});
  });
  it("waits for an in-flight rating before erasing its telemetry context",async()=>{
    const client=new Telemetry(),s=freshRun();const paths:string[]=[];let release!:()=>void;
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>{paths.push(url);if(url==="/api/ratings")await new Promise<void>(resolve=>{release=resolve});return new Response(JSON.stringify({ok:true}),{status:200})}));
    const sending=client.sendRating(s,{ratingId:crypto.randomUUID(),stars:5,source:"clear",appVersion:"2.5.0",language:"ja"});
    const deleting=client.erase();await Promise.resolve();expect(paths).toEqual(["/api/ratings"]);expect(client.feedbackContext(s)).toBeNull();
    release();await sending;await deleting;expect(paths).toEqual(["/api/ratings","/api/telemetry"]);
  });
  it("excludes local development before creating an identity, buffering or sending", async () => {
    for (const hostname of ["localhost", "127.0.0.1", "[::1]", "::1", "game.localhost"]) {
      vi.stubGlobal("location", {hostname});
      const client = new Telemetry(); client.observe(freshRun()); await client.flush();
      expect(localStorage.getItem("bebullish-install-id")).toBeNull();
      expect(localStorage.getItem("bebullish-telemetry-pending")).toBeNull();
      expect(bodies).toHaveLength(0);
    }
    expect(localTelemetryHost("192.168.0.2",true)).toBe(true);
    expect(localTelemetryHost("bebullish.fun")).toBe(false);
  });
  it("persists an attempted batch before sending and reuses its event IDs after a failed request and restart", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {throw new Error("offline")}));
    const client = new Telemetry();
    client.event(freshRun(),"tab_view",{tab:"positions"});
    await client.flush();
    const pending=JSON.parse(localStorage.getItem("bebullish-telemetry-pending")!);
    expect(pending).toHaveLength(1);
    vi.stubGlobal("fetch",vi.fn(async (_url,init) => {
      bodies.push(JSON.parse(init.body));return new Response(JSON.stringify({ok:true}),{status:202});
    }));
    await new Telemetry().flush();
    expect(bodies[0].events).toEqual(pending);
    expect(JSON.parse(localStorage.getItem("bebullish-telemetry-pending")!)).toEqual([]);
  });
  it("records the actual triggering roll for consecutive-high jackpots", async () => {
    const client=new Telemetry();
    const s=configure({...freshRun(),cash:100,portfolio:[{id:"edge-50",count:1}],running:true},{jackpotRule:"double-high",assist:false});
    const before=spin(s,91,100),after=spin(before,92,100);
    expect(after.last?.jackpot).toBe(true);
    client.settled(before,after);await client.flush();
    expect(bodies.flatMap(b=>b.events).find(e=>e.eventName==="jackpot")?.props.roll).toBe(92);
  });
  it("records sound assignment before onboarding and keeps the assigned variant after a sound change",async()=>{
    localStorage.setItem(SOUND_EXPERIMENT_KEY,JSON.stringify({experiment:"sound-default-v1",variant:"retro-arcade",assignedAt:Date.now()}));
    const s=initializeSoundExperiment(freshRun(),true,localStorage,()=>1),client=new Telemetry();
    client.observe(s);await vi.waitFor(()=>expect(bodies).toHaveLength(1));
    expect(bodies[0].events[0]).toMatchObject({eventName:"sound_assignment",props:{soundExperiment:"sound-default-v1",soundVariant:"retro-arcade"}});
    const changed=configure(s,{soundPack:"wood"});client.checkpoint(changed);
    await vi.waitFor(()=>expect(bodies.length).toBeGreaterThan(1));
    expect(bodies.flatMap(b=>b.events).at(-1)!.props).toMatchObject({soundVariant:"retro-arcade",soundPack:"wood"});
    expect(JSON.parse(localStorage.getItem(SOUND_EXPERIMENT_KEY)!).variant).toBe("retro-arcade");
  });
  it("captures the current inquiry state and waits for its send before deleting linked statistics", async () => {
    const client = new Telemetry(),
      s = freshRun();
    client.event(s, "tab_view", { tab: "positions", modal: "feedback" });
    expect(client.feedbackContext(s)).toMatchObject({
      runId: s.id,
      snapshot: { tab: "positions", modal: "feedback", chartAxis: "spins" },
    });
    expect(client.feedbackContext({ ...s, telemetry: false })).toBeNull();
    let complete!: () => void;
    const paths: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        paths.push(url);
        if (url === "/api/feedback")
          await new Promise<void>((resolve) => {
            complete = resolve;
          });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    const sending = client.sendFeedback(s, {
      message: "playtest",
      appVersion: "1.3.0",
      language: "ja",
    });
    const deleting = client.erase();
    await Promise.resolve();
    expect(paths).toEqual(["/api/feedback"]);
    expect(client.feedbackContext(s)).toBeNull();
    complete();
    await sending;
    await deleting;
    expect(paths).toEqual(["/api/feedback", "/api/telemetry"]);
  });
  it("batches infinite jackpots without dropping clear or counting a spin twice", async () => {
    const client = new Telemetry();
    let s = {
      ...freshRun(),
      cash: TARGET - 10,
      peak: TARGET - 10,
      portfolio: [{ id: "edge-50", count: 1 }],
      rushLeft: 100,
      removed: 99,
      chain: 99,
      trim: 1,
      running: true,
    };
    client.observe(s);
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    for (let i = 0; i < 150; i++) {
      const before = s;
      s = spin(s, 100, 100);
      client.changed(before, s);
      client.settled(before, s);
    }
    client.checkpoint(s);
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThanOrEqual(2));
    const events = bodies.flatMap((b) => b.events);
    expect(events.some((e) => e.eventName === "clear")).toBe(true);
    expect(
      events
        .filter((e) => e.eventName === "spin_batch")
        .reduce((n, e) => n + e.props.spins, 0),
    ).toBe(150);
    expect(
      events
        .filter((e) => e.eventName === "spin_batch")
        .reduce((n, e) => n + e.props.jackpots, 0),
    ).toBe(150);
    expect(events.filter((e) => e.eventName === "jackpot")).toHaveLength(0);
    expect(
      events.some(
        (e) =>
          e.eventName === "milestone" && String(e.props.name) === "first_spin",
      ),
    ).toBe(true);
  });
  it("keeps separate run and ruleset batches and sends with keepalive", async () => {
    const client = new Telemetry(),
      a = freshRun("classic"),
      b = freshRun("curated");
    client.observe(a);
    await vi.waitFor(() => expect(bodies.length).toBe(1));
    client.changed(a, b);
    client.checkpoint(b);
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(1));
    await client.flush();
    for (const batch of bodies) {
      expect(new Set(batch.events.map((e) => e.runId)).size).toBe(1);
      expect(new Set(batch.events.map((e) => e.rulesetVersion)).size).toBe(1);
    }
    expect(vi.mocked(fetch).mock.calls[0][1]?.keepalive).toBe(true);
  });
  it("buffers a failed request for another session without changing event ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const client = new Telemetry();
    client.observe(freshRun());
    await client.flush();
    expect(
      JSON.parse(localStorage.getItem("bebullish-telemetry-pending") ?? "[]")
        .length,
    ).toBeGreaterThan(0);
  });
  it("rounds Lab assistance input and retains chosen settings in a fresh run", () => {
    const configured = configure(freshRun(), {
      assist: true,
      assistAfter: 80.5,
      opening: 20,
    });
    expect(configured.settings.assistAfter).toBe(81);
    expect(readSave(JSON.stringify(configured))).not.toBeNull();
    const n = freshRun("classic", configured.settings);
    expect(n.settings.assist).toBe(true);
    expect(n.settings.opening).toBe(20);
    expect(n.debug).toBe(true);
    expect(freshRun().debug).toBe(false);
  });
  it("records a cash wait once, links recovery, and identifies direct upgrade levels", async () => {
    const client = new Telemetry();
    let s = {
      ...freshRun(),
      cash: 7,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    client.observe(s);
    await client.flush();
    let n = { ...s, running: true };
    client.changed(s, n);
    s = n;
    for (let i = 0; i < 3; i++) {
      n = { ...work(s), activeMs: s.activeMs + 500 };
      client.changed(s, n);
      s = n;
    }
    const funded = { ...s, cash: 1000, peak: 1000 };
    n = purchase(funded, "speed");
    client.changed(funded, n);
    client.checkpoint(n);
    await vi.waitFor(() =>
      expect(
        bodies
          .flatMap((b) => b.events)
          .some((e) => e.eventName === "upgrade_purchase"),
      ).toBe(true),
    );
    await client.flush();
    const events = bodies.flatMap((b) => b.events);
    const enter = events.filter((e) => e.eventName === "wait_enter"),
      exit = events.filter((e) => e.eventName === "wait_exit");
    expect(enter).toHaveLength(1);
    expect(exit).toHaveLength(1);
    expect(exit[0].props).toMatchObject({
      waitId: enter[0].props.waitId,
      reason: "cash",
      resolution: "work",
      workClicksDuringWait: 3,
      durationMs: 1500,
    });
    expect(
      events.find((e) => e.eventName === "upgrade_purchase")?.props,
    ).toMatchObject({ kind: "speed", levels: 1 });
  });
  it("deduplicates hidden page notifications and clears pending data on opt-out", async () => {
    const client = new Telemetry(),
      s = freshRun();
    client.observe(s);
    await client.flush();
    client.visibility(s, true);
    client.visibility(s, true);
    await vi.waitFor(() =>
      expect(
        bodies
          .flatMap((b) => b.events)
          .some((e) => e.eventName === "session_end"),
      ).toBe(true),
    );
    await client.flush();
    expect(
      bodies
        .flatMap((b) => b.events)
        .filter((e) => e.eventName === "session_end"),
    ).toHaveLength(1);
    client.event(s, "tab_view", { tab: "upgrades" });
    client.changed(s, { ...s, telemetry: false });
    expect(
      JSON.parse(localStorage.getItem("bebullish-telemetry-pending") ?? "[]"),
    ).toEqual([]);
  });
  it("does not lose spins added while a previously sealed batch is in flight", async () => {
    const client = new Telemetry();
    let s = {
      ...freshRun(),
      cash: 1000,
      peak: 1000,
      spins: 1,
      bestWin: 20,
      portfolio: [{ id: "edge-50", count: 1 }],
    };
    client.observe(s);
    await vi.waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("bebullish-telemetry-pending") ?? "[]"),
      ).toHaveLength(0),
    );
    let release!: (r: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return await new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    let next = spin(s, 51);
    client.settled(s, next);
    s = next;
    const sending = client.flush();
    next = spin(s, 52);
    client.settled(s, next);
    s = next;
    release(new Response(JSON.stringify({ ok: true }), { status: 202 }));
    await sending;
    await client.flush();
    expect(
      bodies
        .flatMap((b) => b.events)
        .filter((e) => e.eventName === "spin_batch")
        .reduce((n, e) => n + e.props.spins, 0),
    ).toBe(2);
  });
  it("clips transport money without touching game balances", () => {
    expect(apiMoney(1e200)).toBe(1e15);
    expect(apiMoney(-1e200)).toBe(-1e15);
  });
});
