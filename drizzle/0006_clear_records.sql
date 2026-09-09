CREATE TABLE clear_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    completion_id TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 32),
    app_version TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    catalog_id TEXT NOT NULL,
    time_ms INTEGER NOT NULL CHECK(time_ms >= 1000 AND time_ms <= 1209600000),
    spins INTEGER NOT NULL CHECK(spins >= 0 AND spins <= 100000000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE INDEX idx_clear_records_time_id ON clear_records(time_ms, id);

CREATE INDEX idx_clear_records_version_time_id ON clear_records(app_version, time_ms, id);
