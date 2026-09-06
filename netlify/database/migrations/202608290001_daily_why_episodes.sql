-- One immutable, validated Daily WHY episode per Pacific calendar day.
-- Generation metadata is operational only; the public API returns episode.
CREATE TABLE IF NOT EXISTS daily_why_episodes (
  episode_id TEXT PRIMARY KEY,
  episode JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'scheduled',
  model TEXT NOT NULL,
  candidate_count SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_why_episode_id_date CHECK (episode_id ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  CONSTRAINT daily_why_candidate_count_positive CHECK (candidate_count > 0)
);

CREATE INDEX IF NOT EXISTS daily_why_episode_created_at
  ON daily_why_episodes (created_at DESC);
