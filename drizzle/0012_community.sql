CREATE TABLE board_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES board_posts(id),
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 1 AND 32),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 1000),
  clear_record_id TEXT,
  trial_record_id TEXT,
  actor_hash TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_board_parent_id ON board_posts(parent_id,id);
CREATE INDEX idx_board_actor_created ON board_posts(actor_hash,created_at);
CREATE INDEX idx_board_network_created ON board_posts(network_hash,created_at);
CREATE INDEX idx_clear_registered_at ON clear_records(julianday(created_at));
CREATE INDEX idx_bankroll_rule_registered_at ON bankroll_records(ruleset_version,julianday(created_at));
