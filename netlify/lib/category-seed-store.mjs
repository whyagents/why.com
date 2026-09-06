import { validCategorySeeds } from "./category-seeds.mjs";

const parseSeeds = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
};

export function seedsFromRow(row, category = "") {
  const seeds = parseSeeds(row?.seeds);
  return validCategorySeeds(seeds, category) ? seeds : null;
}

export function databaseCategorySeedStore(sql) {
  if (typeof sql !== "function") throw new TypeError("A database sql function is required.");
  return {
    async get(dayKey, category) {
      const rows = await sql`
        SELECT seeds
        FROM category_seeds
        WHERE day_key = ${dayKey} AND category = ${category}
        LIMIT 1
      `;
      return seedsFromRow(rows[0], category);
    },
    async recentQuestions(category, limit = 40) {
      const rows = await sql`
        SELECT jsonb_array_elements(seeds)->>'query' AS question
        FROM category_seeds
        WHERE category = ${category}
        ORDER BY day_key DESC
        LIMIT ${limit}
      `;
      return rows.map((row) => String(row.question || "").trim()).filter(Boolean);
    },
    // Two visitors can race on the first click of the day. The loser's work is
    // discarded rather than overwriting, and the caller re-reads the winner.
    async put({ dayKey, category, seeds, model }) {
      if (!validCategorySeeds(seeds, category)) throw new Error("Refusing to store an invalid category pool.");
      const rows = await sql`
        INSERT INTO category_seeds (day_key, category, seeds, model)
        VALUES (${dayKey}, ${category}, ${JSON.stringify(seeds)}::jsonb, ${model})
        ON CONFLICT (day_key, category) DO NOTHING
        RETURNING category
      `;
      return rows.length === 1;
    },
  };
}
