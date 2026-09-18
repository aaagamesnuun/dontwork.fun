CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  control_hash TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  ruleset TEXT NOT NULL,
  state_json TEXT NOT NULL,
  log_json TEXT NOT NULL DEFAULT '[]',
  strategy TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  started_at INTEGER,
  updated_at INTEGER NOT NULL,
  last_work_at INTEGER,
  next_spin_at INTEGER NOT NULL DEFAULT 0,
  finished_at INTEGER,
  duration_ms INTEGER,
  paused INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_ranking ON ai_sessions(ruleset, duration_ms, finished_at) WHERE finished_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS ai_creation_limits (
  request_hash TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
