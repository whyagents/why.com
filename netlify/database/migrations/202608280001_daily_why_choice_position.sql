-- Presentation slot and stake band for each recorded choice.
--
-- Nullable by necessity: rows written before this migration cannot be
-- backfilled. Only voter_hash is stored, never the raw browser token, so the
-- permutation a past voter saw is unrecoverable by construction. Analysis
-- filters `WHERE position IS NOT NULL` - those earlier rows are a separate,
-- confounded stratum rather than missing data.
ALTER TABLE daily_why_choices
  ADD COLUMN IF NOT EXISTS position SMALLINT,
  ADD COLUMN IF NOT EXISTS band SMALLINT;

CREATE INDEX IF NOT EXISTS daily_why_choice_position
  ON daily_why_choices (episode_id, node_id, position);
