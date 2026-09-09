ALTER TABLE telemetry_events ADD COLUMN engaged_ms INTEGER NOT NULL DEFAULT 0 CHECK (engaged_ms >= 0);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_run_active_received
ON telemetry_events(run_id, active_ms, received_at);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_received
ON telemetry_events(received_at);

ALTER TABLE telemetry_runs ADD COLUMN engaged_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE telemetry_runs ADD COLUMN snapshot_active_ms INTEGER NOT NULL DEFAULT 0;
UPDATE telemetry_runs SET snapshot_active_ms = active_ms WHERE snapshot_active_ms < active_ms;

CREATE INDEX IF NOT EXISTS idx_telemetry_runs_last_seen
ON telemetry_runs(last_seen_at);

CREATE TABLE IF NOT EXISTS telemetry_rate_limits (
  request_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (request_hash, bucket)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_rate_bucket
ON telemetry_rate_limits(bucket);

ALTER TABLE telemetry_runs ADD COLUMN first_interaction_ms INTEGER;
ALTER TABLE telemetry_runs ADD COLUMN first_work_ms INTEGER;
ALTER TABLE telemetry_runs ADD COLUMN first_special_deployed_ms INTEGER;
ALTER TABLE telemetry_runs ADD COLUMN first_upgrade_ms INTEGER;
ALTER TABLE telemetry_runs ADD COLUMN clear_active_ms INTEGER;
ALTER TABLE telemetry_runs ADD COLUMN clear_engaged_ms INTEGER;
ALTER TABLE telemetry_runs ADD COLUMN clear_wall_ms INTEGER;

UPDATE telemetry_runs
SET first_work_ms = (
  SELECT MIN(active_ms) FROM telemetry_events
  WHERE telemetry_events.run_id = telemetry_runs.run_id
    AND event_name = 'milestone'
    AND json_extract(props_json, '$.name') = 'first_work'
)
WHERE first_work_ms IS NULL;

UPDATE telemetry_runs
SET first_special_deployed_ms = (
  SELECT MIN(active_ms) FROM telemetry_events
  WHERE telemetry_events.run_id = telemetry_runs.run_id
    AND event_name = 'milestone'
    AND json_extract(props_json, '$.name') = 'first_special_deployed'
)
WHERE first_special_deployed_ms IS NULL;

UPDATE telemetry_runs
SET first_upgrade_ms = (
  SELECT MIN(active_ms) FROM telemetry_events
  WHERE telemetry_events.run_id = telemetry_runs.run_id
    AND (
      event_name = 'upgrade_purchase'
      OR (event_name = 'milestone' AND json_extract(props_json, '$.name') = 'first_upgrade')
    )
)
WHERE first_upgrade_ms IS NULL;

UPDATE telemetry_runs
SET clear_active_ms = (
  SELECT MIN(active_ms) FROM telemetry_events
  WHERE telemetry_events.run_id = telemetry_runs.run_id AND event_name = 'clear'
)
WHERE clear_active_ms IS NULL;

CREATE TABLE IF NOT EXISTS telemetry_card_reports (
  ruleset_version TEXT NOT NULL,
  card_id TEXT NOT NULL,
  offered INTEGER NOT NULL DEFAULT 0,
  chosen INTEGER NOT NULL DEFAULT 0,
  duplicate_choices INTEGER NOT NULL DEFAULT 0,
  chosen_runs INTEGER NOT NULL DEFAULT 0,
  deployed_runs INTEGER NOT NULL DEFAULT 0,
  chosen_never_deployed_runs INTEGER NOT NULL DEFAULT 0,
  spin_exposures INTEGER NOT NULL DEFAULT 0,
  copy_spin_exposures INTEGER NOT NULL DEFAULT 0,
  hits INTEGER NOT NULL DEFAULT 0,
  wager REAL NOT NULL DEFAULT 0,
  payout REAL NOT NULL DEFAULT 0,
  penalty REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  effect_triggers INTEGER NOT NULL DEFAULT 0,
  economy_batches INTEGER NOT NULL DEFAULT 0,
  first_deploy_median_ms REAL,
  acquisition_to_deploy_median_ms REAL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (ruleset_version, card_id)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_card_reports_ruleset_profit
ON telemetry_card_reports(ruleset_version, profit DESC);

CREATE TABLE IF NOT EXISTS telemetry_build_reports (
  ruleset_version TEXT NOT NULL,
  build_id TEXT NOT NULL,
  deployed_runs INTEGER NOT NULL DEFAULT 0,
  clear_runs INTEGER NOT NULL DEFAULT 0,
  spin_exposures INTEGER NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  first_activation_median_ms REAL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (ruleset_version, build_id)
);

-- Older materialized reports used incompatible denominators. Raw events and run summaries remain intact.
DELETE FROM telemetry_reports;
INSERT INTO telemetry_reports (report_key, ruleset_version, sample_size, payload_json, updated_at)
VALUES (
  'all-pool-copies-v1:collection_mode',
  'all-pool-copies-v1',
  0,
  '{"mode":"raw_on_demand","schemaVersion":2,"autoRefresh":false,"sources":["telemetry_events","telemetry_runs","telemetry_recent_runs"]}',
  unixepoch()
);
