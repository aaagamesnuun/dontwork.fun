ALTER TABLE leaderboard_scores ADD COLUMN ruleset_version TEXT NOT NULL DEFAULT 'legacy-v0';

CREATE INDEX idx_leaderboard_ruleset_mode_time ON leaderboard_scores(ruleset_version, mode, time_ms);
