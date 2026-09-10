-- Compact, replay-safe visit projection. No names, IP addresses, or message text.
CREATE TABLE IF NOT EXISTS funnel_devices (
  player_id TEXT PRIMARY KEY, first_visit TEXT NOT NULL, first_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_funnel_devices_first ON funnel_devices(first_at);
CREATE TABLE IF NOT EXISTS funnel_segments (
  player_id TEXT NOT NULL, visit_id TEXT NOT NULL, session_id TEXT NOT NULL, run_id TEXT NOT NULL,
  started_at INTEGER NOT NULL, last_active_at INTEGER NOT NULL, event_at INTEGER NOT NULL,
  foreground_ms INTEGER NOT NULL DEFAULT 0, play_at INTEGER, intro_at INTEGER, work_at INTEGER,
  spin_at INTEGER, upgrade_at INTEGER, jackpot_at INTEGER, clear_at INTEGER, second_bet_at INTEGER,
  language TEXT NOT NULL, device TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL, origin TEXT NOT NULL,
  debug INTEGER NOT NULL DEFAULT 0, modal TEXT NOT NULL, tab TEXT NOT NULL, status TEXT NOT NULL,
  PRIMARY KEY(player_id, visit_id, session_id, run_id)
);
CREATE INDEX IF NOT EXISTS idx_funnel_segments_player_visit ON funnel_segments(player_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_funnel_segments_run ON funnel_segments(run_id);
CREATE INDEX IF NOT EXISTS idx_funnel_segments_started ON funnel_segments(started_at);
