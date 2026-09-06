import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED_CATEGORIES,
  SEED_DOMAINS,
  SEEDS_PER_CATEGORY,
  generateCategorySeeds,
  seedRisksHarm,
  validCategorySeed,
  validCategorySeeds,
  SEED_CANDIDATES,
} from "../netlify/lib/category-seeds.mjs";
import { databaseCategorySeedStore, seedsFromRow } from "../netlify/lib/category-seed-store.mjs";
import handler, { config, resolveCategorySeeds } from "../netlify/functions/category-seeds.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "why-app.js"), "utf8");
let pass = 0, fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};
const seed = (over = {}) => ({ category: "sports", domain: "public", label: "star power", query: "Why are superstar athletes becoming bigger than their teams?", ...over });
const pool = (category = "sports") => Array.from({ length: SEEDS_PER_CATEGORY }, (_, i) =>
  seed({ category, label: `tension ${String.fromCharCode(97 + i)}`.replace(" ", "-"), query: `Why does pressure number ${i} change what teams pay for?` }));

console.log("\n[category seeds] the provocation contract");
check("a tension question passes", validCategorySeed(seed()));
check("a definition is rejected", !validCategorySeed(seed({ query: "What is a point guard?" })));
check("a statement is rejected", !validCategorySeed(seed({ query: "Superstar athletes are bigger than teams." })));
check("too short and too long are rejected",
  !validCategorySeed(seed({ query: "Why sports?" })) &&
  !validCategorySeed(seed({ query: `Why ${"very ".repeat(18)}long question about teams and money and power?` })));
check("an unknown domain is rejected", !validCategorySeed(seed({ domain: "sportsball" })));
check("a label longer than two words is rejected", !validCategorySeed(seed({ label: "three word label" })));
check("every category and domain is a closed vocabulary",
  SEED_CATEGORIES.length === 6 && SEED_DOMAINS.length === 6);

console.log("\n[category seeds] the politics guardrail");
check("accusation shapes are blocked in any category", seedRisksHarm("Why did the league lie about concussions?", "sports"));
check("legal-risk shapes are blocked", seedRisksHarm("Why does the lawsuit change stadium funding?", "business"));
check("a named individual is blocked in politics", seedRisksHarm("Why does Jane Halloway keep winning rural districts?", "politics"));
check("a structural politics question passes", !seedRisksHarm("Why do safe seats produce more extreme lawmakers?", "politics"));
check("validation applies the guardrail",
  !validCategorySeed(seed({ category: "politics", query: "Why is the governor corrupt about water rights?" })));

console.log("\n[category seeds] pool integrity");
check("a complete pool validates", validCategorySeeds(pool(), "sports"));
check("a short pool is rejected", !validCategorySeeds(pool().slice(0, 9), "sports"));
check("duplicate questions are rejected",
  !validCategorySeeds(pool().map((s, i) => (i === 3 ? { ...s, query: pool()[0].query } : s)), "sports"));
check("a mismatched category is rejected", !validCategorySeeds(pool("travel"), "sports"));
check("a malformed row yields nothing", seedsFromRow({ seeds: "not json" }, "sports") === null);
check("a stored row round-trips", Array.isArray(seedsFromRow({ seeds: JSON.stringify(pool()) }, "sports")));

console.log("\n[category seeds] endpoint behaviour");
check("the endpoint is rate limited on its own path",
  config.path === "/api/category-seeds" && config.rateLimit.windowLimit === 120);
check("unknown categories are rejected", (await handler(new Request("https://why.com/api/category-seeds?category=crypto"))).status === 400);
check("non-GET is rejected", (await handler(new Request("https://why.com/api/category-seeds?category=sports", { method: "POST" }))).status === 405);

const stored = pool();
const readOnlyStore = { get: async () => stored, recentQuestions: async () => [], put: async () => true };
const storedResult = await resolveCategorySeeds({ store: readOnlyStore, category: "sports", dayKey: "2026-08-30", apiKey: "k" });
check("a stored pool is served without generating", storedResult.generated === false && storedResult.seeds === stored);

let generateCalls = 0;
const emptyStore = {
  get: async () => null, recentQuestions: async () => [],
  put: async () => true,
};
const freshResult = await resolveCategorySeeds({
  store: emptyStore, category: "sports", dayKey: "2026-08-30", apiKey: "k",
  generate: async () => { generateCalls += 1; return { seeds: pool(), model: "test" }; },
});
check("an empty day generates exactly once", generateCalls === 1 && freshResult.generated === true);

const raceStore = {
  get: async () => (raceStore.calls++ ? stored : null), calls: 0,
  recentQuestions: async () => [],
  put: async () => false,
};
const raced = await resolveCategorySeeds({
  store: raceStore, category: "sports", dayKey: "2026-08-30", apiKey: "k",
  generate: async () => ({ seeds: pool(), model: "test" }),
});
check("losing the first-click race adopts the winner's pool", raced.seeds === stored);

console.log("\n[category seeds] generation survives an imperfect batch");
// Production failed on both of these: a 900-token cap truncated the JSON array,
// and a single repeated label discarded an otherwise good pool.
const mkSeed = (i) => ({ label: `tension-${i}`, query: `Why does pressure number ${i} change what teams pay for?`, domain: "public", category: "sports" });
const batch = Array.from({ length: 14 }, (_, i) => mkSeed(i));
batch[3].label = batch[0].label;
batch[7].query = batch[1].query;
batch[9].query = "What is a point guard?";
const fakeFetch = async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ seeds: batch }) } }] }) });
const generated = await generateCategorySeeds({ category: "sports", apiKey: "k", fetchImpl: fakeFetch });
check("duplicates and rejects are absorbed, ten survive", generated.seeds.length === SEEDS_PER_CATEGORY);
check("survivors are unique on label and query",
  new Set(generated.seeds.map((s) => s.label)).size === SEEDS_PER_CATEGORY &&
  new Set(generated.seeds.map((s) => s.query)).size === SEEDS_PER_CATEGORY);
check("more candidates are requested than are kept", SEED_CANDIDATES > SEEDS_PER_CATEGORY);
const thinBatch = Array.from({ length: 4 }, (_, i) => mkSeed(i));
const thinFetch = async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ seeds: thinBatch }) } }] }) });
let failureMessage = "";
try { await generateCategorySeeds({ category: "sports", apiKey: "k", fetchImpl: thinFetch }); }
catch (error) { failureMessage = String(error.message); }
check("a genuine shortfall names the stage that failed",
  failureMessage.includes("valid") && failureMessage.includes("unique"));

console.log("\n[category seeds] client integration");
check("the client prefetches pools while the homepage paints", client.includes("prefetchCategorySeeds();"));
check("the client prefers the shared pool and keeps a local floor",
  client.includes("categorySeedPools.get(normalized) || localCategoryPool(normalized)"));
check("pools are cleared when the day rolls over", client.includes("categorySeedDay !== day"));
check("a failed fetch degrades silently to the built-in bank",
  client.includes("catch {\n      return null;\n    }"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
