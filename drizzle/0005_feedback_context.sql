-- Existing inquiries remain unlinked; no inferred identity backfill.
ALTER TABLE feedback_messages ADD COLUMN player_id TEXT;
ALTER TABLE feedback_messages ADD COLUMN run_id TEXT;
ALTER TABLE feedback_messages ADD COLUMN session_id TEXT;
ALTER TABLE feedback_messages ADD COLUMN ruleset_version TEXT;
ALTER TABLE feedback_messages ADD COLUMN active_ms INTEGER;
ALTER TABLE feedback_messages ADD COLUMN snapshot_json TEXT;
CREATE INDEX idx_feedback_player_created
ON feedback_messages(player_id, created_at DESC) WHERE player_id IS NOT NULL;
