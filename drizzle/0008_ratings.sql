CREATE TABLE IF NOT EXISTS game_ratings (
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
CREATE INDEX IF NOT EXISTS idx_game_ratings_player ON game_ratings(player_id);
