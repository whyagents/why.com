-- One generated pool of entry questions per category per Pacific calendar day.
--
-- Shared rather than per-visitor on purpose: if every arrival received a
-- different question there would be no common vertices between people, no
-- comparable first choice, and the curiosity graph would be one disconnected
-- component per session. A day-scoped pool keeps the top of the funnel
-- comparable while still being new every morning.
CREATE TABLE IF NOT EXISTS category_seeds (
  day_key TEXT NOT NULL,
  category TEXT NOT NULL,
  seeds JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (day_key, category),
  CONSTRAINT category_seeds_day_key_date CHECK (day_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS category_seeds_created_at
  ON category_seeds (created_at DESC);
