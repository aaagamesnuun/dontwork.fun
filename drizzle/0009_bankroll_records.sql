CREATE TABLE IF NOT EXISTS bankroll_records (
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
