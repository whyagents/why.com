CREATE TABLE IF NOT EXISTS daily_why_choices (
  episode_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  door_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (episode_id, node_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS daily_why_choice_counts
  ON daily_why_choices (episode_id, node_id, door_id);
