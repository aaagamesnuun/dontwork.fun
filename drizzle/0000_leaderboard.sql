CREATE TABLE IF NOT EXISTS leaderboard_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('classic', 'deck')),
  time_ms INTEGER NOT NULL CHECK (time_ms > 0),
  spins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  bankruptcies INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_mode_time
ON leaderboard_scores(mode, time_ms);
