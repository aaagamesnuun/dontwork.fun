CREATE TABLE IF NOT EXISTS telemetry_events (
  event_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  active_ms INTEGER NOT NULL CHECK (active_ms >= 0),
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
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_run_sequence
ON telemetry_events(run_id, sequence);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_ruleset_received
ON telemetry_events(ruleset_version, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_received
ON telemetry_events(event_name, received_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_runs (
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
  first_agents_ms INTEGER,
  first_spin_ms INTEGER,
  first_win_ms INTEGER,
  first_draft_ms INTEGER,
  first_special_ms INTEGER,
  first_duplicate_ms INTEGER,
  first_jackpot_ms INTEGER,
  final_status TEXT NOT NULL DEFAULT 'unknown',
  last_event TEXT NOT NULL DEFAULT 'session_start',
  deck_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(deck_json)),
  copies_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(copies_json))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_runs_ruleset_started
ON telemetry_runs(ruleset_version, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_runs_player_started
ON telemetry_runs(player_id, started_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_reports (
  report_key TEXT PRIMARY KEY,
  ruleset_version TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS telemetry_recent_runs (
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
);

CREATE INDEX IF NOT EXISTS idx_telemetry_recent_runs_seen
ON telemetry_recent_runs(last_seen_at DESC);
