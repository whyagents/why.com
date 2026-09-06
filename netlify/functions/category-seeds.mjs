import { getDatabase } from "@netlify/database";
import { pacificDayKey } from "../lib/daily-why.mjs";
import { CATEGORY_SEED_MODEL, SEED_CATEGORIES, generateCategorySeeds } from "../lib/category-seeds.mjs";
import { databaseCategorySeedStore } from "../lib/category-seed-store.mjs";

export const config = {
  path: "/api/category-seeds",
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

// The client always holds a local fallback pool, so an empty list is a normal
// outcome rather than an error: the launchpad keeps working, just with the
// built-in questions, and the next visitor re-attempts generation.
const empty = (category, dayKey) => json({ category, dayKey, seeds: [] });

export async function resolveCategorySeeds({ store, category, dayKey, apiKey, model = CATEGORY_SEED_MODEL, generate = generateCategorySeeds }) {
  const stored = await store.get(dayKey, category);
  if (stored) return { seeds: stored, generated: false };
  const recentQuestions = await store.recentQuestions(category);
  const created = await generate({ category, recentQuestions, apiKey, model });
  const inserted = await store.put({ dayKey, category, seeds: created.seeds, model: created.model || model });
  // Lost the race with a simultaneous first click: take the winner's pool so
  // every visitor that day sees the same ten questions.
  if (!inserted) {
    const winner = await store.get(dayKey, category);
    if (winner) return { seeds: winner, generated: false };
  }
  return { seeds: created.seeds, generated: true };
}

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const category = String(new URL(request.url).searchParams.get("category") || "").toLowerCase().slice(0, 32);
  const dayKey = pacificDayKey();
  if (!SEED_CATEGORIES.includes(category)) return json({ error: "Unknown category." }, 400);

  const startedAt = Date.now();
  try {
    const { sql } = getDatabase();
    const { seeds, generated } = await resolveCategorySeeds({
      store: databaseCategorySeedStore(sql),
      category,
      dayKey,
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.WHY_DAILY_MODEL || CATEGORY_SEED_MODEL,
    });
    if (generated) {
      console.log("why_category_seeds", JSON.stringify({ category, dayKey, count: seeds.length, elapsedMs: Date.now() - startedAt }));
    }
    return json({ category, dayKey, seeds });
  } catch (error) {
    console.error("why_category_seeds_failed", JSON.stringify({
      category,
      dayKey,
      name: error?.name || "Error",
      message: String(error?.message || "Category seed generation failed.").slice(0, 180),
      elapsedMs: Date.now() - startedAt,
    }));
    return empty(category, dayKey);
  }
}
