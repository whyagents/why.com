import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const server = readFileSync(join(root, "netlify/functions/ultimate-search.mjs"), "utf8");
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};

console.log("\n[local learning remains private]");
check("door impressions still record local behavioral evidence", client.includes("function noteRankingImpression") && client.includes("curiosity.ranking.impressions"));
check("selected and rejected alternatives still become local outcomes", client.includes("function noteRankingSelection") && client.includes("alternatives"));
check("outcomes remain bounded", client.includes("RANKING_OUTCOME_LIMIT = 120") && client.includes("slice(-RANKING_OUTCOME_LIMIT)"));
check("stored outcomes exclude raw questions and answers", !/rawQuestion\s*:|rawAnswer\s*:/.test(client));
check("return and continuation outcomes remain measurable", client.includes("markRankingReturn") && client.includes("continued: true") && client.includes("returned: true"));
check("resetting the self-model resets local learning", client.includes("curiosity = defaultCuriosity();"));

console.log("\n[ranking is off the critical path]");
const summaryStart = client.indexOf("function curiositySummary");
const summaryEnd = client.indexOf("function recentLabel", summaryStart);
const summary = client.slice(summaryStart, summaryEnd);
check("the request sends compact memory cues but no preference vector", summary.includes("memoryCues") && !summary.includes("personalRanking"));
check("server no longer sanitizes or applies ranking weights", !/(safePersonalRanking|personalAffinity|personalRankingInput)/.test(server));
check("server no longer builds or scores competing slates", !/(selectDiverseDoors|doorCombinations|candidateBaseScore)/.test(server));
check("the three-question order is stable", server.includes('const SIMPLE_DOOR_ROLES = ["deepen", "contradiction", "consequence"]'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
