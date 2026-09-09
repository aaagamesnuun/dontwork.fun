CREATE TABLE IF NOT EXISTS feedback_messages (
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
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (
    (identity_mode = 'anonymous' AND display_name IS NULL AND reply_contact IS NULL)
    OR
    (identity_mode = 'named' AND display_name IS NOT NULL AND length(display_name) BETWEEN 1 AND 32)
  ),
  CHECK (reply_contact IS NULL OR length(reply_contact) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created
ON feedback_messages(status, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback_rate_limits (
  request_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (request_hash, bucket)
);

CREATE INDEX IF NOT EXISTS idx_feedback_rate_bucket
ON feedback_rate_limits(bucket);
