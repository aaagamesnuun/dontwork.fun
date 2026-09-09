export const leaderboardSchemaSql = {
  table: `
    CREATE TABLE IF NOT EXISTS leaderboard_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('classic', 'deck')),
      ruleset_version TEXT NOT NULL DEFAULT 'legacy-v0',
      time_ms INTEGER NOT NULL CHECK (time_ms > 0),
      spins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      bankruptcies INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  index: `
    CREATE INDEX IF NOT EXISTS idx_leaderboard_ruleset_mode_time
    ON leaderboard_scores(ruleset_version, mode, time_ms)
  `,
} as const;

export const telemetrySchemaSql = {
  events: `CREATE TABLE IF NOT EXISTS telemetry_events (
    event_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    active_ms INTEGER NOT NULL,
    engaged_ms INTEGER NOT NULL DEFAULT 0,
    event_name TEXT NOT NULL,
    app_version TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    debug INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL,
    device_class TEXT NOT NULL,
    viewport_class TEXT NOT NULL,
    props_json TEXT NOT NULL,
    received_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE (session_id, sequence)
  )`,
  runs: `CREATE TABLE IF NOT EXISTS telemetry_runs (
    run_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    first_session_id TEXT NOT NULL,
    app_version TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    debug INTEGER NOT NULL DEFAULT 0,
    language TEXT NOT NULL,
    device_class TEXT NOT NULL,
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
    cleared INTEGER NOT NULL DEFAULT 0,
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
    deck_json TEXT NOT NULL DEFAULT '[]',
    copies_json TEXT NOT NULL DEFAULT '[]'
  )`,
  reports: `CREATE TABLE IF NOT EXISTS telemetry_reports (
    report_key TEXT PRIMARY KEY,
    ruleset_version TEXT NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  rateLimits: `CREATE TABLE IF NOT EXISTS telemetry_rate_limits (
    request_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (request_hash, bucket)
  )`,
  rateLimitsIndex: `CREATE INDEX IF NOT EXISTS idx_telemetry_rate_bucket
    ON telemetry_rate_limits(bucket)`,
  cardReports: `CREATE TABLE IF NOT EXISTS telemetry_card_reports (
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
  buildReports: `CREATE TABLE IF NOT EXISTS telemetry_build_reports (
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
  recentRuns: `CREATE TABLE IF NOT EXISTS telemetry_recent_runs (
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
} as const;

export const feedbackSchemaSql = {
  table: `CREATE TABLE IF NOT EXISTS feedback_messages (
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
    player_id TEXT,
    run_id TEXT,
    session_id TEXT,
    ruleset_version TEXT,
    active_ms INTEGER,
    snapshot_json TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK ((identity_mode = 'anonymous' AND display_name IS NULL AND reply_contact IS NULL)
      OR (identity_mode = 'named' AND display_name IS NOT NULL AND length(display_name) BETWEEN 1 AND 32)),
    CHECK (reply_contact IS NULL OR length(reply_contact) BETWEEN 1 AND 160)
  )`,
  index: `CREATE INDEX IF NOT EXISTS idx_feedback_status_created
    ON feedback_messages(status, created_at DESC)`,
  playerIndex: `CREATE INDEX IF NOT EXISTS idx_feedback_player_created ON feedback_messages(player_id, created_at DESC) WHERE player_id IS NOT NULL`,
  rateLimits: `CREATE TABLE IF NOT EXISTS feedback_rate_limits (
    request_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (request_hash, bucket)
  )`,
  rateLimitsIndex: `CREATE INDEX IF NOT EXISTS idx_feedback_rate_bucket
    ON feedback_rate_limits(bucket)`,
} as const;

export const clearRecordsSchemaSql = {
  table: `CREATE TABLE clear_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    completion_id TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 32),
    app_version TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    catalog_id TEXT NOT NULL,
    time_ms INTEGER NOT NULL CHECK(time_ms >= 1000 AND time_ms <= 1209600000),
    spins INTEGER NOT NULL CHECK(spins >= 0 AND spins <= 100000000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  allTime: `CREATE INDEX idx_clear_records_time_id ON clear_records(time_ms, id)`,
  byVersion: `CREATE INDEX idx_clear_records_version_time_id ON clear_records(app_version, time_ms, id)`,
} as const;

export const saveCodesSchemaSql = {
  snapshots: `CREATE TABLE save_codes (
    code_hash TEXT PRIMARY KEY,
    snapshot_json TEXT NOT NULL CHECK(length(snapshot_json) <= 2000000),
    app_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  rateLimits: `CREATE TABLE save_code_rate_limits (
    request_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (request_hash, bucket)
  )`,
  rateIndex: `CREATE INDEX idx_save_code_rate_bucket ON save_code_rate_limits(bucket)`,
} as const;

export const ratingsSchemaSql = `CREATE TABLE IF NOT EXISTS game_ratings (
 rating_id TEXT PRIMARY KEY,
 stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
 source TEXT NOT NULL CHECK(source IN ('feedback','clear')),
 feedback_id TEXT,
 app_version TEXT NOT NULL,
 language TEXT NOT NULL,
 player_id TEXT,
 run_id TEXT,
 session_id TEXT,
 ruleset_version TEXT,
 active_ms INTEGER,
 snapshot_json TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_game_ratings_player ON game_ratings(player_id);`;

export const bankrollRecordsSchemaSql = `CREATE TABLE IF NOT EXISTS bankroll_records (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 score_id TEXT NOT NULL UNIQUE,
 nickname TEXT NOT NULL,
 app_version TEXT NOT NULL,
 ruleset_version TEXT NOT NULL,
 catalog_id TEXT NOT NULL,
 duration_ms INTEGER NOT NULL CHECK(duration_ms = 1800000),
 final_bankroll REAL NOT NULL CHECK(final_bankroll >= 0 AND final_bankroll <= 1e200),
 spins INTEGER NOT NULL CHECK(spins >= 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bankroll_amount_id ON bankroll_records(final_bankroll DESC,id ASC);
CREATE INDEX IF NOT EXISTS idx_bankroll_version_amount_id ON bankroll_records(app_version,final_bankroll DESC,id ASC);
`;
