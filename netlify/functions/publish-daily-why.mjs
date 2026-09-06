import { getDatabase } from "@netlify/database";
import { addCalendarDays, pacificDayKey } from "../lib/daily-why.mjs";
import { DAILY_GENERATION_MODEL, generateDailyEpisode } from "../lib/daily-why-generation.mjs";
import { databaseEpisodeStore } from "../lib/daily-why-store.mjs";

export const config = { schedule: "17 * * * *" };

export function dailyPublishTargets(now = Date.now()) {
  const today = pacificDayKey(now);
  return [today, addCalendarDays(today, 1)];
}

export async function publishOneDailyEpisode({
  store,
  apiKey,
  model = DAILY_GENERATION_MODEL,
  now = Date.now(),
  generate = generateDailyEpisode,
}) {
  let target = "";
  for (const episodeId of dailyPublishTargets(now)) {
    if (!await store.get(episodeId)) { target = episodeId; break; }
  }
  if (!target) return { status: "ready", episodeId: "", generated: false };
  const recentQuestions = await store.recentQuestions();
  const generated = await generate({ episodeId: target, recentQuestions, apiKey, model });
  const inserted = await store.put({
    episode: generated.episode,
    model: generated.model || model,
    candidateCount: generated.candidateCount,
    source: "scheduled",
  });
  return { status: inserted ? "published" : "already_published", episodeId: target, generated: true };
}

export default async function handler() {
  const startedAt = Date.now();
  try {
    const { sql } = getDatabase();
    const result = await publishOneDailyEpisode({
      store: databaseEpisodeStore(sql),
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.WHY_DAILY_MODEL || DAILY_GENERATION_MODEL,
    });
    console.log("why_daily_publish", JSON.stringify({ ...result, elapsedMs: Date.now() - startedAt }));
  } catch (error) {
    console.error("why_daily_publish_failed", JSON.stringify({
      name: error?.name || "Error",
      message: String(error?.message || "Daily publication failed.").slice(0, 180),
      elapsedMs: Date.now() - startedAt,
    }));
    throw error;
  }
}
