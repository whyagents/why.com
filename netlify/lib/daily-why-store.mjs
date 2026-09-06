import { validDailyEpisode } from "./daily-why.mjs";

const parseEpisode = (value) => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
};

export function episodeFromRow(row, expectedId = "") {
  const episode = parseEpisode(row?.episode);
  return validDailyEpisode(episode, expectedId) ? episode : null;
}

export function databaseEpisodeStore(sql) {
  if (typeof sql !== "function") throw new TypeError("A database sql function is required.");
  return {
    async get(episodeId) {
      const rows = await sql`
        SELECT episode
        FROM daily_why_episodes
        WHERE episode_id = ${episodeId}
        LIMIT 1
      `;
      return episodeFromRow(rows[0], episodeId);
    },
    async latest() {
      const rows = await sql`
        SELECT episode
        FROM daily_why_episodes
        ORDER BY episode_id DESC
        LIMIT 1
      `;
      return episodeFromRow(rows[0]);
    },
    async recentQuestions() {
      const rows = await sql`
        SELECT episode->>'question' AS question
        FROM daily_why_episodes
        ORDER BY episode_id DESC
        LIMIT 30
      `;
      return rows.map((row) => String(row.question || "").trim()).filter(Boolean);
    },
    async put({ episode, model, candidateCount, source = "scheduled" }) {
      if (!validDailyEpisode(episode)) throw new Error("Refusing to store an invalid Daily WHY episode.");
      const rows = await sql`
        INSERT INTO daily_why_episodes (episode_id, episode, source, model, candidate_count)
        VALUES (${episode.id}, ${JSON.stringify(episode)}::jsonb, ${source}, ${model}, ${candidateCount})
        ON CONFLICT (episode_id) DO NOTHING
        RETURNING episode_id
      `;
      return rows.length === 1;
    },
  };
}
