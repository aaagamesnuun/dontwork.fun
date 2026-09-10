import {bankrollRankingsApi} from "./bankrollRankings.js";
import { refreshSoundExperimentReport } from "./soundExperiment.js";
import { rankingsApi } from "./rankings.js";
const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS leaderboard_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('classic', 'deck')),
    time_ms INTEGER NOT NULL CHECK (time_ms > 0),
    spins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    bankruptcies INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_leaderboard_mode_time ON leaderboard_scores(mode, time_ms)`,
  `CREATE TABLE IF NOT EXISTS telemetry_events (
    event_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    active_ms INTEGER NOT NULL CHECK (active_ms >= 0),
    engaged_ms INTEGER NOT NULL DEFAULT 0 CHECK (engaged_ms >= 0),
    event_name TEXT NOT NULL,
    app_version TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    debug INTEGER NOT NULL DEFAULT 0 CHECK (debug IN (0, 1)),
    language TEXT NOT NULL CHECK (language IN ('en', 'ja')),
    device_class TEXT NOT NULL CHECK (device_class IN ('mobile', 'desktop')),
    viewport_class TEXT NOT NULL CHECK (viewport_class IN ('small', 'medium', 'large')),
    props_json TEXT NOT NULL CHECK (json_valid(props_json) AND length(props_json) <= 20000),
    received_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (session_id, sequence)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_events_run_sequence ON telemetry_events(run_id, sequence)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_events_run_active_received ON telemetry_events(run_id, active_ms, received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_events_ruleset_received ON telemetry_events(ruleset_version, received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_received ON telemetry_events(event_name, received_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_events_received ON telemetry_events(received_at)`,
  `CREATE TABLE IF NOT EXISTS telemetry_runs (
    run_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    first_session_id TEXT NOT NULL,
    app_version TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    debug INTEGER NOT NULL DEFAULT 0 CHECK (debug IN (0, 1)),
    language TEXT NOT NULL CHECK (language IN ('en', 'ja')),
    device_class TEXT NOT NULL CHECK (device_class IN ('mobile', 'desktop')),
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    active_ms INTEGER NOT NULL DEFAULT 0,
    engaged_ms INTEGER NOT NULL DEFAULT 0,
    snapshot_active_ms INTEGER NOT NULL DEFAULT 0,
    bankroll REAL NOT NULL DEFAULT 0,
    peak_bankroll REAL NOT NULL DEFAULT 0,
    fuel REAL NOT NULL DEFAULT 0,
    fuel_capacity INTEGER NOT NULL DEFAULT 0,
    slot_count INTEGER NOT NULL DEFAULT 0,
    spin_speed_level INTEGER NOT NULL DEFAULT 0,
    total_spins INTEGER NOT NULL DEFAULT 0,
    total_draws INTEGER NOT NULL DEFAULT 0,
    total_work INTEGER NOT NULL DEFAULT 0,
    bankruptcies INTEGER NOT NULL DEFAULT 0,
    cleared INTEGER NOT NULL DEFAULT 0 CHECK (cleared IN (0, 1)),
    first_baseline_ms INTEGER,
    first_interaction_ms INTEGER,
    first_work_ms INTEGER,
    first_agents_ms INTEGER,
    first_spin_ms INTEGER,
    first_win_ms INTEGER,
    first_draft_ms INTEGER,
    first_special_ms INTEGER,
    first_special_deployed_ms INTEGER,
    first_upgrade_ms INTEGER,
    first_duplicate_ms INTEGER,
    first_jackpot_ms INTEGER,
    clear_active_ms INTEGER,
    clear_engaged_ms INTEGER,
    clear_wall_ms INTEGER,
    final_status TEXT NOT NULL DEFAULT 'unknown',
    last_event TEXT NOT NULL DEFAULT 'session_start',
    deck_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(deck_json)),
    copies_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(copies_json))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_runs_ruleset_started ON telemetry_runs(ruleset_version, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_runs_player_started ON telemetry_runs(player_id, started_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_runs_last_seen ON telemetry_runs(last_seen_at)`,
  `CREATE TABLE IF NOT EXISTS telemetry_reports (
    report_key TEXT PRIMARY KEY,
    ruleset_version TEXT NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS telemetry_rate_limits (
    request_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (request_hash, bucket)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_rate_bucket ON telemetry_rate_limits(bucket)`,
  `CREATE TABLE IF NOT EXISTS telemetry_card_reports (
    ruleset_version TEXT NOT NULL,
    card_id TEXT NOT NULL,
    offered INTEGER NOT NULL DEFAULT 0,
    chosen INTEGER NOT NULL DEFAULT 0,
    duplicate_choices INTEGER NOT NULL DEFAULT 0,
    chosen_runs INTEGER NOT NULL DEFAULT 0,
    deployed_runs INTEGER NOT NULL DEFAULT 0,
    chosen_never_deployed_runs INTEGER NOT NULL DEFAULT 0,
    spin_exposures INTEGER NOT NULL DEFAULT 0,
    copy_spin_exposures INTEGER NOT NULL DEFAULT 0,
    hits INTEGER NOT NULL DEFAULT 0,
    wager REAL NOT NULL DEFAULT 0,
    payout REAL NOT NULL DEFAULT 0,
    penalty REAL NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    effect_triggers INTEGER NOT NULL DEFAULT 0,
    economy_batches INTEGER NOT NULL DEFAULT 0,
    first_deploy_median_ms REAL,
    acquisition_to_deploy_median_ms REAL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (ruleset_version, card_id)
  )`,
  `CREATE TABLE IF NOT EXISTS telemetry_build_reports (
    ruleset_version TEXT NOT NULL,
    build_id TEXT NOT NULL,
    deployed_runs INTEGER NOT NULL DEFAULT 0,
    clear_runs INTEGER NOT NULL DEFAULT 0,
    spin_exposures INTEGER NOT NULL DEFAULT 0,
    profit REAL NOT NULL DEFAULT 0,
    first_activation_median_ms REAL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (ruleset_version, build_id)
  )`,
  `CREATE TABLE IF NOT EXISTS telemetry_recent_runs (
    run_id TEXT PRIMARY KEY,
    player_short TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    active_ms INTEGER NOT NULL DEFAULT 0,
    final_status TEXT NOT NULL,
    bankroll REAL NOT NULL DEFAULT 0,
    peak_bankroll REAL NOT NULL DEFAULT 0,
    total_spins INTEGER NOT NULL DEFAULT 0,
    total_draws INTEGER NOT NULL DEFAULT 0,
    total_work INTEGER NOT NULL DEFAULT 0,
    cleared INTEGER NOT NULL DEFAULT 0,
    debug INTEGER NOT NULL DEFAULT 0,
    milestones_json TEXT NOT NULL DEFAULT '{}',
    deck_json TEXT NOT NULL DEFAULT '[]',
    copies_json TEXT NOT NULL DEFAULT '[]',
    timeline_json TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE INDEX IF NOT EXISTS idx_telemetry_recent_runs_seen ON telemetry_recent_runs(last_seen_at DESC)`,
  `CREATE TABLE IF NOT EXISTS feedback_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('bug', 'idea', 'balance', 'other')),
    identity_mode TEXT NOT NULL CHECK (identity_mode IN ('anonymous', 'named')),
    display_name TEXT,
    reply_contact TEXT,
    message TEXT NOT NULL CHECK (length(message) BETWEEN 3 AND 2000),
    app_version TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('en', 'ja')),
    bankroll REAL NOT NULL DEFAULT 0,
    total_spins INTEGER NOT NULL DEFAULT 0,
    total_draws INTEGER NOT NULL DEFAULT 0,
    page TEXT NOT NULL DEFAULT 'game' CHECK (page IN ('game', 'spin', 'deck', 'collection')),
    player_id TEXT, run_id TEXT, session_id TEXT, ruleset_version TEXT, active_ms INTEGER, snapshot_json TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK ((identity_mode = 'anonymous' AND display_name IS NULL AND reply_contact IS NULL)
      OR (identity_mode = 'named' AND display_name IS NOT NULL AND length(display_name) BETWEEN 1 AND 32)),
    CHECK (reply_contact IS NULL OR length(reply_contact) BETWEEN 1 AND 160)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON feedback_messages(status, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS feedback_rate_limits (
    request_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (request_hash, bucket)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_rate_bucket ON feedback_rate_limits(bucket)`,
];

const EVENT_NAMES = new Set([
  "music_play_batch", "sound_assignment", "baccarat_round", "probability_upgrade",
  "session_start", "session_end", "interaction_start", "snapshot", "milestone", "work_batch", "agents_toggle", "spin_batch",
  "wait_enter", "wait_exit", "draft_open", "draft_offer", "draft_choose", "draft_close", "deck_change", "deck_preset",
  "favorite_toggle", "upgrade_purchase", "jackpot", "debt_action", "bankruptcy", "reset", "clear", "setting_change",
  "trial_end", "trial_pause", "trial_resume", "trial_time", "blocked_action", "guidance_shown", "guidance_resolved", "pwa_gate",
  "tab_view", "how_to_open", "audio_health_batch", "client_error",
]);

const PROP_KEYS = new Set([
  "soundExperiment", "soundVariant", "soundAssignedAt", "workspaceMode", "sharedChart", "oddsDisplay", "probabilityUpgrades", "baccarat", "baccaratRounds",
  "entryKind", "reason", "name", "source", "phase", "code", "action", "kind", "tab", "transactionId", "waitId",
  "bankroll", "peakBankroll", "bankrollBefore", "bankrollAfter", "bankrollStart", "bankrollEnd", "bankrollMin",
  "bankrollMax", "fuel", "fuelCapacity", "slotCount", "spinSpeedLevel", "status", "isRunning", "running",
  "requested", "cleared", "debug", "duplicate", "pendingChoice", "totalSpins", "totalDraws", "totalWork",
  "bankruptcies", "spins", "draws", "clicks", "wins", "losses", "wager", "payout", "profit", "penalty",
  "moneyEarned", "computeEarned", "potentialCompute", "wastedCompute", "durationMs", "engagedDurationMs", "activeMs", "wallTimeMs", "price", "cost", "levels", "drawIndex", "index",
  "copiesBefore", "copiesAfter", "deployed", "remaining", "floor", "roll", "roll1", "roll100", "jackpots",
  "biggestWin", "biggestLoss", "screen", "modal", "cardId", "chosenId", "offers", "deck", "copies", "names",
  "rollBuckets", "hitByCard", "spinByCard", "copySpinsByCard", "wagerByCard", "payoutByCard", "penaltyByCard",
  "profitByCard", "effectsByCard", "fuelCapacityLevel", "fuelStart", "fuelEnd", "statusStart", "statusEnd",
  "requiredCostStart", "requiredSpinCost", "workClicksDuringWait", "resolution", "builds", "tutorialStep",
  "nextDraftPrice", "totalBet", "totalPayout", "totalProfit", "upgradeSpend", "runMode", "debt", "rankedEligible",
  "jackpotSpinsRemaining", "jackpotFloor", "jackpotPersistentFloor", "hundredRolls", "input", "offerIndex",
  "rushActive", "rushSpins", "rushProfit", "trimApplied", "floorBefore", "floorAfter",
  "rarity", "tier", "baseCost", "basePayout", "ownedUnique", "ownedCopies", "requests", "scheduled",
  "mutedSkips", "throttledSkips", "voiceLimitSkips", "contextMissing", "contextFailures", "resumeFailures", "interruptedStates",
  "reelStyle", "reelStyleRevision", "revealDurationMs", "winFx", "soundPack", "stickyBankroll", "showMetrics",
  "compactPortfolio", "awayMode", "jackpotMode", "jackpotSpinGrant", "jackpotSpinIntervalMs", "jackpotTrimEffects",
  "leverageMode", "interestRate", "recordingSafe", "haptics", "settingsLanguage", "soundMuted",
  "creditLevel", "loanSpins",
]);

for (const key of ["chartAxis", "soundVolume", "lossVolume", "soundDensity", "shake", "impactFlash", "payoffStyle", "chargeSound", "chargeVolume", "sweepMotion", "spinSound", "music", "musicPack", "musicVolume"]) PROP_KEYS.add(key);

const DYNAMIC_CARD_MAPS = new Set([
  "hitByCard", "spinByCard", "copySpinsByCard", "wagerByCard", "payoutByCard",
  "penaltyByCard", "profitByCard", "effectsByCard",
]);

const NUMERIC_PROP_KEYS = new Set([
  "bankroll", "peakBankroll", "bankrollBefore", "bankrollAfter", "bankrollStart", "bankrollEnd", "bankrollMin",
  "bankrollMax", "fuel", "fuelCapacity", "slotCount", "spinSpeedLevel", "totalSpins", "totalDraws", "totalWork",
  "bankruptcies", "spins", "draws", "clicks", "wins", "losses", "wager", "payout", "profit", "penalty",
  "moneyEarned", "computeEarned", "potentialCompute", "wastedCompute", "durationMs", "engagedDurationMs", "activeMs",
  "wallTimeMs", "price", "cost", "levels", "drawIndex", "index", "copiesBefore", "copiesAfter", "deployed",
  "remaining", "floor", "roll", "roll1", "roll100", "jackpots", "biggestWin", "biggestLoss", "fuelCapacityLevel",
  "fuelStart", "fuelEnd", "requiredCostStart", "requiredSpinCost", "workClicksDuringWait", "nextDraftPrice", "totalBet",
  "totalPayout", "totalProfit", "upgradeSpend", "debt", "jackpotSpinsRemaining", "jackpotFloor", "jackpotPersistentFloor",
  "hundredRolls", "offerIndex", "tier", "baseCost", "basePayout", "ownedUnique", "ownedCopies", "requests", "scheduled",
  "mutedSkips", "throttledSkips", "voiceLimitSkips", "contextMissing", "contextFailures", "resumeFailures", "interruptedStates",
  "rushSpins", "rushProfit", "trimApplied", "floorBefore", "floorAfter",
  "reelStyleRevision", "revealDurationMs", "jackpotSpinGrant", "jackpotSpinIntervalMs", "interestRate",
  "creditLevel", "loanSpins",
]);

for (const key of ["soundVolume", "lossVolume", "chargeVolume", "musicVolume"]) NUMERIC_PROP_KEYS.add(key);

const INTEGER_COUNT_PROP_KEYS = new Set([
  "fuel", "fuelCapacity", "slotCount", "spinSpeedLevel", "totalSpins", "totalDraws", "totalWork", "bankruptcies",
  "spins", "draws", "clicks", "wins", "losses", "levels", "drawIndex", "index", "copiesBefore", "copiesAfter",
  "deployed", "remaining", "floor", "roll", "roll1", "roll100", "jackpots", "fuelCapacityLevel", "fuelStart",
  "fuelEnd", "workClicksDuringWait", "jackpotSpinsRemaining", "jackpotFloor", "jackpotPersistentFloor", "hundredRolls",
  "offerIndex", "tier", "ownedUnique", "ownedCopies", "requests", "scheduled", "mutedSkips", "throttledSkips",
  "voiceLimitSkips", "contextMissing", "contextFailures", "resumeFailures", "interruptedStates", "rushSpins",
  "trimApplied", "floorBefore", "floorAfter", "count", "reelStyleRevision", "revealDurationMs",
  "jackpotSpinGrant", "jackpotSpinIntervalMs",
  "creditLevel", "loanSpins",
]);
const NONNEGATIVE_AMOUNT_PROP_KEYS = new Set([
  "peakBankroll", "bankrollMax", "wager", "payout", "penalty", "moneyEarned", "computeEarned", "potentialCompute",
  "wastedCompute", "price", "cost", "baseCost", "basePayout", "requiredCostStart", "requiredSpinCost", "nextDraftPrice",
  "totalBet", "totalPayout", "upgradeSpend", "debt", "interestRate",
]);
const DURATION_PROP_KEYS = new Set(["durationMs", "engagedDurationMs", "activeMs", "wallTimeMs"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/;
const SETTING_ENUM_VALUES = new Map([
  ["soundExperiment", new Set(["sound-default-v1"])],
  ["soundVariant", new Set(["terminal","retro-arcade"])],
  ["workspaceMode", new Set(["desk","tabs"])],
  ["oddsDisplay", new Set(["percent","fraction"])],
  ["reelStyle", new Set(["number", "payoff", "strip", "pulse"])],
  ["winFx", new Set(["low", "standard", "max"])],
  ["soundPack", new Set(["terminal", "retro-arcade", "arcade", "soft", "crystal", "wood", "impact", "arcade-coinop", "arcade-pinball", "arcade-synth", "arcade-punch"])],
  ["payoffStyle", new Set(["classic", "chart", "net"])],
  ["chargeSound", new Set(["off", "ticks", "rise"])],
  ["chartAxis", new Set(["spins", "time"])],
  ["soundDensity", new Set(["all", "balanced", "highlights"])],
  ["spinSound", new Set(["rhythm", "original"])],
  ["shake", new Set(["off", "light", "strong"])],
  ["impactFlash", new Set(["off", "soft", "bright"])],
  ["awayMode", new Set(["pause", "catch-up"])],
  ["jackpotMode", new Set(["instant", "off"])],
  ["settingsLanguage", new Set(["en", "ja"])],
]);
const SETTING_NUMERIC_VALUES = new Map([
  ["reelStyleRevision", new Set([1])],
  ["revealDurationMs", new Set([120, 260, 420, 460, 700, 800, 1200, 2000, 3500, 5000])],
  ["jackpotSpinIntervalMs", new Set([100, 200, 300, 500, 750, 1000])],
  ["interestRate", new Set([0.001, 0.005, 0.01])],
]);
const FEEDBACK_CATEGORIES = new Set(["bug", "idea", "balance", "other"]);
const CURRENT_RULESET_VERSION = "all-pool-copies-v1";
const ACCEPTED_TELEMETRY_APP_VERSIONS = new Set(["0.7.1", "0.7.2"]);
const ASTRA_CATALOG_IDS = ["classic", "curated", "streaks", "streak80", "crashes", "reversals", "dryspell", "spectrum", "rush", "longgame", "legacy"];
const ORIGINAL_ASTRA_CATALOG_IDS = ASTRA_CATALOG_IDS.filter(id => !["streak80", "crashes"].includes(id));
const ASTRA_RULESETS = new Set(ORIGINAL_ASTRA_CATALOG_IDS.map(id => `astra-v1:${id}`));
const ASTRA_V2_RULESETS = new Set(ORIGINAL_ASTRA_CATALOG_IDS.map(id => `astra-v2:${id}`));
const ASTRA_V3_RULESETS = new Set(ORIGINAL_ASTRA_CATALOG_IDS.filter(id => !["classic", "legacy"].includes(id)).map(id => `astra-v3:${id}`));
const ASTRA_V4_RULESETS = new Set(ASTRA_CATALOG_IDS.filter(id => !["classic", "legacy"].includes(id)).map(id => `astra-v4:${id}`));
const ASTRA_V9_CATALOG_IDS = [...ASTRA_CATALOG_IDS,"billion","all-test"];
const ASTRA_V13_RULESETS = new Set(ASTRA_V9_CATALOG_IDS.map(id => `astra-v13:${id}`));
const ASTRA_V12_RULESETS = new Set(ASTRA_V9_CATALOG_IDS.map(id => `astra-v12:${id}`));
const ASTRA_V11_RULESETS = new Set(ASTRA_V9_CATALOG_IDS.map(id => `astra-v11:${id}`));
const ASTRA_V10_RULESETS = new Set(ASTRA_V9_CATALOG_IDS.map(id => `astra-v10:${id}`));
const ASTRA_V9_RULESETS = new Set(ASTRA_V9_CATALOG_IDS.map(id => `astra-v9:${id}`));
const ASTRA_V8_RULESETS = new Set(ASTRA_CATALOG_IDS.map(id => `astra-v8:${id}`));
const ASTRA_V7_RULESETS = new Set(ASTRA_CATALOG_IDS.map(id => `astra-v7:${id}`));
const ASTRA_V6_RULESETS = new Set(ASTRA_CATALOG_IDS.map(id => `astra-v6:${id}`));
const ASTRA_V5_RULESETS = new Set(ASTRA_CATALOG_IDS.map(id => `astra-v5:${id}`));
for(const key of ["jackpotRule","showJackpotCounter","spinsSinceJackpot","jackpotHigh"]) PROP_KEYS.add(key);
SETTING_ENUM_VALUES.set("jackpotRule",new Set(["hundred","double-high","combined"]));
NUMERIC_PROP_KEYS.add("spinsSinceJackpot"); INTEGER_COUNT_PROP_KEYS.add("spinsSinceJackpot");
for(const key of ["backgroundJackpot","bigChangeNotifications","rollDisplay","language","trialScoring"])PROP_KEYS.add(key);
SETTING_ENUM_VALUES.set("rollDisplay",new Set(["dice","number"]));SETTING_ENUM_VALUES.set("language",new Set(["ja","en"]));SETTING_ENUM_VALUES.set("trialScoring",new Set(["none","cash","assets"]));
PROP_KEYS.add("spinAssist"); PROP_KEYS.add("spinAssistSequence");
SETTING_ENUM_VALUES.set("spinAssistSequence",new Set([4,5].flatMap(length=>Array.from({length:2**length},(_,n)=>n.toString(2).padStart(length,"0").replaceAll("0","L").replaceAll("1","W")))));
PROP_KEYS.add("backgroundPlay"); PROP_KEYS.add("backgroundMs");
for(const key of ["jackpotNotifications","sweepSound","coinChartMarkers","streakEffects","effectIntensity"])PROP_KEYS.add(key);
NUMERIC_PROP_KEYS.add("effectIntensity");
NUMERIC_PROP_KEYS.add("backgroundMs"); DURATION_PROP_KEYS.add("backgroundMs");
PROP_KEYS.add("fuelEnabled"); PROP_KEYS.add("newsPosition"); PROP_KEYS.add("assistUsed");
PROP_KEYS.add("chartWindowSpins");
PROP_KEYS.add("revealPacing");
PROP_KEYS.add("revealRatio"); NUMERIC_PROP_KEYS.add("revealRatio");
SETTING_ENUM_VALUES.set("revealPacing", new Set(["ratio", "adaptive", "full"]));
NUMERIC_PROP_KEYS.add("chartWindowSpins");
INTEGER_COUNT_PROP_KEYS.add("chartWindowSpins");
SETTING_ENUM_VALUES.set("newsPosition", new Set(["top", "bottom"]));
SETTING_ENUM_VALUES.set("sweepMotion", new Set(["roam", "slow", "classic", "focus", "recoil", "lock", "mix"]));
for (const key of ["jackpotMusic", "bassMode", "jackpotAutoTab", "economyProfile"]) PROP_KEYS.add(key);
SETTING_ENUM_VALUES.set("jackpotMusic", new Set(["follow", "on", "off"]));
SETTING_ENUM_VALUES.set("economyProfile", new Set(["v24", "v22", "v21", "v20"]));
SETTING_ENUM_VALUES.set("musicPack", new Set(["pulse", "night", "arcade", "bit-quest", "pixelland", "cipher", "envision"]));
const acceptsTelemetry = event => event.appVersion === "3.0.0" ? ASTRA_V13_RULESETS.has(event.rulesetVersion) || event.rulesetVersion === "astra-v13-30m-assets:classic" : ["2.8.0","2.9.0"].includes(event.appVersion) ? ASTRA_V13_RULESETS.has(event.rulesetVersion) || event.rulesetVersion === "astra-v13-30m:classic" : event.appVersion === "2.7.0" ? ASTRA_V13_RULESETS.has(event.rulesetVersion) : event.appVersion === "2.6.0" ? ASTRA_V12_RULESETS.has(event.rulesetVersion) : event.appVersion === "2.5.0" ? ASTRA_V11_RULESETS.has(event.rulesetVersion) : event.appVersion === "2.4.0" ? ASTRA_V10_RULESETS.has(event.rulesetVersion) : event.appVersion === "2.3.0" ? ASTRA_V9_RULESETS.has(event.rulesetVersion) : event.appVersion === "2.2.0" ? ASTRA_V8_RULESETS.has(event.rulesetVersion) : event.appVersion === "2.1.0" ? ASTRA_V7_RULESETS.has(event.rulesetVersion) : ["1.10.0", "1.11.0", "2.0.0"].includes(event.appVersion) ? ASTRA_V6_RULESETS.has(event.rulesetVersion) : ["1.8.0", "1.9.0"].includes(event.appVersion) ? ASTRA_V5_RULESETS.has(event.rulesetVersion) : event.appVersion === "1.7.0" ? ASTRA_V4_RULESETS.has(event.rulesetVersion) || ["astra-v2:classic", "astra-v2:legacy"].includes(event.rulesetVersion) : ["1.6.0", "1.6.1"].includes(event.appVersion) ? ASTRA_V3_RULESETS.has(event.rulesetVersion) || ["astra-v2:classic", "astra-v2:legacy"].includes(event.rulesetVersion) : ["1.2.0", "1.3.0", "1.4.0", "1.5.0"].includes(event.appVersion) ? ASTRA_V2_RULESETS.has(event.rulesetVersion) : ["1.0.0", "1.1.0"].includes(event.appVersion)
  ? ASTRA_RULESETS.has(event.rulesetVersion)
  : ACCEPTED_TELEMETRY_APP_VERSIONS.has(event.appVersion) && event.rulesetVersion === CURRENT_RULESET_VERSION;
const leaderboardRulesetFrom = value => value === undefined || value === null
  ? "legacy-v0" : value === "legacy-v0" || ASTRA_RULESETS.has(value) || ASTRA_V2_RULESETS.has(value) || ASTRA_V3_RULESETS.has(value) || ASTRA_V4_RULESETS.has(value) || ASTRA_V5_RULESETS.has(value) || ASTRA_V6_RULESETS.has(value) || ASTRA_V7_RULESETS.has(value) || ASTRA_V8_RULESETS.has(value) || ASTRA_V9_RULESETS.has(value) || ASTRA_V10_RULESETS.has(value) || ASTRA_V11_RULESETS.has(value) || ASTRA_V12_RULESETS.has(value) || ASTRA_V13_RULESETS.has(value) ? value : null;
for (const key of ["catalogId", "trimLevel", "rushLevel", "assist", "assistAfter", "opening", "spinSpeedScale", "rushBase", "upgradePrices", "motion", "fx", "infinity", "maxChain", "maxStreak"]) PROP_KEYS.add(key);
for (const key of ["trimLevel", "rushLevel", "assistAfter", "opening", "spinSpeedScale", "rushBase", "maxChain", "maxStreak"]) NUMERIC_PROP_KEYS.add(key);
for (const key of ["trimLevel", "rushLevel", "assistAfter", "opening", "rushBase", "maxChain", "maxStreak"]) INTEGER_COUNT_PROP_KEYS.add(key);
SETTING_ENUM_VALUES.set("catalogId", new Set(ASTRA_V9_CATALOG_IDS));
SETTING_ENUM_VALUES.set("upgradePrices", new Set(["steep", "exponential", "legacy"]));
for (const key of ["positionPriceBase", "positionPriceMultiplier", "speedPriceBase", "speedPriceMultiplier"]) { PROP_KEYS.add(key); NUMERIC_PROP_KEYS.add(key); }
PROP_KEYS.add("upgradeMode");
PROP_KEYS.add("upgradeDraws");
NUMERIC_PROP_KEYS.add("upgradeDraws");
INTEGER_COUNT_PROP_KEYS.add("upgradeDraws");
SETTING_ENUM_VALUES.set("upgradeMode", new Set(["direct", "gacha"]));
SETTING_ENUM_VALUES.set("motion", new Set(["full", "reduced"]));
SETTING_ENUM_VALUES.set("fx", new Set(["cinematic", "clean", "arcade"]));
for(const key of ["sharedSpin","wealthTheme","adaptiveMusic","workMode","workCosmetics","upgradeTutorial","workFxLevel","pwaInstalled","browserFamily"]) PROP_KEYS.add(key);
NUMERIC_PROP_KEYS.add("workFxLevel"); INTEGER_COUNT_PROP_KEYS.add("workFxLevel");
SETTING_ENUM_VALUES.set("wealthTheme",new Set(["fixed","tiers","drawdown"]));
SETTING_ENUM_VALUES.set("workMode",new Set(["click","gamble"]));
SETTING_ENUM_VALUES.set("upgradeTutorial",new Set(["money","scripted"]));
SETTING_ENUM_VALUES.set("browserFamily",new Set(["ios-chrome","ios-safari","android","desktop"]));
const KNOWN_CARD_IDS = new Set([
  "ninety-1","ninety-2","ninety-3","ninety-4","sequence-boost-1","sequence-boost-2","skyline","break-the-sky","afterburner","work-income","roll-shift-1",
  ...["streak", "step", "drought", "shape", "momentum"].flatMap(prefix => [1, 2, 3, 4].map(n => `${prefix}-${n}`)),
  "flow-1", "flow-2", "flow-3", "flow-4", "risk-1", "risk-2",
  "rush-1", "rush-2", "linear-1", "linear-2",
  ...[50, 25, 10, 5, 4, 3, 2].map(n => `long-edge-${n}`),
  "edge-50", "edge-25", "edge-10", "edge-5", "edge-4", "edge-3", "edge-2",
  "odd-job", "even-money", "middle-management", "barbell-strategy", "number-go-up", "top-quarter",
  "quarterly-panic", "pennies-steamroller", "buy-the-dip", "fuelish-behavior", "bottom-feeder", "fifty-fifty-inc",
  "ten-bagger", "hot-hand-fallacy", "perfect-attendance", "black-swan-song", "running-on-empty", "barbell-capital",
  "five-percent-rule", "two-percent-solution", "trim-reaper", "overtime-pay", "rush-hour", "memory-leak",
  "one-percent-club", "two-percent-titan", "six-sigma", "index-fund", "black-hole-carry", "lowball-bailout",
]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

const finiteNumber = (value, minimum = -1e15, maximum = 1e15) =>
  typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;

const integer = (value, minimum, maximum) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;

const sanitizedNumber = (key, value) => {
  if(key==="finalBankroll")return finiteNumber(value,0,1e200);
  if (key === "revealRatio") return finiteNumber(value, 0.1, 2);
  if (key === "positionPriceBase") return integer(value, 1, 1e9);
  if (key === "positionPriceMultiplier") return finiteNumber(value, 1, 30);
  if (key === "speedPriceBase") return integer(value, 1, 1e6);
  if (key === "speedPriceMultiplier") return finiteNumber(value, 1.01, 2);
  if (["soundVolume", "lossVolume", "chargeVolume", "musicVolume"].includes(key)) return finiteNumber(value, 0, 1);
  if (key === "jackpotSpinGrant") return integer(value, 1, 1000);
  if (DURATION_PROP_KEYS.has(key)) return finiteNumber(value, 0, 30 * 24 * 60 * 60 * 1_000);
  if (INTEGER_COUNT_PROP_KEYS.has(key)
    || ["hitByCard", "spinByCard", "copySpinsByCard", "effectsByCard"].includes(key)) {
    return integer(value, 0, 100_000_000);
  }
  if (NONNEGATIVE_AMOUNT_PROP_KEYS.has(key)
    || ["wagerByCard", "payoutByCard", "penaltyByCard"].includes(key)) {
    return finiteNumber(value, 0, 1e15);
  }
  return finiteNumber(value);
};

const safeToken = (value) => typeof value === "string" && TOKEN_PATTERN.test(value) ? value : null;

const cleanSingleLine = (value) => typeof value === "string"
  ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim()
  : "";

const cleanMessage = (value) => typeof value === "string"
  ? value.normalize("NFC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim()
  : "";

const feedbackContext = (input,appVersion) => {
  const c=input.telemetryEnabled===true?input.context:null;
  if(!c || ![c.installId,c.runId,c.sessionId].every(id=>typeof id==="string"&&UUID_PATTERN.test(id)) || !acceptsTelemetry({appVersion,rulesetVersion:c.rulesetVersion}) || integer(c.activeMs,0,2592e6)===null || !c.snapshot || typeof c.snapshot!=="object" || Array.isArray(c.snapshot))return null;
  const snapshot=sanitizeProps(c.snapshot);
  return JSON.stringify(snapshot).length<=8000?{installId:c.installId,runId:c.runId,sessionId:c.sessionId,rulesetVersion:c.rulesetVersion,activeMs:c.activeMs,snapshot}:null;
};
for(const key of ["coinEnabled","coinStake","coinRounds","coinWins","coinWagered","coinPaid","rounds","winVisual","jackpotVisual","chartBackdrop"])PROP_KEYS.add(key);
for(const key of ["coinStake","coinRounds","coinWins","coinWagered","coinPaid","rounds"])NUMERIC_PROP_KEYS.add(key);
for(const key of ["coinRounds","coinWins","rounds"])INTEGER_COUNT_PROP_KEYS.add(key);
for(const key of ["winVisual","jackpotVisual"])SETTING_ENUM_VALUES.set(key,new Set(["classic","cash","gold","neon","confetti","mix","festival"]));
SETTING_ENUM_VALUES.set("chartBackdrop",new Set(["off","aurora","flow","pulse"]));
EVENT_NAMES.add("coin_batch");
const parseFeedback = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const category = input.category ?? "other";
  const identityMode = input.identityMode ?? (cleanSingleLine(input.displayName) ? "named" : "anonymous");
  if (!FEEDBACK_CATEGORIES.has(category) || !["anonymous", "named"].includes(identityMode)) return null;
  const message = cleanMessage(input.message);
  const displayName = cleanSingleLine(input.displayName);
  const replyContact = cleanSingleLine(input.replyContact);
  const appVersion = safeToken(input.appVersion);
  const context=feedbackContext(input,appVersion);
  const legacy = input.telemetryEnabled === undefined;
  const bankroll = finiteNumber(context?.snapshot.bankroll ?? (legacy ? input.bankroll ?? 0 : 0));
  const totalSpins = integer(context?.snapshot.totalSpins ?? (legacy ? input.totalSpins ?? 0 : 0), 0, 100_000_000);
  const totalDraws = integer(context?.snapshot.totalDraws ?? (legacy ? input.totalDraws ?? 0 : 0), 0, 100_000_000);
  const page = ["game", "spin", "deck", "collection"].includes(input.page ?? "game") ? input.page ?? "game" : null;
  if (Array.from(message).length < 3 || Array.from(message).length > 2000 || !appVersion || !["en", "ja"].includes(input.language)) return null;
  if (bankroll === null || totalSpins === null || totalDraws === null || page === null) return null;
  if (identityMode === "anonymous" && (displayName || replyContact)) return null;
  if (identityMode === "named" && (!displayName || Array.from(displayName).length > 32 || Array.from(replyContact).length > 160)) return null;
  return {
    category,
    identityMode,
    displayName: identityMode === "named" ? displayName : null,
    replyContact: identityMode === "named" && replyContact ? replyContact : null,
    message,
    appVersion,
    language: input.language,
    bankroll,
    totalSpins,
    totalDraws,
    page,
    context,
  };
};

const sanitizeNested = (value, parentKey, depth = 0) => {
  if (depth > 4 || value === null) return value === null ? null : undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return finiteNumber(value) ?? undefined;
  if (typeof value === "string") return safeToken(value) ?? undefined;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => parentKey === "rollBuckets"
    ? sanitizedNumber("roll1", item) ?? undefined
    : sanitizeNested(item, parentKey, depth + 1)).filter((item) => item !== undefined);
  if (typeof value !== "object") return undefined;
  const result = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    const allowedDynamicCardKey = DYNAMIC_CARD_MAPS.has(parentKey) && KNOWN_CARD_IDS.has(key);
    if (allowedDynamicCardKey) {
      const numeric = sanitizedNumber(parentKey, item);
      if (numeric !== null) result[key] = numeric;
      continue;
    }
    if (!allowedDynamicCardKey && !["id", "count", "copiesBefore", "rarity", "tier", "baseCost", "basePayout"].includes(key)) continue;
    if (key === "id" && ["deck", "copies", "offers"].includes(parentKey) && !KNOWN_CARD_IDS.has(item)) continue;
    const nested = NUMERIC_PROP_KEYS.has(key) || key === "count"
      ? sanitizedNumber(key, item) ?? undefined : sanitizeNested(item, key, depth + 1);
    if (nested !== undefined) result[key] = nested;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const sanitizeProps = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!PROP_KEYS.has(key)) continue;
    if(key==="soundAssignedAt" && (!Number.isSafeInteger(value) || value<=0 || value>Date.now()+86400000)) continue;
    if(key==="baccaratRounds" && (!Number.isSafeInteger(value) || value<0 || value>1e8)) continue;
    if(["sharedChart","probabilityUpgrades","baccarat","coinEnabled"].includes(key) && typeof value!=="boolean") continue;
    if (key === "chartWindowSpins" && (!Number.isInteger(value) || value < 1 || value > 1000)) continue;
    if (["fuelEnabled", "assistUsed", "bassMode", "jackpotAutoTab", "sharedSpin", "adaptiveMusic", "workCosmetics", "pwaInstalled"].includes(key) && typeof value !== "boolean") continue;
    if (["cardId", "chosenId"].includes(key) && !KNOWN_CARD_IDS.has(value)) continue;
    if (SETTING_ENUM_VALUES.has(key) && !SETTING_ENUM_VALUES.get(key).has(value)) continue;
    if (SETTING_NUMERIC_VALUES.has(key) && !SETTING_NUMERIC_VALUES.get(key).has(value)) continue;
    const sanitized = NUMERIC_PROP_KEYS.has(key) ? sanitizedNumber(key, value) ?? undefined : sanitizeNested(value, key);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
};

const parseEvent = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  if (!UUID_PATTERN.test(input.eventId) || !UUID_PATTERN.test(input.runId) || !UUID_PATTERN.test(input.sessionId)) return null;
  if (!EVENT_NAMES.has(input.eventName)) return null;
  const sequence = integer(input.sequence, 0, 100_000_000);
  const activeMs = integer(input.activeMs, 0, 30 * 24 * 60 * 60 * 1_000);
  const engagedMs = input.engagedMs === undefined ? 0 : integer(input.engagedMs, 0, 30 * 24 * 60 * 60 * 1_000);
  const schemaVersion = integer(input.schemaVersion, 1, 20);
  const appVersion = safeToken(input.appVersion);
  const rulesetVersion = safeToken(input.rulesetVersion);
  if (sequence === null || activeMs === null || engagedMs === null || schemaVersion === null || !appVersion || !rulesetVersion) return null;
  if (!['en', 'ja'].includes(input.language) || !['mobile', 'desktop'].includes(input.deviceClass) || !['small', 'medium', 'large'].includes(input.viewportClass)) return null;
  const props = sanitizeProps(input.props);
  const propsJson = JSON.stringify(props);
  if (propsJson.length > 20_000) return null;
  return {
    eventId: input.eventId, runId: input.runId, sessionId: input.sessionId, sequence, activeMs, engagedMs,
    eventName: input.eventName, appVersion, rulesetVersion, schemaVersion, debug: input.debug === true ? 1 : 0,
    language: input.language, deviceClass: input.deviceClass, viewportClass: input.viewportClass, props, propsJson,
  };
};

const bytesToHex = (bytes) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const playerHash = async (installId, secret) => {
  const encoder = new TextEncoder();
  if (secret) {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(installId)));
  }
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(installId)));
};

const modeFrom = (value) => value === "classic" ? "classic" : value === "deck" ? "deck" : null;
const integerFrom = (value, minimum, maximum) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
};

const leaderboard = async (db, mode, rulesetVersion) => {
  const result = await db.prepare(`SELECT id, nickname, mode, ruleset_version AS rulesetVersion, time_ms AS timeMs, spins, draws, bankruptcies, created_at AS createdAt
    FROM leaderboard_scores WHERE mode = ? AND ruleset_version = ? ORDER BY time_ms ASC, id ASC LIMIT 50`).bind(mode, rulesetVersion).all();
  return result.results ?? [];
};

const leaderboardApi = async (request, db, url) => {
  if (request.method === "GET") {
    const mode = modeFrom(url.searchParams.get("mode") ?? "deck");
    const rulesetVersion = leaderboardRulesetFrom(url.searchParams.get("rulesetVersion"));
    if (!mode || !rulesetVersion) return json({ error: "Unknown leaderboard mode or ruleset." }, 400);
    return json({ scores: await leaderboard(db, mode, rulesetVersion) });
  }
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  let input;
  try { input = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
  const nickname = typeof input.nickname === "string" ? input.nickname.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  const mode = modeFrom(input.mode);
  const rulesetVersion = leaderboardRulesetFrom(input.rulesetVersion);
  const timeMs = integerFrom(input.timeMs, 1_000, 14 * 24 * 60 * 60 * 1_000);
  const spins = integerFrom(input.spins, 0, 100_000_000);
  const draws = integerFrom(input.draws, 0, 10_000);
  const bankruptcies = integerFrom(input.bankruptcies, 0, 100_000);
  if (!nickname || Array.from(nickname).length > 16 || !mode || !rulesetVersion || timeMs === null || spins === null || draws === null || bankruptcies === null) return json({ error: "Invalid score." }, 400);
  await db.prepare(`INSERT INTO leaderboard_scores (nickname, mode, ruleset_version, time_ms, spins, draws, bankruptcies) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(nickname, mode, rulesetVersion, timeMs, spins, draws, bankruptcies).run();
  return json({ ok: true, scores: await leaderboard(db, mode, rulesetVersion) }, 201);
};

const milestoneColumns = {
  baseline_deployed: "first_baseline_ms",
  first_work: "first_work_ms",
  first_agents_on: "first_agents_ms",
  first_spin: "first_spin_ms",
  first_win: "first_win_ms",
  first_draft: "first_draft_ms",
  first_special_owned: "first_special_ms",
  first_special_deployed: "first_special_deployed_ms",
  first_upgrade: "first_upgrade_ms",
  first_duplicate: "first_duplicate_ms",
  first_jackpot: "first_jackpot_ms",
};

const updateRun = async (db, playerId, events) => {
  const first = events[0];
  const last = events.at(-1);
  await db.prepare(`INSERT INTO telemetry_runs
      (run_id, player_id, first_session_id, app_version, ruleset_version, debug, language, device_class, active_ms, engaged_ms, last_event)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        last_seen_at = unixepoch(), active_ms = MAX(telemetry_runs.active_ms, excluded.active_ms),
        engaged_ms = MAX(telemetry_runs.engaged_ms, excluded.engaged_ms),
        debug = MAX(telemetry_runs.debug, excluded.debug),
        app_version = CASE WHEN excluded.active_ms >= telemetry_runs.active_ms THEN excluded.app_version ELSE telemetry_runs.app_version END,
        ruleset_version = CASE WHEN excluded.active_ms >= telemetry_runs.active_ms THEN excluded.ruleset_version ELSE telemetry_runs.ruleset_version END,
        language = CASE WHEN excluded.active_ms >= telemetry_runs.active_ms THEN excluded.language ELSE telemetry_runs.language END,
        device_class = CASE WHEN excluded.active_ms >= telemetry_runs.active_ms THEN excluded.device_class ELSE telemetry_runs.device_class END,
        last_event = CASE WHEN excluded.active_ms >= telemetry_runs.active_ms THEN excluded.last_event ELSE telemetry_runs.last_event END`)
    .bind(first.runId, playerId, first.sessionId, last.appVersion, last.rulesetVersion, Math.max(...events.map((event) => event.debug)), last.language, last.deviceClass, last.activeMs, last.engagedMs, last.eventName).run();

  const snapshots = events.filter((event) => event.eventName === "snapshot");
  const snapshot = snapshots.reduce((latest, event) => !latest
    || event.activeMs > latest.activeMs
    || (event.activeMs === latest.activeMs && event.engagedMs > latest.engagedMs) ? event : latest, null);
  if (snapshot) {
    const props = snapshot.props;
    await db.prepare(`UPDATE telemetry_runs SET
        snapshot_active_ms = MAX(snapshot_active_ms, ?), active_ms = MAX(active_ms, ?), engaged_ms = MAX(engaged_ms, ?),
        bankroll = ?, peak_bankroll = MAX(peak_bankroll, ?), fuel = ?, fuel_capacity = ?,
        slot_count = ?, spin_speed_level = ?, total_spins = MAX(total_spins, ?), total_draws = MAX(total_draws, ?),
        total_work = MAX(total_work, ?), bankruptcies = MAX(bankruptcies, ?), cleared = MAX(cleared, ?),
        final_status = ?, deck_json = ?, copies_json = ?, last_seen_at = unixepoch()
      WHERE run_id = ? AND ? >= snapshot_active_ms`)
      .bind(snapshot.activeMs, snapshot.activeMs, snapshot.engagedMs,
        finiteNumber(props.bankroll) ?? 0, finiteNumber(props.peakBankroll, 0) ?? 0,
        finiteNumber(props.fuel, 0) ?? 0, integer(props.fuelCapacity, 0, 10_000) ?? 0,
        integer(props.slotCount, 0, 1_000) ?? 0, integer(props.spinSpeedLevel, 0, 10_000) ?? 0,
        integer(props.totalSpins, 0, 100_000_000) ?? 0, integer(props.totalDraws, 0, 1_000_000) ?? 0,
        integer(props.totalWork, 0, 100_000_000) ?? 0, integer(props.bankruptcies, 0, 1_000_000) ?? 0,
        props.cleared === true ? 1 : 0, safeToken(props.status) ?? "unknown",
        JSON.stringify(Array.isArray(props.deck) ? props.deck : []), JSON.stringify(Array.isArray(props.copies) ? props.copies : []),
        first.runId, snapshot.activeMs).run();
  }

  for (const event of events) {
    if (event.eventName !== "milestone") continue;
    const column = milestoneColumns[event.props.name];
    if (!column) continue;
    await db.prepare(`UPDATE telemetry_runs SET ${column} = CASE WHEN ${column} IS NULL OR ? < ${column} THEN ? ELSE ${column} END WHERE run_id = ?`)
      .bind(event.activeMs, event.activeMs, event.runId).run();
  }
  const interaction = events.filter((event) => event.eventName === "interaction_start").at(0);
  if (interaction) {
    await db.prepare(`UPDATE telemetry_runs SET first_interaction_ms = CASE
      WHEN first_interaction_ms IS NULL OR ? < first_interaction_ms THEN ? ELSE first_interaction_ms END WHERE run_id = ?`)
      .bind(interaction.activeMs, interaction.activeMs, interaction.runId).run();
  }
  const derivedSpecialDeploy = events.flatMap((event) => {
    if (event.eventName === "deck_change" && Number(event.props.deployed) > 0
      && typeof event.props.cardId === "string" && !event.props.cardId.startsWith("edge-")) return [event.activeMs];
    if (!["deck_preset", "spin_batch"].includes(event.eventName) || !Array.isArray(event.props.deck)) return [];
    return event.props.deck.some((row) => Number(row?.count) > 0 && typeof row?.id === "string" && !row.id.startsWith("edge-"))
      ? [event.activeMs] : [];
  }).sort((a, b) => a - b).at(0);
  if (Number.isFinite(derivedSpecialDeploy)) {
    await db.prepare(`UPDATE telemetry_runs SET first_special_deployed_ms = CASE
      WHEN first_special_deployed_ms IS NULL OR ? < first_special_deployed_ms THEN ? ELSE first_special_deployed_ms END WHERE run_id = ?`)
      .bind(derivedSpecialDeploy, derivedSpecialDeploy, first.runId).run();
  }
  const clear = events.filter((event) => event.eventName === "clear").at(0);
  if (clear) {
    await db.prepare(`UPDATE telemetry_runs SET cleared = 1, final_status = 'cleared',
      clear_engaged_ms = CASE WHEN clear_active_ms IS NULL OR ? < clear_active_ms THEN ? ELSE clear_engaged_ms END,
      clear_wall_ms = CASE WHEN clear_active_ms IS NULL OR ? < clear_active_ms THEN ? ELSE clear_wall_ms END,
      clear_active_ms = CASE WHEN clear_active_ms IS NULL OR ? < clear_active_ms THEN ? ELSE clear_active_ms END
      WHERE run_id = ?`)
      .bind(clear.activeMs, clear.engagedMs, clear.activeMs,
        integer(clear.props.wallTimeMs, 0, 14 * 24 * 60 * 60 * 1_000),
        clear.activeMs, clear.activeMs, clear.runId).run();
  }
};

const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const refreshRecentRun = async (db, runId) => {
  const run = await db.prepare(`SELECT * FROM telemetry_runs WHERE run_id = ?`).bind(runId).first();
  if (!run) return;
  const recentResult = await db.prepare(`SELECT event_id, active_ms, engaged_ms, event_name, props_json FROM telemetry_events
    WHERE run_id = ? AND event_name != 'snapshot' ORDER BY active_ms DESC, received_at DESC LIMIT 40`).bind(runId).all();
  const earlyResult = await db.prepare(`SELECT event_id, active_ms, engaged_ms, event_name, props_json FROM telemetry_events
    WHERE run_id = ? AND event_name != 'snapshot' ORDER BY active_ms ASC, received_at ASC LIMIT 20`).bind(runId).all();
  const byId = new Map();
  [...(earlyResult.results ?? []), ...(recentResult.results ?? [])].forEach((event) => byId.set(event.event_id, event));
  const timeline = [...byId.values()].sort((a, b) => a.active_ms - b.active_ms).map((event) => {
    const props = parseJson(event.props_json, {});
    const detail = {};
    for (const key of ["name", "reason", "resolution", "durationMs", "engagedDurationMs", "action", "kind", "code", "cardId", "chosenId", "price", "bankroll", "profit", "spins", "drawIndex", "builds"]) {
      if (props[key] !== undefined) detail[key] = props[key];
    }
    return { t: event.active_ms, engaged: event.engaged_ms, event: event.event_name, detail };
  });
  const milestones = Object.fromEntries(Object.entries({
    interaction: run.first_interaction_ms, baseline: run.first_baseline_ms, work: run.first_work_ms,
    agents: run.first_agents_ms, spin: run.first_spin_ms, win: run.first_win_ms, draft: run.first_draft_ms,
    special: run.first_special_ms, specialDeployed: run.first_special_deployed_ms, upgrade: run.first_upgrade_ms,
    duplicate: run.first_duplicate_ms, jackpot: run.first_jackpot_ms, clearActive: run.clear_active_ms,
    clearEngaged: run.clear_engaged_ms, clearWall: run.clear_wall_ms,
  }).filter(([, value]) => value !== null));
  await db.prepare(`INSERT INTO telemetry_recent_runs
      (run_id, player_short, ruleset_version, started_at, last_seen_at, active_ms, final_status, bankroll, peak_bankroll,
       total_spins, total_draws, total_work, cleared, debug, milestones_json, deck_json, copies_json, timeline_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
       ruleset_version=excluded.ruleset_version,
       last_seen_at=excluded.last_seen_at, active_ms=excluded.active_ms, final_status=excluded.final_status,
       bankroll=excluded.bankroll, peak_bankroll=excluded.peak_bankroll, total_spins=excluded.total_spins,
       total_draws=excluded.total_draws, total_work=excluded.total_work, cleared=excluded.cleared, debug=excluded.debug,
       milestones_json=excluded.milestones_json, deck_json=excluded.deck_json, copies_json=excluded.copies_json,
       timeline_json=excluded.timeline_json`)
    .bind(run.run_id, String(run.player_id).slice(0, 10), run.ruleset_version, run.started_at, run.last_seen_at, run.active_ms,
      run.final_status, run.bankroll, run.peak_bankroll, run.total_spins, run.total_draws, run.total_work, run.cleared, run.debug,
      JSON.stringify(milestones), run.deck_json, run.copies_json, JSON.stringify(timeline)).run();
};

const percentile = (values, proportion) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = (sorted.length - 1) * proportion;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high ? sorted[low] : sorted[low] * (high - index) + sorted[high] * (index - low);
};

const distribution = (values) => ({
  n: values.filter(Number.isFinite).length,
  p25: percentile(values, 0.25),
  median: percentile(values, 0.5),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.9),
});

const saveReport = (db, ruleset, name, sampleSize, payload) => db.prepare(`INSERT INTO telemetry_reports
    (report_key, ruleset_version, sample_size, payload_json, updated_at) VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(report_key) DO UPDATE SET ruleset_version=excluded.ruleset_version, sample_size=excluded.sample_size,
    payload_json=excluded.payload_json, updated_at=excluded.updated_at`)
  .bind(`${ruleset}:${name}`, ruleset, sampleSize, JSON.stringify(payload));

const BUILD_REQUIREMENTS = {
  "full-coverage": ["odd-job", "even-money"],
  "crash-hedge": ["pennies-steamroller", "bottom-feeder"],
  "reversal-stack": ["bottom-feeder", "buy-the-dip", "top-quarter"],
  "jackpot-loop": ["trim-reaper", "rush-hour", "memory-leak"],
};

const buildsFromDeck = (deck) => {
  const deployed = new Set((Array.isArray(deck) ? deck : []).filter((row) => Number(row?.count) > 0).map((row) => row.id));
  return Object.entries(BUILD_REQUIREMENTS).filter(([, ids]) => ids.every((id) => deployed.has(id))).map(([id]) => id);
};

const increment = (target, key, amount = 1) => { target[key] = (target[key] ?? 0) + amount; };

const maxCountInWindow = (values, windowMs) => {
  const sorted = [...values].sort((a, b) => a - b);
  let left = 0;
  let maximum = 0;
  for (let right = 0; right < sorted.length; right += 1) {
    while (sorted[right] - sorted[left] > windowMs) left += 1;
    maximum = Math.max(maximum, right - left + 1);
  }
  return maximum;
};

const refreshReports = async (db, ruleset) => {
  const runResult = await db.prepare(`SELECT * FROM telemetry_runs WHERE ruleset_version = ? AND debug = 0
    AND last_seen_at >= unixepoch() - 2592000 ORDER BY started_at DESC LIMIT 500`).bind(ruleset).all();
  const eventResult = await db.prepare(`SELECT event_id, run_id, session_id, event_name, active_ms, engaged_ms,
      app_version, schema_version, props_json, received_at
    FROM telemetry_events WHERE ruleset_version = ? AND debug = 0 AND received_at >= unixepoch() - 2592000
    ORDER BY received_at DESC LIMIT 10000`).bind(ruleset).all();
  const runs = runResult.results ?? [];
  const rawEvents = (eventResult.results ?? []).map((event) => ({ ...event, props: parseJson(event.props_json, {}) }));
  const runIds = new Set(runs.map((run) => run.run_id));
  const events = rawEvents.filter((event) => runIds.has(event.run_id));
  const engagedRuns = runs.filter((run) => run.first_interaction_ms !== null
    || Number(run.total_work) > 0 || Number(run.total_spins) > 0 || Number(run.total_draws) > 0
    || run.first_baseline_ms !== null || Number(run.cleared) > 0);
  const engagedIds = new Set(engagedRuns.map((run) => run.run_id));
  const engagedEvents = events.filter((event) => engagedIds.has(event.run_id));
  const instrumentedEvents = engagedEvents.filter((event) => Number(event.schema_version) >= 2);
  const instrumentedIds = new Set(instrumentedEvents.map((event) => event.run_id));
  const instrumentedRuns = engagedRuns.filter((run) => instrumentedIds.has(run.run_id));
  const freshInstrumentedIds = new Set(instrumentedEvents.filter((event) => event.event_name === "session_start"
    && ["fresh", "new_run"].includes(event.props.entryKind)).map((event) => event.run_id));
  const onboardingRuns = instrumentedRuns.filter((run) => freshInstrumentedIds.has(run.run_id));
  const sessionActionNames = new Set([
    "interaction_start", "work_batch", "agents_toggle", "spin_batch", "draft_offer", "draft_choose",
    "deck_change", "deck_preset", "upgrade_purchase", "bankruptcy", "reset", "clear",
  ]);
  const engagedSessionIds = new Set(events.filter((event) => sessionActionNames.has(event.event_name)).map((event) => event.session_id));
  const players = new Set(runs.map((run) => run.player_id));
  const engagedPlayers = new Set(engagedRuns.map((run) => run.player_id));
  const snapshots = engagedEvents.filter((event) => event.event_name === "snapshot").sort((a, b) => a.active_ms - b.active_ms);

  const milestoneEvents = new Map();
  engagedEvents.filter((event) => event.event_name === "milestone").forEach((event) => {
    const key = `${event.run_id}:${event.props.name}`;
    if (!milestoneEvents.has(key) || event.active_ms < milestoneEvents.get(key)) milestoneEvents.set(key, event.active_ms);
  });
  engagedEvents.filter((event) => event.event_name === "clear").forEach((event) => {
    const key = `${event.run_id}:clear`;
    if (!milestoneEvents.has(key) || event.active_ms < milestoneEvents.get(key)) milestoneEvents.set(key, event.active_ms);
  });
  engagedEvents.filter((event) => event.event_name === "upgrade_purchase").forEach((event) => {
    const key = `${event.run_id}:first_upgrade`;
    if (!milestoneEvents.has(key) || event.active_ms < milestoneEvents.get(key)) milestoneEvents.set(key, event.active_ms);
  });
  const milestoneTime = (run, column, name) => {
    if (run[column] !== null && run[column] !== undefined) return Number(run[column]);
    return milestoneEvents.get(`${run.run_id}:${name}`) ?? null;
  };

  const clearActiveTimes = engagedRuns.map((run) => run.clear_active_ms === null ? null : Number(run.clear_active_ms)).filter(Number.isFinite);
  const clearEngagedTimes = engagedRuns.map((run) => run.clear_engaged_ms === null ? null : Number(run.clear_engaged_ms)).filter(Number.isFinite);
  const clearWallTimes = engagedRuns.map((run) => run.clear_wall_ms === null ? null : Number(run.clear_wall_ms)).filter(Number.isFinite);
  const overview = {
    generatedAt: Math.floor(Date.now() / 1000),
    observedRuns: runs.length,
    passiveRuns: runs.length - engagedRuns.length,
    engagedRuns: engagedRuns.length,
    players: players.size,
    engagedPlayers: engagedPlayers.size,
    sessions: new Set(events.map((event) => event.session_id)).size,
    engagedSessions: engagedSessionIds.size,
    spunRuns: engagedRuns.filter((run) => Number(run.total_spins) > 0).length,
    draftedRuns: engagedRuns.filter((run) => Number(run.total_draws) > 0).length,
    clears: engagedRuns.filter((run) => Number(run.cleared) > 0).length,
    bankruptcyRuns: engagedRuns.filter((run) => Number(run.bankruptcies) > 0).length,
    activeMinutes: engagedRuns.reduce((sum, run) => sum + Number(run.active_ms || 0), 0) / 60_000,
    engagedMinutes: engagedRuns.reduce((sum, run) => sum + Number(run.engaged_ms || 0), 0) / 60_000,
    totalSpins: engagedRuns.reduce((sum, run) => sum + Number(run.total_spins || 0), 0),
    totalDraws: engagedRuns.reduce((sum, run) => sum + Number(run.total_draws || 0), 0),
    totalWork: engagedRuns.reduce((sum, run) => sum + Number(run.total_work || 0), 0),
    activeTimeMs: distribution(engagedRuns.map((run) => Number(run.active_ms))),
    engagedTimeMs: distribution(engagedRuns.map((run) => Number(run.engaged_ms)).filter((value) => value > 0)),
    clearActiveTimeMs: distribution(clearActiveTimes),
    clearEngagedTimeMs: distribution(clearEngagedTimes),
    clearWallTimeMs: distribution(clearWallTimes),
    finalBankroll: distribution(engagedRuns.map((run) => Number(run.bankroll))),
  };

  const funnelDefinition = [
    ["interaction", "first_interaction_ms", "first_interaction"],
    ["baseline_deployed", "first_baseline_ms", "baseline_deployed"],
    ["first_work", "first_work_ms", "first_work"],
    ["agents_on", "first_agents_ms", "first_agents_on"],
    ["first_spin", "first_spin_ms", "first_spin"],
    ["first_win", "first_win_ms", "first_win"],
    ["first_draft", "first_draft_ms", "first_draft"],
    ["special_owned", "first_special_ms", "first_special_owned"],
    ["special_deployed", "first_special_deployed_ms", "first_special_deployed"],
    ["first_upgrade", "first_upgrade_ms", "first_upgrade"],
    ["duplicate", "first_duplicate_ms", "first_duplicate"],
    ["jackpot", "first_jackpot_ms", "first_jackpot"],
    ["clear", "clear_active_ms", "clear"],
  ];
  const funnel = Object.fromEntries(funnelDefinition.map(([name, column, milestone]) => {
    const eligibleRuns = onboardingRuns;
    const values = eligibleRuns.map((run) => milestoneTime(run, column, milestone)).filter(Number.isFinite);
    const within30 = values.filter((value) => value <= 1_800_000);
    return [name, {
      eligibleRuns: eligibleRuns.length,
      reachedEver: values.length,
      reachedWithin30m: within30.length,
      rateWithin30m: eligibleRuns.length ? within30.length / eligibleRuns.length : 0,
      activeMsWithin30m: distribution(within30),
      activeMsEver: distribution(values),
    }];
  }));
  const sequenceViolations = onboardingRuns.filter((run) => {
    const baseline = milestoneTime(run, "first_baseline_ms", "baseline_deployed");
    const agents = milestoneTime(run, "first_agents_ms", "first_agents_on");
    const spin = milestoneTime(run, "first_spin_ms", "first_spin");
    return (Number.isFinite(baseline) && Number.isFinite(agents) && baseline > agents)
      || (Number.isFinite(agents) && Number.isFinite(spin) && agents > spin);
  }).length;
  const onboarding = {
    denominator: "fresh_schema_v2_engaged_runs",
    excludedResumedInstrumentedRuns: instrumentedRuns.length - onboardingRuns.length,
    horizonMs: 1_800_000,
    funnel,
    sequenceViolations,
    howToOpens: instrumentedEvents.filter((event) => event.event_name === "how_to_open").length,
  };

  const thresholds = [60_000, 180_000, 300_000, 600_000, 1_200_000, 1_800_000];
  const snapshotsByRun = new Map();
  snapshots.forEach((event) => {
    const list = snapshotsByRun.get(event.run_id) ?? [];
    list.push(event);
    snapshotsByRun.set(event.run_id, list);
  });
  const economy = Object.fromEntries(thresholds.map((threshold) => {
    const eligible = onboardingRuns.filter((run) => Number(run.active_ms) >= threshold);
    const observations = eligible.flatMap((run) => {
      const prior = (snapshotsByRun.get(run.run_id) ?? []).filter((event) => event.active_ms <= threshold).at(-1);
      return prior ? [prior] : [];
    });
    return [`minute_${threshold / 60_000}`, {
      eligibleRuns: eligible.length,
      observedRuns: observations.length,
      bankroll: distribution(observations.map((event) => Number(event.props.bankroll))),
      peakBankroll: distribution(observations.map((event) => Number(event.props.peakBankroll))),
      spins: distribution(observations.map((event) => Number(event.props.totalSpins))),
      draws: distribution(observations.map((event) => Number(event.props.totalDraws))),
      work: distribution(observations.map((event) => Number(event.props.totalWork))),
      speedLevel: distribution(observations.map((event) => Number(event.props.spinSpeedLevel))),
    }];
  }));

  const offerEvents = instrumentedEvents.filter((event) => event.event_name === "draft_offer").sort((a, b) => a.active_ms - b.active_ms);
  const chooseEvents = instrumentedEvents.filter((event) => event.event_name === "draft_choose").sort((a, b) => a.active_ms - b.active_ms);
  const pullsByRun = new Map(onboardingRuns.map((run) => [run.run_id, 0]));
  const pullTimesByRun = new Map(onboardingRuns.map((run) => [run.run_id, []]));
  chooseEvents.forEach((event) => {
    if (!pullsByRun.has(event.run_id)) return;
    pullsByRun.set(event.run_id, (pullsByRun.get(event.run_id) ?? 0) + 1);
    (pullTimesByRun.get(event.run_id) ?? []).push(event.active_ms);
  });
  const offerByTransaction = new Map();
  offerEvents.forEach((event) => offerByTransaction.set(`${event.run_id}:${event.props.transactionId}`, event));
  const choiceDelays = chooseEvents.flatMap((event) => {
    const offer = offerByTransaction.get(`${event.run_id}:${event.props.transactionId}`);
    return offer ? [Math.max(0, event.active_ms - offer.active_ms)] : [];
  });
  const interPullGaps = [];
  for (const times of pullTimesByRun.values()) {
    times.sort((a, b) => a - b);
    for (let index = 1; index < times.length; index += 1) interPullGaps.push(times[index] - times[index - 1]);
  }
  const rarityChoices = {};
  const optionChoices = {};
  chooseEvents.forEach((event) => {
    if (event.props.rarity) increment(rarityChoices, event.props.rarity);
    if (Number.isFinite(Number(event.props.offerIndex))) increment(optionChoices, String(event.props.offerIndex));
  });
  const gacha = {
    cohort: "schema_v2_observation_events_with_fresh_run_distributions",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    offers: offerEvents.length,
    choices: chooseEvents.length,
    freshRunsWithChoice: [...pullsByRun.values()].filter((count) => count > 0).length,
    closesWithPendingChoice: instrumentedEvents.filter((event) => event.event_name === "draft_close" && event.props.pendingChoice === true).length,
    duplicateChoices: chooseEvents.filter((event) => event.props.duplicate === true).length,
    pullsPerFreshRun: distribution([...pullsByRun.values()]),
    pullsWithin10m: distribution(onboardingRuns.map((run) => (pullTimesByRun.get(run.run_id) ?? []).filter((time) => time <= 600_000).length)),
    pullsWithin30m: distribution(onboardingRuns.map((run) => (pullTimesByRun.get(run.run_id) ?? []).filter((time) => time <= 1_800_000).length)),
    firstPullMs: distribution([...pullTimesByRun.values()].flatMap((times) => times.length ? [Math.min(...times)] : [])),
    firstDuplicateMs: distribution([...chooseEvents.filter((event) => freshInstrumentedIds.has(event.run_id)
      && event.props.duplicate === true).reduce((map, event) => {
      if (!map.has(event.run_id)) map.set(event.run_id, event.active_ms);
      return map;
    }, new Map()).values()]),
    choiceDelayMs: distribution(choiceDelays),
    interPullGapMs: distribution(interPullGaps),
    maxChoicesIn60s: distribution([...pullTimesByRun.values()].map((times) => maxCountInWindow(times, 60_000))),
    priceToCashRatio: distribution(offerEvents.map((event) => Number(event.props.price) / Math.max(1, Number(event.props.bankrollBefore)))),
    rarityChoices,
    optionChoices,
  };

  const workEvents = instrumentedEvents.filter((event) => event.event_name === "work_batch");
  const workPhases = [
    ["minute_0_5", 0, 300_000],
    ["minute_5_10", 300_000, 600_000],
    ["minute_10_30", 600_000, 1_800_000],
    ["after_30m", 1_800_000, Infinity],
  ];
  const workByPhase = Object.fromEntries(workPhases.map(([name, start, end]) => {
    const byRun = new Map();
    workEvents.filter((event) => event.active_ms >= start && event.active_ms < end)
      .forEach((event) => byRun.set(event.run_id, (byRun.get(event.run_id) ?? 0) + Number(event.props.clicks || 0)));
    const requiredExposure = Number.isFinite(end) ? end : start;
    const eligibleRuns = onboardingRuns.filter((run) => Number(run.active_ms) >= requiredExposure);
    return [name, { eligibleRuns: eligibleRuns.length, clicks: distribution(eligibleRuns.map((run) => byRun.get(run.run_id) ?? 0)) }];
  }));
  const workBeforeFirstSpin = onboardingRuns.flatMap((run) => {
    const firstSpin = milestoneTime(run, "first_spin_ms", "first_spin");
    if (!Number.isFinite(firstSpin)) return [];
    return [workEvents.filter((event) => event.run_id === run.run_id && event.active_ms <= firstSpin)
      .reduce((sum, event) => sum + Number(event.props.clicks || 0), 0)];
  });
  const potentialCompute = workEvents.reduce((sum, event) => sum + Number(event.props.potentialCompute || 0), 0);
  const wastedCompute = workEvents.reduce((sum, event) => sum + Number(event.props.wastedCompute || 0), 0);
  const measuredWorkByRun = new Map(instrumentedRuns.map((run) => [run.run_id, 0]));
  workEvents.forEach((event) => measuredWorkByRun.set(event.run_id,
    (measuredWorkByRun.get(event.run_id) ?? 0) + Number(event.props.clicks || 0)));
  const measuredSpinsByRun = new Map(instrumentedRuns.map((run) => [run.run_id, 0]));
  instrumentedEvents.filter((event) => event.event_name === "spin_batch").forEach((event) => measuredSpinsByRun.set(event.run_id,
    (measuredSpinsByRun.get(event.run_id) ?? 0) + Number(event.props.spins || 0)));
  const workReport = {
    cohort: "schema_v2_observation_events_with_fresh_run_distributions",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    clicksPerFreshRun: distribution(onboardingRuns.map((run) => measuredWorkByRun.get(run.run_id) ?? 0)),
    clicksBeforeFirstSpin: distribution(workBeforeFirstSpin),
    workToSpinRatio: distribution([...measuredSpinsByRun.entries()].filter(([runId, spins]) => freshInstrumentedIds.has(runId) && spins > 0)
      .map(([runId, spins]) => (measuredWorkByRun.get(runId) ?? 0) / spins)),
    clicksByActivePhase: workByPhase,
    potentialCompute,
    wastedCompute,
    computeWasteRate: potentialCompute > 0 ? wastedCompute / potentialCompute : 0,
  };

  const waitEnters = instrumentedEvents.filter((event) => event.event_name === "wait_enter");
  const waitExits = instrumentedEvents.filter((event) => event.event_name === "wait_exit");
  const exitsById = new Set(waitExits.map((event) => event.props.waitId).filter(Boolean));
  const waitReasons = {};
  for (const event of waitEnters) {
    const reason = event.props.reason ?? "unknown";
    waitReasons[reason] ??= { enters: 0, exits: 0, activeDurations: [], engagedDurations: [], workClicks: 0, resolutions: {} };
    waitReasons[reason].enters += 1;
  }
  for (const event of waitExits) {
    const reason = event.props.reason ?? "unknown";
    waitReasons[reason] ??= { enters: 0, exits: 0, activeDurations: [], engagedDurations: [], workClicks: 0, resolutions: {} };
    waitReasons[reason].exits += 1;
    waitReasons[reason].activeDurations.push(Number(event.props.durationMs));
    if (Number.isFinite(Number(event.props.engagedDurationMs))) waitReasons[reason].engagedDurations.push(Number(event.props.engagedDurationMs));
    waitReasons[reason].workClicks += Number(event.props.workClicksDuringWait || 0);
    increment(waitReasons[reason].resolutions, event.props.resolution ?? "unknown");
  }
  const summarizedWaitReasons = Object.fromEntries(Object.entries(waitReasons).map(([reason, value]) => [reason, {
    enters: value.enters,
    exits: value.exits,
    activeDurationMs: distribution(value.activeDurations),
    engagedDurationMs: distribution(value.engagedDurations),
    workClicks: value.workClicks,
    resolutions: value.resolutions,
  }]));
  const friction = {
    cohort: "schema_v2_observation_events",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    waitReasons: summarizedWaitReasons,
    unmatchedWaitEnters: waitEnters.filter((event) => !event.props.waitId || !exitsById.has(event.props.waitId)).length,
    resets: instrumentedEvents.filter((event) => event.event_name === "reset").length,
    bankruptcies: instrumentedEvents.filter((event) => event.event_name === "bankruptcy").length,
    noBaselineRuns: onboardingRuns.filter((run) => milestoneTime(run, "first_baseline_ms", "baseline_deployed") === null).length,
    noSpinRuns: onboardingRuns.filter((run) => milestoneTime(run, "first_spin_ms", "first_spin") === null).length,
    draftWithoutSpecialRuns: onboardingRuns.filter((run) => milestoneTime(run, "first_draft_ms", "first_draft") !== null
      && milestoneTime(run, "first_special_ms", "first_special_owned") === null).length,
  };

  const cardStats = {};
  const ensureCard = (id) => {
    cardStats[id] ??= {
      cardId: id, offered: 0, chosen: 0, duplicateChoices: 0, chosenRuns: new Set(), deployedRuns: new Set(),
      spinExposures: 0, copySpinExposures: 0, hits: 0, wager: 0, payout: 0, penalty: 0, profit: 0,
      effectTriggers: 0, economyBatches: 0, firstChoices: new Map(), firstDeployments: new Map(),
    };
    return cardStats[id];
  };
  offerEvents.forEach((event) => (Array.isArray(event.props.offers) ? event.props.offers : []).forEach((offer) => {
    if (offer?.id) ensureCard(offer.id).offered += 1;
  }));
  chooseEvents.forEach((event) => {
    if (!event.props.chosenId) return;
    const card = ensureCard(event.props.chosenId);
    card.chosen += 1;
    card.duplicateChoices += Number(event.props.duplicate === true);
    card.chosenRuns.add(event.run_id);
    if (!card.firstChoices.has(event.run_id) || event.active_ms < card.firstChoices.get(event.run_id)) {
      card.firstChoices.set(event.run_id, event.active_ms);
    }
  });
  const spinEvents = instrumentedEvents.filter((event) => event.event_name === "spin_batch");
  const dynamicCardFields = {
    hitByCard: "hits", wagerByCard: "wager", payoutByCard: "payout", penaltyByCard: "penalty",
    profitByCard: "profit", effectsByCard: "effectTriggers",
  };
  spinEvents.forEach((event) => {
    const spins = Number(event.props.spins || 0);
    const deck = Array.isArray(event.props.deck) ? event.props.deck : [];
    deck.forEach((row) => {
      if (!row?.id) return;
      const card = ensureCard(row.id);
      card.deployedRuns.add(event.run_id);
      card.spinExposures += spins;
      card.copySpinExposures += spins * Number(row.count || 0);
      if (!card.firstDeployments.has(event.run_id) || event.active_ms < card.firstDeployments.get(event.run_id)) {
        card.firstDeployments.set(event.run_id, event.active_ms);
      }
    });
    for (const [source, target] of Object.entries(dynamicCardFields)) {
      const values = event.props[source];
      if (!values || typeof values !== "object") continue;
      for (const [id, amount] of Object.entries(values)) {
        const card = ensureCard(id);
        card[target] += Number(amount || 0);
        if (source === "wagerByCard") card.economyBatches += 1;
      }
    }
  });
  instrumentedEvents.filter((event) => event.event_name === "deck_change" && Number(event.props.deployed) > 0).forEach((event) => {
    if (!event.props.cardId) return;
    const card = ensureCard(event.props.cardId);
    card.deployedRuns.add(event.run_id);
    if (!card.firstDeployments.has(event.run_id) || event.active_ms < card.firstDeployments.get(event.run_id)) {
      card.firstDeployments.set(event.run_id, event.active_ms);
    }
  });
  instrumentedEvents.filter((event) => event.event_name === "snapshot").forEach((event) => {
    (Array.isArray(event.props.deck) ? event.props.deck : []).forEach((row) => {
      if (!row?.id || Number(row.count) <= 0) return;
      const card = ensureCard(row.id);
      card.deployedRuns.add(event.run_id);
      if (!card.firstDeployments.has(event.run_id) || event.active_ms < card.firstDeployments.get(event.run_id)) {
        card.firstDeployments.set(event.run_id, event.active_ms);
      }
    });
  });

  const cardRows = Object.values(cardStats).map((card) => {
    const latencies = [...card.firstChoices.entries()].flatMap(([runId, chosenAt]) => {
      const deployedAt = card.firstDeployments.get(runId);
      return Number.isFinite(deployedAt) && deployedAt >= chosenAt ? [deployedAt - chosenAt] : [];
    });
    return {
      cardId: card.cardId,
      offered: card.offered,
      chosen: card.chosen,
      duplicateChoices: card.duplicateChoices,
      chosenRuns: card.chosenRuns.size,
      deployedRuns: card.deployedRuns.size,
      chosenNeverDeployedRuns: [...card.chosenRuns].filter((runId) => !card.deployedRuns.has(runId)).length,
      spinExposures: card.spinExposures,
      copySpinExposures: card.copySpinExposures,
      hits: card.hits,
      wager: card.wager,
      payout: card.payout,
      penalty: card.penalty,
      profit: card.profit,
      effectTriggers: card.effectTriggers,
      economyBatches: card.economyBatches,
      firstDeployMedianMs: percentile([...card.firstDeployments.values()], 0.5),
      acquisitionToDeployMedianMs: percentile(latencies, 0.5),
      choiceRate: card.offered ? card.chosen / card.offered : 0,
    };
  });

  const buildStats = Object.fromEntries(Object.keys(BUILD_REQUIREMENTS).map((id) => [id, {
    buildId: id, deployedRuns: new Set(), clearRuns: new Set(), spinExposures: 0, profit: 0, firstActivation: new Map(),
  }]));
  const noteBuild = (buildId, runId, activeMs) => {
    const build = buildStats[buildId];
    if (!build) return;
    build.deployedRuns.add(runId);
    if (!build.firstActivation.has(runId) || activeMs < build.firstActivation.get(runId)) build.firstActivation.set(runId, activeMs);
  };
  spinEvents.forEach((event) => {
    const builds = Array.isArray(event.props.builds) && event.props.builds.length
      ? event.props.builds : buildsFromDeck(event.props.deck);
    builds.forEach((id) => {
      noteBuild(id, event.run_id, event.active_ms);
      buildStats[id].spinExposures += Number(event.props.spins || 0);
      buildStats[id].profit += Number(event.props.profit || 0);
    });
  });
  instrumentedEvents.filter((event) => ["deck_change", "deck_preset"].includes(event.event_name)).forEach((event) => {
    const builds = Array.isArray(event.props.builds) ? event.props.builds : buildsFromDeck(event.props.deck);
    builds.forEach((id) => noteBuild(id, event.run_id, event.active_ms));
  });
  const clearEventsByRun = new Map();
  instrumentedEvents.filter((event) => event.event_name === "clear").forEach((event) => {
    const current = clearEventsByRun.get(event.run_id);
    if (!current || event.active_ms < current.active_ms) clearEventsByRun.set(event.run_id, event);
  });
  for (const [runId, clearEvent] of clearEventsByRun.entries()) {
    let clearBuilds = Array.isArray(clearEvent.props.builds) ? clearEvent.props.builds : [];
    if (clearBuilds.length === 0) {
      const priorSpin = spinEvents.filter((event) => event.run_id === runId && event.active_ms <= clearEvent.active_ms)
        .sort((a, b) => b.active_ms - a.active_ms).at(0);
      clearBuilds = priorSpin
        ? (Array.isArray(priorSpin.props.builds) && priorSpin.props.builds.length ? priorSpin.props.builds : buildsFromDeck(priorSpin.props.deck))
        : buildsFromDeck(clearEvent.props.deck);
    }
    clearBuilds.forEach((id) => buildStats[id]?.clearRuns.add(runId));
  }
  const buildRows = Object.values(buildStats).map((build) => ({
    buildId: build.buildId,
    deployedRuns: build.deployedRuns.size,
    clearRuns: build.clearRuns.size,
    spinExposures: build.spinExposures,
    deckProfitWhileActive: build.profit,
    firstActivationMedianMs: percentile([...build.firstActivation.values()], 0.5),
  }));

  const upgradesByKind = {};
  const upgradeEvents = instrumentedEvents.filter((event) => event.event_name === "upgrade_purchase");
  upgradeEvents.forEach((event) => {
    const kind = event.props.kind ?? "unknown";
    upgradesByKind[kind] ??= { purchases: 0, levels: 0, spend: 0 };
    upgradesByKind[kind].purchases += 1;
    upgradesByKind[kind].levels += Number(event.props.levels || 0);
    upgradesByKind[kind].spend += Number(event.props.price || 0);
  });
  const upgrades = {
    cohort: "schema_v2_observation_events_with_fresh_run_distributions",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    byKind: upgradesByKind,
    purchasesPerInstrumentedRun: distribution(instrumentedRuns.map((run) => upgradeEvents.filter((event) => event.run_id === run.run_id).length)),
    firstUpgradeMs: distribution(onboardingRuns.map((run) => milestoneTime(run, "first_upgrade_ms", "first_upgrade")).filter(Number.isFinite)),
  };

  const jackpotEvents = instrumentedEvents.filter((event) => event.event_name === "jackpot").sort((a, b) => a.active_ms - b.active_ms);
  const startsByRun = new Map(onboardingRuns.map((run) => [run.run_id, 0]));
  const extensionsByRun = new Map(onboardingRuns.map((run) => [run.run_id, 0]));
  const endsByRun = new Map(onboardingRuns.map((run) => [run.run_id, 0]));
  jackpotEvents.forEach((event) => {
    if (event.props.phase === "start" && startsByRun.has(event.run_id)) startsByRun.set(event.run_id, (startsByRun.get(event.run_id) ?? 0) + 1);
    if (event.props.phase === "extend" && extensionsByRun.has(event.run_id)) extensionsByRun.set(event.run_id, (extensionsByRun.get(event.run_id) ?? 0) + 1);
    if (event.props.phase === "end" && endsByRun.has(event.run_id)) endsByRun.set(event.run_id, (endsByRun.get(event.run_id) ?? 0) + 1);
  });
  const rushDurations = [];
  const openRushByRun = new Map();
  jackpotEvents.forEach((event) => {
    if (event.props.phase === "start") openRushByRun.set(event.run_id, event.active_ms);
    if (event.props.phase === "end" && openRushByRun.has(event.run_id)) {
      rushDurations.push(Math.max(0, event.active_ms - openRushByRun.get(event.run_id)));
      openRushByRun.delete(event.run_id);
    }
  });
  const rushSpinsByRun = new Map(onboardingRuns.map((run) => [run.run_id, 0]));
  const rushProfitByRun = new Map(onboardingRuns.map((run) => [run.run_id, 0]));
  spinEvents.forEach((event) => {
    if (!rushSpinsByRun.has(event.run_id)) return;
    rushSpinsByRun.set(event.run_id, (rushSpinsByRun.get(event.run_id) ?? 0) + Number(event.props.rushSpins || 0));
    rushProfitByRun.set(event.run_id, (rushProfitByRun.get(event.run_id) ?? 0) + Number(event.props.rushProfit || 0));
  });
  const jackpotReport = {
    cohort: "schema_v2_observation_events_with_fresh_run_distributions",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    starts: jackpotEvents.filter((event) => event.props.phase === "start").length,
    extensions: jackpotEvents.filter((event) => event.props.phase === "extend").length,
    ends: jackpotEvents.filter((event) => event.props.phase === "end").length,
    unclassified: jackpotEvents.filter((event) => !["start", "extend", "end"].includes(event.props.phase)).length,
    startsPerFreshRun: distribution([...startsByRun.values()]),
    extensionsPerFreshRun: distribution([...extensionsByRun.values()]),
    rushSpinsPerFreshRun: distribution([...rushSpinsByRun.values()]),
    rushProfitPerFreshRun: distribution([...rushProfitByRun.values()]),
    rushDurationActiveMs: distribution(rushDurations),
    firstJackpotMs: distribution([...startsByRun.keys()].flatMap((runId) => {
      const starts = jackpotEvents.filter((event) => event.run_id === runId && event.props.phase === "start");
      return starts.length ? [Math.min(...starts.map((event) => event.active_ms))] : [];
    })),
    trimApplied: jackpotEvents.reduce((sum, event) => sum + Number(event.props.trimApplied || 0), 0),
    rushSpins: spinEvents.reduce((sum, event) => sum + Number(event.props.rushSpins || 0), 0),
    rushProfit: spinEvents.reduce((sum, event) => sum + Number(event.props.rushProfit || 0), 0),
  };

  const observedSessionGroups = new Map();
  events.forEach((event) => {
    const group = observedSessionGroups.get(event.session_id) ?? { runId: event.run_id, active: [], engaged: [], received: [], wasEngaged: false };
    group.active.push(Number(event.active_ms));
    group.engaged.push(Number(event.engaged_ms || 0));
    group.received.push(Number(event.received_at));
    group.wasEngaged ||= sessionActionNames.has(event.event_name);
    observedSessionGroups.set(event.session_id, group);
  });
  const engagedSessionGroups = [...observedSessionGroups.values()].filter((group) => group.wasEngaged);
  const observedSessionsByRun = new Map(engagedRuns.map((run) => [run.run_id, []]));
  const sessionsByRun = new Map(engagedRuns.map((run) => [run.run_id, []]));
  for (const group of observedSessionGroups.values()) (observedSessionsByRun.get(group.runId) ?? []).push(group);
  for (const group of engagedSessionGroups) (sessionsByRun.get(group.runId) ?? []).push(group);
  const sessionActiveDurations = engagedSessionGroups.map((group) => Math.max(...group.active) - Math.min(...group.active));
  const sessionEngagedDurations = engagedSessionGroups.map((group) => Math.max(...group.engaged) - Math.min(...group.engaged));
  const returnGaps = [];
  let returnedAfter8h = 0;
  let returnedAfter24h = 0;
  for (const groups of sessionsByRun.values()) {
    const starts = groups.map((group) => Math.min(...group.received)).sort((a, b) => a - b);
    const gaps = [];
    for (let index = 1; index < starts.length; index += 1) gaps.push((starts[index] - starts[index - 1]) * 1_000);
    returnGaps.push(...gaps);
    returnedAfter8h += Number(gaps.some((gap) => gap >= 8 * 60 * 60 * 1_000));
    returnedAfter24h += Number(gaps.some((gap) => gap >= 24 * 60 * 60 * 1_000));
  }
  const sessionsReport = {
    observedSessionsPerEngagedRun: distribution([...observedSessionsByRun.values()].map((groups) => groups.length)),
    sessionsPerEngagedRun: distribution([...sessionsByRun.values()].map((groups) => groups.length)),
    sessionActiveMs: distribution(sessionActiveDurations),
    sessionEngagedMs: distribution(sessionEngagedDurations.filter((value) => value > 0)),
    returnGapMs: distribution(returnGaps),
    returnedAfter8hRuns: returnedAfter8h,
    returnedAfter24hRuns: returnedAfter24h,
  };

  const audioTotals = { requests: 0, scheduled: 0, mutedSkips: 0, throttledSkips: 0, voiceLimitSkips: 0, contextMissing: 0, contextFailures: 0, resumeFailures: 0, interruptedStates: 0 };
  instrumentedEvents.filter((event) => event.event_name === "audio_health_batch").forEach((event) => {
    Object.keys(audioTotals).forEach((key) => { audioTotals[key] += Number(event.props[key] || 0); });
  });
  const audibleRequests = Math.max(0, audioTotals.requests - audioTotals.mutedSkips);
  const audio = {
    ...audioTotals,
    audibleRequests,
    scheduledRate: audibleRequests ? audioTotals.scheduled / audibleRequests : null,
    intentionalSkipRate: audibleRequests ? (audioTotals.throttledSkips + audioTotals.voiceLimitSkips) / audibleRequests : null,
  };
  const errorCodes = {};
  instrumentedEvents.filter((event) => event.event_name === "client_error").forEach((event) => increment(errorCodes, event.props.code ?? "unknown"));

  const schemaVersions = {};
  const appVersions = {};
  events.forEach((event) => { increment(schemaVersions, String(event.schema_version)); increment(appVersions, event.app_version); });
  const eventRunIds = new Set(rawEvents.map((event) => event.run_id));
  const dataQuality = {
    rawEvents30d: rawEvents.length,
    linkedEvents30d: events.length,
    retainedEventLimitReached: rawEvents.length >= 10_000,
    observedRuns: runs.length,
    engagedRuns: engagedRuns.length,
    passiveVisitRuns: runs.length - engagedRuns.length,
    instrumentedV2EngagedRuns: instrumentedIds.size,
    freshV2EngagedRuns: onboardingRuns.length,
    resumedV2EngagedRuns: instrumentedRuns.length - onboardingRuns.length,
    runsWithSnapshots: new Set(snapshots.map((event) => event.run_id)).size,
    eventRunsMissingRunRecord: [...eventRunIds].filter((id) => !runIds.has(id)).length,
    cardEconomyBatches: spinEvents.filter((event) => event.props.wagerByCard && typeof event.props.wagerByCard === "object").length,
    waitExitCoverage: waitEnters.length ? waitExits.length / waitEnters.length : null,
    schemaVersions,
    appVersions,
    debugRunsExcluded: (await db.prepare(`SELECT COUNT(*) AS count FROM telemetry_runs WHERE ruleset_version = ? AND debug = 1`).bind(ruleset).first())?.count ?? 0,
  };

  const cardSummary = {
    cohort: "schema_v2_observation_events",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    storage: "telemetry_reports.payload_json",
    cardsObserved: cardRows.length,
    economyInstrumentedCards: cardRows.filter((card) => card.economyBatches > 0).length,
    mostOffered: [...cardRows].sort((a, b) => b.offered - a.offered).slice(0, 10)
      .map(({ cardId, offered, chosen, choiceRate }) => ({ cardId, offered, chosen, choiceRate })),
    mostUsed: [...cardRows].sort((a, b) => b.spinExposures - a.spinExposures).slice(0, 10)
      .map(({ cardId, deployedRuns, spinExposures, profit }) => ({ cardId, deployedRuns, spinExposures, profit })),
    cards: cardRows,
  };
  const buildsReport = {
    cohort: "schema_v2_observation_events",
    observationRuns: instrumentedRuns.length,
    freshFullRuns: onboardingRuns.length,
    storage: "telemetry_reports.payload_json",
    profitDefinition: "whole_deck_profit_while_build_present",
    builds: buildRows,
  };

  await db.batch([
    saveReport(db, ruleset, "overview", engagedRuns.length, overview),
    saveReport(db, ruleset, "onboarding_30m", onboardingRuns.length, onboarding),
    saveReport(db, ruleset, "economy_30m", onboardingRuns.length, economy),
    saveReport(db, ruleset, "gacha", instrumentedRuns.length, gacha),
    saveReport(db, ruleset, "work", instrumentedRuns.length, workReport),
    saveReport(db, ruleset, "cards", instrumentedRuns.length, cardSummary),
    saveReport(db, ruleset, "builds", instrumentedRuns.length, buildsReport),
    saveReport(db, ruleset, "jackpot", instrumentedRuns.length, jackpotReport),
    saveReport(db, ruleset, "upgrades", instrumentedRuns.length, upgrades),
    saveReport(db, ruleset, "friction", instrumentedRuns.length, friction),
    saveReport(db, ruleset, "sessions", engagedRuns.length, sessionsReport),
    saveReport(db, ruleset, "audio", instrumentedRuns.length, audio),
    saveReport(db, ruleset, "errors", instrumentedRuns.length, { codes: errorCodes }),
    saveReport(db, ruleset, "data_quality", engagedRuns.length, dataQuality),
  ]);

};

const telemetryApi = async (request, env, url) => {
  const origin = request.headers.get("origin");
  if (origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
  if (request.method === "GET") return json({ error: "Telemetry is write-only." }, 405);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 131_072) return json({ error: "Payload too large." }, 413);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 131_072) return json({ error: "Payload too large." }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  if (!input || typeof input.installId !== "string" || !UUID_PATTERN.test(input.installId)) return json({ error: "Invalid analytics ID." }, 400);
  const id = await playerHash(input.installId, env.TELEMETRY_HASH_KEY);

  if (request.method === "DELETE") {
    await env.DB.batch([
      env.DB.prepare(`UPDATE game_ratings SET player_id=NULL,run_id=NULL,session_id=NULL,ruleset_version=NULL,active_ms=NULL,snapshot_json=NULL WHERE player_id=?`).bind(id),
      env.DB.prepare(`UPDATE feedback_messages SET player_id = NULL, run_id = NULL, session_id = NULL, ruleset_version = NULL, active_ms = NULL, snapshot_json = NULL, bankroll = 0, total_spins = 0, total_draws = 0 WHERE player_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM telemetry_events WHERE player_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM telemetry_recent_runs WHERE run_id IN (SELECT run_id FROM telemetry_runs WHERE player_id = ?)`).bind(id),
      env.DB.prepare(`DELETE FROM telemetry_runs WHERE player_id = ?`).bind(id),
      env.DB.prepare(`DELETE FROM telemetry_reports`),
      env.DB.prepare(`DELETE FROM telemetry_card_reports`),
      env.DB.prepare(`DELETE FROM telemetry_build_reports`),
      env.DB.prepare(`INSERT INTO telemetry_reports (report_key, ruleset_version, sample_size, payload_json, updated_at)
        VALUES (?, ?, 0, ?, unixepoch())`).bind(
        `${CURRENT_RULESET_VERSION}:collection_mode`, CURRENT_RULESET_VERSION,
        JSON.stringify({ mode: "raw_on_demand", schemaVersion: 2, autoRefresh: false,
          sources: ["telemetry_events", "telemetry_runs", "telemetry_recent_runs"] }),
      ),
    ]);
    return json({ ok: true }, 200);
  }
  if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
  if (!Array.isArray(input.events) || input.events.length < 1 || input.events.length > 20) return json({ error: "Invalid event batch." }, 400);
  const events = input.events.map(parseEvent);
  if (events.some((event) => event === null)) return json({ error: "Invalid event." }, 400);
  if (new Set(events.map((event) => event.runId)).size !== 1
    || new Set(events.map((event) => event.sessionId)).size !== 1
    || new Set(events.map((event) => event.rulesetVersion)).size !== 1
    || events.some((event) => !acceptsTelemetry(event))) {
    return json({ error: "Mixed or unsupported event batch." }, 400);
  }
  const rateBucket = Math.floor(Date.now() / 600_000);
  const rateHash = await playerHash(
    `telemetry:${rateBucket}:${request.headers.get("cf-connecting-ip") ?? "unknown"}`,
    env.TELEMETRY_HASH_KEY,
  );
  const rate = await env.DB.prepare(`INSERT INTO telemetry_rate_limits (request_hash, bucket, request_count, updated_at)
      VALUES (?, ?, 1, unixepoch())
      ON CONFLICT(request_hash, bucket) DO UPDATE SET request_count = request_count + 1, updated_at = unixepoch()
      WHERE telemetry_rate_limits.request_count < 120
      RETURNING request_count`).bind(rateHash, rateBucket).first();
  if (!rate) return json({ error: "Too many telemetry requests." }, 429);

  const inserts = events.map((event) => env.DB.prepare(`INSERT OR IGNORE INTO telemetry_events
      (event_id, player_id, run_id, session_id, sequence, active_ms, engaged_ms, event_name, app_version, ruleset_version,
       schema_version, debug, language, device_class, viewport_class, props_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(event.eventId, id, event.runId, event.sessionId, event.sequence, event.activeMs, event.engagedMs, event.eventName,
      event.appVersion, event.rulesetVersion, event.schemaVersion, event.debug, event.language, event.deviceClass,
      event.viewportClass, event.propsJson));
  const results = await env.DB.batch(inserts);
  const byRun = new Map();
  for (const event of events) {
    const group = byRun.get(event.runId) ?? [];
    group.push(event);
    byRun.set(event.runId, group);
  }
  for (const group of byRun.values()) {
    group.sort((a, b) => a.activeMs - b.activeMs
      || a.engagedMs - b.engagedMs
      || (a.sessionId === b.sessionId ? a.sequence - b.sequence : a.sessionId.localeCompare(b.sessionId)));
    await updateRun(env.DB, id, group);
    await refreshRecentRun(env.DB, group[0].runId);
  }
  if (events.some((event) => event.eventName === "session_start")) {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM telemetry_events WHERE received_at < unixepoch() - 2592000`),
      env.DB.prepare(`DELETE FROM telemetry_runs WHERE last_seen_at < unixepoch() - 15552000`),
      env.DB.prepare(`DELETE FROM telemetry_recent_runs WHERE run_id NOT IN
        (SELECT run_id FROM telemetry_recent_runs ORDER BY last_seen_at DESC LIMIT 20)`),
      env.DB.prepare(`DELETE FROM telemetry_rate_limits WHERE bucket < ?`).bind(rateBucket - 145),
    ]);
  }
  if(events.some(event=>event.props.soundExperiment==="sound-default-v1")) {
    // A/B reporting must never reject an otherwise accepted gameplay batch.
    try {await refreshSoundExperimentReport(env.DB)} catch { /* Raw events remain available for the next refresh. */ }
  }
  const accepted = results.reduce((sum, result) => sum + Number(result.meta?.changes ?? 0), 0);
  return json({ accepted, ignored: events.length - accepted }, 202);
};

const feedbackApi = async (request, env, url) => {
  if (request.method !== "POST") return json({ error: "Feedback is write-only." }, 405);
  const origin = request.headers.get("origin");
  if (origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return json({ error: "Payload too large." }, 413);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 16_384) return json({ error: "Payload too large." }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }
  if (cleanSingleLine(input?.website)) return json({ ok: true, id: crypto.randomUUID() }, 201);
  const feedback = parseFeedback(input);
  if (!feedback) return json({ error: "Invalid feedback." }, 400);
  const bucket = Math.floor(Date.now() / 600_000);
  const requestHash = await playerHash(`feedback:${bucket}:${request.headers.get("cf-connecting-ip") ?? "unknown"}`, env.TELEMETRY_HASH_KEY);
  const rate = await env.DB.prepare(`INSERT INTO feedback_rate_limits (request_hash, bucket, request_count, updated_at)
    VALUES (?, ?, 1, unixepoch())
    ON CONFLICT(request_hash, bucket) DO UPDATE SET request_count = request_count + 1, updated_at = unixepoch()
    WHERE feedback_rate_limits.request_count < 6
    RETURNING request_count AS requestCount`).bind(requestHash, bucket).first();
  if (!rate || Number(rate.requestCount) > 5) return json({ error: "Too many messages. Try again later." }, 429);
  if (Number(rate.requestCount) === 1) await env.DB.prepare(`DELETE FROM feedback_rate_limits WHERE bucket < ?`).bind(bucket - 2).run();
  const feedbackId = crypto.randomUUID();
  const context = feedback.context;
  const playerId = context ? await playerHash(context.installId, env.TELEMETRY_HASH_KEY) : null;
  await env.DB.prepare(`INSERT INTO feedback_messages
    (feedback_id, category, identity_mode, display_name, reply_contact, message, app_version, language,
     bankroll, total_spins, total_draws, page, player_id, run_id, session_id, ruleset_version, active_ms, snapshot_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      feedbackId, feedback.category, feedback.identityMode, feedback.displayName, feedback.replyContact,
      feedback.message, feedback.appVersion, feedback.language, feedback.bankroll, feedback.totalSpins,
      feedback.totalDraws, feedback.page, playerId, context?.runId ?? null, context?.sessionId ?? null,
      context?.rulesetVersion ?? null, context?.activeMs ?? null, context ? JSON.stringify(context.snapshot) : null,
    ).run();
  return json({ ok: true, id: feedbackId }, 201);
};

export const parseRating=input=>{
  if(!input || typeof input!=="object" || Array.isArray(input) || typeof input.ratingId!=="string" || !UUID_PATTERN.test(input.ratingId) || !Number.isInteger(input.stars) || input.stars<1 || input.stars>5 || !["feedback","clear"].includes(input.source) || (input.feedbackId!=null && (typeof input.feedbackId!=="string" || !UUID_PATTERN.test(input.feedbackId))) || !["ja","en"].includes(input.language))return null;
  const appVersion=safeToken(input.appVersion);if(!appVersion)return null;
  return {ratingId:input.ratingId,stars:input.stars,source:input.source,feedbackId:input.source==="feedback"?input.feedbackId??null:null,appVersion,language:input.language,context:feedbackContext(input,appVersion)};
};
export const ratingsApi=async(request,env,url)=>{
  if(request.method!=="POST")return json({error:"Ratings are write-only."},405);
  if(request.headers.get("origin")!==url.origin)return json({error:"Origin not allowed."},403);
  if(Number(request.headers.get("content-length")??0)>16384)return json({error:"Payload too large."},413);
  let input;try{const raw=await request.text();if(raw.length>16384)return json({error:"Payload too large."},413);input=JSON.parse(raw)}catch{return json({error:"Invalid JSON."},400)}
  const rating=parseRating(input);if(!rating)return json({error:"Invalid rating."},400);
  const existing=await env.DB.prepare(`SELECT rating_id FROM game_ratings WHERE rating_id=?`).bind(rating.ratingId).first();
  if(existing)return json({ok:true,id:rating.ratingId},200);
  if(rating.feedbackId && !await env.DB.prepare(`SELECT feedback_id FROM feedback_messages WHERE feedback_id=?`).bind(rating.feedbackId).first())return json({error:"Message not found."},400);
  const bucket=Math.floor(Date.now()/600000),hash=await playerHash(`ratings:${bucket}:${request.headers.get("cf-connecting-ip")??"unknown"}`,env.TELEMETRY_HASH_KEY);
  const rate=await env.DB.prepare(`INSERT INTO feedback_rate_limits(request_hash,bucket,request_count,updated_at) VALUES(?,?,1,unixepoch()) ON CONFLICT(request_hash,bucket) DO UPDATE SET request_count=request_count+1,updated_at=unixepoch() WHERE feedback_rate_limits.request_count<6 RETURNING request_count AS count`).bind(hash,bucket).first();
  if(!rate || Number(rate.count)>5)return json({error:"少し待ってから、もう一度お試しください。"},429);
  const c=rating.context,playerId=c?await playerHash(c.installId,env.TELEMETRY_HASH_KEY):null;
  await env.DB.prepare(`INSERT INTO game_ratings(rating_id,stars,source,feedback_id,app_version,language,player_id,run_id,session_id,ruleset_version,active_ms,snapshot_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(rating_id) DO NOTHING`).bind(rating.ratingId,rating.stars,rating.source,rating.feedbackId,rating.appVersion,rating.language,playerId,c?.runId??null,c?.sessionId??null,c?.rulesetVersion??null,c?.activeMs??null,c?JSON.stringify(c.snapshot):null).run();
  return json({ok:true,id:rating.ratingId},201);
};

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (["/api/save-codes", "/api/save-codes/restore"].includes(url.pathname)) return json({ error: "This feature is no longer available." }, 410);
    if (url.pathname === "/api/bankroll-rankings") return bankrollRankingsApi(request,env.DB,url);
    if (url.pathname === "/api/rankings") return rankingsApi(request, env.DB, url, score => !String(score.rulesetVersion).includes("-30m") && ASTRA_V9_CATALOG_IDS.includes(score.catalog) && typeof score.rulesetVersion === "string" && score.rulesetVersion.endsWith(":" + score.catalog) && acceptsTelemetry(score));
    if (url.pathname === "/api/leaderboard" || url.pathname === "/api/telemetry" || url.pathname === "/api/feedback" || url.pathname === "/api/ratings") {
      if (!env.DB) return json({ error: "Database unavailable." }, 503);
      try {
        if (url.pathname === "/api/leaderboard") return await leaderboardApi(request, env.DB, url);
        if (url.pathname === "/api/ratings") return await ratingsApi(request,env,url);
        if (url.pathname === "/api/feedback") return await feedbackApi(request, env, url);
        return await telemetryApi(request, env, url);
      } catch (error) {
        console.error(url.pathname.slice(5), error);
        return json({ error: "Request failed." }, 500);
      }
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
    const direct = await env.ASSETS.fetch(request);
    if (direct.status !== 404) {
      if (["/sw.js","/manifest.webmanifest"].includes(url.pathname)) {
        const headers = new Headers(direct.headers);
        headers.set("cache-control","no-cache");
        headers.set("content-type",url.pathname === "/sw.js" ? "application/javascript; charset=utf-8" : "application/manifest+json; charset=utf-8");
        return new Response(direct.body,{status:direct.status,statusText:direct.statusText,headers});
      }
      return direct;
    }
    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/html")) return direct;
    const fallbackUrl = new URL(request.url);
    fallbackUrl.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};

export { feedbackApi, parseEvent, parseFeedback, refreshReports, sanitizeProps };
export default worker;

for(const key of ["handToys","dockToy","bestPayout","winStreak","winVisual","jackpotVisual","chartBackdrop"])PROP_KEYS.add(key);
SETTING_ENUM_VALUES.set("dockToy",new Set(["off","tap","beat","charge"]));
for(const key of ["winVisual","jackpotVisual"])SETTING_ENUM_VALUES.set(key,new Set(["classic","cash","gold","neon","confetti","mix","festival"]));
SETTING_ENUM_VALUES.set("chartBackdrop",new Set(["off","aurora","flow","pulse"]));
for(const key of ["bestPayout","winStreak"])NUMERIC_PROP_KEYS.add(key);

for(const key of ["gameMode","trialRule","trialPaused","trialElapsedMs","trialAddedMs"])PROP_KEYS.add(key);
for(const key of ["trialElapsedMs","trialAddedMs"]){NUMERIC_PROP_KEYS.add(key);DURATION_PROP_KEYS.add(key);}

PROP_KEYS.add("finalBankroll");NUMERIC_PROP_KEYS.add("finalBankroll");
SETTING_ENUM_VALUES.set("gameMode",new Set(["normal","30m"]));
SETTING_ENUM_VALUES.set("trialRule",new Set(["none","fixed","shop","lottery"]));
