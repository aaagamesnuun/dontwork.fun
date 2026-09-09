CREATE TABLE save_codes (
    code_hash TEXT PRIMARY KEY,
    snapshot_json TEXT NOT NULL CHECK(length(snapshot_json) <= 2000000),
    app_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE save_code_rate_limits (
    request_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (request_hash, bucket)
  );

CREATE INDEX idx_save_code_rate_bucket ON save_code_rate_limits(bucket);
