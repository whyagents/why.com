import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import handler, { config } from "../netlify/functions/daily-why.mjs";
import {
  CURRENT_DAILY_WHY,
  addCalendarDays,
  dailyDoorById,
  dailyEpisodeById,
  dailyNodeById,
  pacificDayKey,
  validDailyEpisode,
} from "../netlify/lib/daily-why.mjs";
import {
  buildDailyEpisode,
  selectDailyCandidate,
  validateDailyCandidates,
} from "../netlify/lib/daily-why-generation.mjs";
import { episodeFromRow } from "../netlify/lib/daily-why-store.mjs";
import {
  config as publisherConfig,
  dailyPublishTargets,
  publishOneDailyEpisode,
} from "../netlify/functions/publish-daily-why.mjs";
import { permuteDoors, positionOf, slotKey } from "../netlify/lib/slate-order.mjs";
import {
  DAILY_WHY_GENERATED_LABELS,
  DAILY_WHY_LABELS_VERSION,
} from "../netlify/lib/daily-why-labels.generated.mjs";
import {
  renderGeneratedLabelModule,
  validateGeneratedLabels,
} from "../scripts/generate-daily-door-copy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const page = readFileSync(join(root, "index.html"), "utf8");
const build = readFileSync(join(root, "scripts/build-public.mjs"), "utf8");
const generator = readFileSync(join(root, "scripts/generate-daily-door-copy.mjs"), "utf8");
const ignore = readFileSync(join(root, ".gitignore"), "utf8");
const privacy = readFileSync(join(root, "privacy.html"), "utf8");
const publisher = readFileSync(join(root, "netlify/functions/publish-daily-why.mjs"), "utf8");
const migration = readFileSync(join(root, "netlify/database/migrations/202608290001_daily_why_episodes.sql"), "utf8");
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};

console.log("\n[daily episode] editorial contract");
const episode = CURRENT_DAILY_WHY;
const rootNode = dailyNodeById(episode, episode.rootNodeId);
check("one versioned episode is current", episode.id === "2026-08-27" && dailyEpisodeById(episode.id) === episode);
check("the episode has one root and three canonical children", episode.nodes.length === 4 && rootNode?.doors.every((door) => dailyNodeById(episode, door.targetNodeId)));
check("every canonical answer offers exactly three questions", episode.nodes.every((node) => node.doors.length === 3 && node.doors.every((door) => door.query.endsWith("?"))));
check("every editorial board uses three distinct concept labels", episode.nodes.every((node) => node.doors.every((door) => /^\p{L}[\p{L}\p{N}'’&+\-]*(?:\s+\p{L}[\p{L}\p{N}'’&+\-]*)?$/u.test(door.label) && door.label.split(/\s+/).length <= 2) && new Set(node.doors.map((door) => door.label)).size === 3));
check("the published episode consumes one versioned generated label artifact", DAILY_WHY_LABELS_VERSION >= 1 && episode.nodes.every((node) => node.doors.every((door) => DAILY_WHY_GENERATED_LABELS[episode.id]?.[door.id] === door.label)));
check("every board makes three different psychological promises", episode.nodes.every((node) => new Set(node.doors.map((door) => door.promise)).size === 3));
check("the shared answers remain tweet-sized", episode.nodes.every((node) => node.answer.split(/\s+/).length <= 36));
check("the first two choices are comparable before AI takes over", rootNode.doors.every((door) => door.targetNodeId) && episode.nodes.slice(1).every((node) => node.doors.every((door) => !door.targetNodeId)));
check("door validation is scoped to its canonical node", dailyDoorById(episode, rootNode.id, rootNode.doors[0].id)?.targetNodeId && !dailyDoorById(episode, rootNode.id, episode.nodes[1].doors[0].id));
check("the shared canonical validator accepts the hand-edited fallback", validDailyEpisode(episode, episode.id));

console.log("\n[daily calendar] Pacific dates and scheduled publication");
const boundaryBefore = Date.parse("2026-11-01T06:59:00Z");
const boundaryAfter = Date.parse("2026-11-01T07:01:00Z");
check("Pacific day selection survives a daylight-saving boundary", pacificDayKey(boundaryBefore) === "2026-10-31" && pacificDayKey(boundaryAfter) === "2026-11-01");
check("calendar addition produces tomorrow without a fixed UTC offset", addCalendarDays("2026-12-31", 1) === "2027-01-01");
check("the publisher prepares today and tomorrow", JSON.stringify(dailyPublishTargets(Date.parse("2026-08-27T19:00:00Z"))) === JSON.stringify(["2026-08-27", "2026-08-28"]));
check("the publisher retries hourly without exposing a public route", publisherConfig.schedule === "17 * * * *" && !publisherConfig.path);

const candidateQuestions = [
  "Why does singing with thousands of strangers feel powerful?",
  "Why do luxury brands destroy products people still want?",
  "Why do cities keep building roads that create traffic?",
  "Why does cheaper software make dominant platforms stronger?",
  "Why do rituals feel stronger when nobody explains them?",
  "Why do audiences trust imperfections more than polished performances?",
  "Why do shortages make ordinary products feel culturally important?",
  "Why does public failure sometimes make celebrities more popular?",
  "Why do old technologies survive after better replacements arrive?",
  "Why does convenience keep making customer service feel less human?",
];
const candidatePayload = {
  candidates: candidateQuestions.map((question) => ({
    question,
    domain: "science",
    doors: rootNode.doors.map(({ label, query, role, promise, lens, heat }) => ({ label, query, role, promise, lens, heat })),
  })),
};
const validCandidates = validateDailyCandidates(candidatePayload);
const selectedCandidate = selectDailyCandidate(validCandidates, "2026-08-28");
const expansion = {
  rootAnswer: episode.nodes[0].answer,
  branches: episode.nodes.slice(1).map((node, rootDoorIndex) => ({
    rootDoorIndex,
    answer: node.answer,
    doors: node.doors.map(({ label, query, role, promise, lens, heat }) => ({ label, query, role, promise, lens, heat })),
  })),
};
const generatedEpisode = buildDailyEpisode("2026-08-28", selectedCandidate, expansion);
check("multiple candidates are filtered before deterministic selection", validCandidates.length === 10 && selectDailyCandidate(validCandidates, "2026-08-28").question === selectedCandidate.question);
check("recent questions are excluded before selection", validateDailyCandidates(candidatePayload, [candidateQuestions[0]]).length === 9);
const unsafePayload = structuredClone(candidatePayload);
unsafePayload.candidates[0].question = "Why is artificial intelligence destroying society so quickly?";
check("ragebait is rejected before publication", validateDailyCandidates(unsafePayload).length === 9);
check("a generated episode must satisfy the same contract as the fallback", validDailyEpisode(generatedEpisode, "2026-08-28"));
check("malformed stored JSON never becomes a public episode", !episodeFromRow({ episode: { id: "2026-08-28" } }, "2026-08-28"));

const storedEpisodes = new Map();
let generationCalls = 0;
const memoryStore = {
  get: async (episodeId) => storedEpisodes.get(episodeId) || null,
  recentQuestions: async () => [...storedEpisodes.values()].map((item) => item.question),
  put: async ({ episode: nextEpisode }) => {
    if (storedEpisodes.has(nextEpisode.id)) return false;
    storedEpisodes.set(nextEpisode.id, nextEpisode);
    return true;
  },
};
const mockGenerate = async ({ episodeId }) => {
  generationCalls += 1;
  return { episode: buildDailyEpisode(episodeId, selectedCandidate, expansion), candidateCount: 10, model: "test-model" };
};
const fixedNow = Date.parse("2026-08-27T19:00:00Z");
const firstPublication = await publishOneDailyEpisode({ store: memoryStore, apiKey: "test", now: fixedNow, generate: mockGenerate });
const secondPublication = await publishOneDailyEpisode({ store: memoryStore, apiKey: "test", now: fixedNow, generate: mockGenerate });
const readyPublication = await publishOneDailyEpisode({ store: memoryStore, apiKey: "test", now: fixedNow, generate: mockGenerate });
check("one invocation publishes at most one missing episode", firstPublication.episodeId === "2026-08-27" && secondPublication.episodeId === "2026-08-28" && storedEpisodes.size === 2);
check("ready days make no model call", readyPublication.status === "ready" && generationCalls === 2);
check("the additive migration stores immutable JSON episodes", migration.includes("CREATE TABLE IF NOT EXISTS daily_why_episodes") && migration.includes("episode JSONB NOT NULL") && migration.includes("PRIMARY KEY"));

console.log("\n[daily stakes] the board spans the ladder");
// Stake is the 1-10 belief-revision scale (why-app.js clampHeat). A board of
// three reversals reads as provocative and measures nothing: if every door is a
// 9 the vote split carries no information about what the crowd reached for.
const bandOf = (stake) => (stake <= 5 ? "mechanism" : stake <= 8 ? "consequence" : "reversal");
const nodeStakes = episode.nodes.map((node) => node.doors.map((door) => door.heat));
check("every board offers three different stake bands",
  nodeStakes.every((stakes) => new Set(stakes.map(bandOf)).size === 3));
check("every board spans at least five stake points",
  nodeStakes.every((stakes) => Math.max(...stakes) - Math.min(...stakes) >= 5));
check("no board is uniformly high-stake",
  nodeStakes.every((stakes) => !stakes.every((stake) => stake >= 8)));
check("the episode uses the full ladder",
  Math.min(...nodeStakes.flat()) <= 4 && Math.max(...nodeStakes.flat()) >= 9);
check("every stake is a valid 1-10 integer",
  nodeStakes.flat().every((stake) => Number.isInteger(stake) && stake >= 1 && stake <= 10));

console.log("\n[daily order] per-voter presentation");
// Without randomised order, slot and preference are not separately identified
// and every later estimate inherits the confound.
const tokenA = "tokenAAAAAAAAAAAAAAAAAAAA";
const tokenB = "tokenBBBBBBBBBBBBBBBBBBBB";
const orderFor = (token, node) => permuteDoors(node.doors, token, node.id).map((door) => door.id).join(",");
check("the same token yields a stable order",
  orderFor(tokenA, rootNode) === orderFor(tokenA, rootNode));
check("different tokens diverge somewhere in the episode",
  episode.nodes.some((node) => orderFor(tokenA, node) !== orderFor(tokenB, node)));
check("the result is always a permutation of the board",
  episode.nodes.every((node) => {
    const ids = permuteDoors(node.doors, tokenA, node.id).map((door) => door.id);
    return ids.length === 3 && new Set(ids).size === 3 && ids.every((id) => node.doors.some((door) => door.id === id));
  }));
check("recorded position agrees with the rendered order",
  permuteDoors(rootNode.doors, tokenA, rootNode.id)
    .every((door, index) => positionOf(rootNode.doors, tokenA, rootNode.id, door.id) === index + 1));
check("an absent token renders canonical order and records no position",
  orderFor("", rootNode) === rootNode.doors.map((door) => door.id).join(",")
    && positionOf(rootNode.doors, "", rootNode.id, rootNode.doors[0].id) === null);
const slotCounts = {};
for (let i = 0; i < 12000; i += 1) {
  const order = orderFor(`tok${String(i).padStart(20, "0")}`, rootNode);
  slotCounts[order] = (slotCounts[order] || 0) + 1;
}
const spread = Object.values(slotCounts).sort((a, b) => a - b);
check("every slot ordering occurs at close to equal rate",
  Object.keys(slotCounts).length === 6 && spread[0] > 1500 && spread[spread.length - 1] < 2500);
check("the client mirrors the shared shuffle exactly",
  client.includes("const slotKey = (token, nodeId, doorId) => avalanche(fnv1a(`${token}:${nodeId}:${doorId}`));")
    && client.includes("(a.key - b.key) || (String(a.door?.id) < String(b.door?.id) ? -1 : 1)")
    && client.includes("permuteDoors(node.doors, dailyBrowserToken(), node.id)"));
check("the complete vote split is rendered after selection",
  client.includes("function showDailySplitReveal(") && client.includes("const split = dailySplitCopy(nodeId)")
    && client.includes('class="daily-split-bars"') && client.includes("showDailySplitReveal(root.id, door.id)"));

console.log("\n[daily generation] derived fields do not gate the pipeline");
// Production logged "Only 0 candidates passed validation" on every run. The
// schema asked for role AND promise independently, then the validator demanded
// they correspond — a 1-in-3 coin flip per door, (1/3)^3 per candidate.
const genDoor = (i, role, heat) => ({
  label: `tension-${i}`, query: `why does pressure number ${i} change outcomes?`,
  role, promise: "telescope", lens: "money", heat,
});
const genCandidate = (i) => ({
  question: `why do teams overpay for aging stars in year ${i} of a deal?`,
  domain: "science",
  doors: [genDoor(i * 3, "deepen", 4), genDoor(i * 3 + 1, "contradiction", 9), genDoor(i * 3 + 2, "consequence", 6)],
});
const genBatch = { candidates: Array.from({ length: 10 }, (_, i) => genCandidate(i)) };
const accepted = validateDailyCandidates(genBatch, []);
check("an inconsistent promise no longer discards the candidate", accepted.length === 10);
check("promise is derived from role",
  accepted[0].doors.map((door) => door.promise).join(",") === "microscope,trapdoor,telescope");
check("an out-of-domain lens is repaired to the domain's own set",
  accepted[0].doors.every((door) => ["mechanism", "evidence", "exception"].includes(door.lens)));
check("the three-band spread is still enforced",
  new Set(accepted[0].doors.map((door) => (door.heat <= 5 ? "m" : door.heat <= 8 ? "c" : "r"))).size === 3);

// Loosening the derived fields must not loosen the editorial guardrails.
const badLabel = { candidates: genBatch.candidates.map((candidate) => ({
  ...candidate, doors: candidate.doors.map((door) => ({ ...door, label: "a far too long label for a door" })),
})) };
let stillRejects = false;
try { validateDailyCandidates(badLabel, []); } catch { stillRejects = true; }
check("a genuinely bad label still fails the batch", stillRejects);

const sameBand = { candidates: genBatch.candidates.map((candidate) => ({
  ...candidate, doors: candidate.doors.map((door) => ({ ...door, heat: 9 })),
})) };
let bandRejects = false;
try { validateDailyCandidates(sameBand, []); } catch { bandRejects = true; }
check("three reversals in one board still fails the batch", bandRejects);

console.log("\n[daily API] boundaries and fallback");
check("the platform rate limit is active", config.path === "/api/daily-why" && config.rateLimit?.windowLimit === 90);
const getResponse = await handler(new Request("https://why.com/api/daily-why"));
const getPayload = await getResponse.json();
check("GET serves the episode even without a configured local database", getResponse.status === 200 && getPayload.episode?.id === episode.id && getPayload.stats?.available === false);
const missing = await handler(new Request("https://why.com/api/daily-why?episode=1999-01-01"));
check("unknown episode URLs return 404", missing.status === 404);
const crossSite = await handler(new Request("https://why.com/api/daily-why", {
  method: "POST",
  headers: { origin: "https://attacker.example", "content-type": "application/json" },
  body: "{}",
}));
check("cross-site writes are rejected", crossSite.status === 403);
const wrongType = await handler(new Request("https://why.com/api/daily-why", {
  method: "POST",
  headers: { origin: "https://why.com", "content-type": "text/plain" },
  body: "{}",
}));
check("writes require application/json", wrongType.status === 415);
const invalidChoice = await handler(new Request("https://why.com/api/daily-why", {
  method: "POST",
  headers: { origin: "https://why.com", "content-type": "application/json" },
  body: JSON.stringify({ episodeId: episode.id, nodeId: rootNode.id, doorId: "fake", browserToken: "a".repeat(32) }),
}));
check("unknown choices never reach storage", invalidChoice.status === 400);

console.log("\n[daily publisher] generated copy gate");
const validGeneration = {
  episodeId: episode.id,
  boards: episode.nodes.map((node) => ({
    nodeId: node.id,
    labels: node.doors.map((door) => ({ doorId: door.id, label: door.label })),
  })),
};
const validatedLabels = validateGeneratedLabels(episode, validGeneration);
check("a complete exact-ID episode validates as one publication unit", Object.keys(validatedLabels).length === episode.nodes.length * 3);
const genericGeneration = structuredClone(validGeneration);
genericGeneration.boards[0].labels[0].label = "more";
let genericRejected = false;
try { validateGeneratedLabels(episode, genericGeneration); } catch { genericRejected = true; }
check("generic AI labels are rejected before publication", genericRejected);
const repeatedConcept = structuredClone(validGeneration);
repeatedConcept.boards[0].labels[0].label = "hidden trust";
repeatedConcept.boards[0].labels[1].label = "broken trust";
let repetitionRejected = false;
try { validateGeneratedLabels(episode, repeatedConcept); } catch { repetitionRejected = true; }
check("same-concept choices cannot masquerade as a diverse board", repetitionRejected);
const renderedLabels = renderGeneratedLabelModule({ [episode.id]: validatedLabels });
check("approved output is deterministic and versioned", renderedLabels.includes(`DAILY_WHY_LABELS_VERSION = ${DAILY_WHY_LABELS_VERSION + 1}`) && renderedLabels.indexOf("daily_concert_ritual") < renderedLabels.indexOf("daily_sync_trust"));
check("generation is an editorial tool, never a production runtime call", generator.includes('args.includes("--approve")') && generator.includes("temporaryPath") && generator.includes("rename(temporaryPath, generatedModulePath)") && !build.includes("generate-daily-door-copy"));
check("the generated source and publisher are inside the repository allowlist", ignore.includes("!/netlify/lib/daily-why-labels.generated.mjs") && ignore.includes("!/scripts/generate-daily-door-copy.mjs"));

console.log("\n[daily client] media surface and privacy");
check("homepage leads with the editorial question and three direct doors", client.includes("function selectDailyRootDoor(button)") && client.includes('class="daily-root-board" data-daily-root-board') && client.includes('class="daily-root-door"'));
check("the root choice opens its canonical answer without OpenRouter", client.includes("appendDailyAnswer(thread, user, target)") && client.includes("if (dailyTargetNode && !safetyMode)"));
check("editorial doors survive the client ID normalizer", client.includes("candidate.query === door.query") && client.includes("recordDailyChoice(dailyParentNode.id, dailySelectedDoor.id)"));
check("the second canonical choice hands back to the existing engine", client.includes("dailyChoiceParentNodeId: dailyParentNode?.id || \"\"") && client.includes("runPending(pending, context)"));
check("the homepage removes the oversized logo while permanent Daily pages retain their question surface", !client.includes('class="search-logo display"') && page.includes('.daily-home-card.is-ready') && client.includes('class="daily-question-text" data-daily-question'));
check("the reveal is episode-bounded and reduced-motion safe", client.includes("dailyProgress.revealedEpisodes.includes(dailyEpisode.id)") && client.includes("if (REDUCED_MOTION.matches || dailyProgress.revealedEpisodes.includes(dailyEpisode.id))"));
check("the question becomes an electric card without blocking entry", client.includes("function finishDailyReveal(card, electrify = true)") && page.includes('.daily-home-card.is-electrified { animation:door-electric'));
check("the homepage uses the exact slower reveal and electric timing", client.includes("3350 / Math.max(1, weight)") && client.includes("setTimeout(typeNext, 300)") && client.includes("}, 280);") && client.includes('remove("is-electrified"), 3050') && page.includes("animation:door-electric 3s"));
check("the three labels remain interfaces for full hidden questions", client.includes('data-daily-door-id="${escapeHtml(door.id)}"') && client.includes('aria-label="${escapeHtml(`${door.label} — ${door.query}`)}"'));
check("stake is invisible before selection", !client.includes('data-daily-stake=') && !client.includes('data-daily-heat=') && page.includes(".daily-root-door"));
check("vote failure cannot block the selected answer", client.includes("Promise.race([proofPromise, wait(700)") && client.includes("openDailyRootPath(root, door, position)"));
check("the split is held briefly and reduced motion stays static", client.includes("REDUCED_MOTION.matches ? 650 : 850") && page.includes(".daily-split-item.is-mine"));
check("points reward continuation rather than semantic heat", client.includes("const exploration = depth >= 10 ? 5 : depth >= 5 ? 4 : 3") && client.includes("const insight = 0") && client.includes("jackpot: depth > 0 && depth % 5 === 0"));
check("the answer page no longer carries a collective results panel or share prompt", !client.includes("dailyDistributionMarkup") && !client.includes("share today’s WHY") && !page.includes(".daily-choice-result"));
check("daily clicks render the verified selected-door count", client.includes("count: $number(payload.counts?.[countedDoorId]") && client.includes("function showDailyPathProof") && client.includes('proof?.selectedDoorId === dailySelectedDoor.id'));
check("social proof uses honest singular and plural copy", client.includes('person chose this path') && client.includes('people chose this path') && !client.includes('+${proof.count}'));
check("daily count failure falls back to the existing points reward", client.includes("!showDailyPathProof(rewardRect, proof)) showPointReward(rewardRect, result)"));
check("the browser identity rotates by episode", client.includes("dailyProgress.tokens[dailyEpisode.id]") && client.includes("crypto.getRandomValues(bytes)"));
check("permanent daily pages and episode JSON are generated", build.includes('join(outputRoot, "daily", dailyEpisode.id)') && build.includes('join(dailyDirectory, "episode.json")'));
check("permanent daily pages resolve app assets from the root", build.includes('<base href="/">'));
check("permanent daily pages contain the direct three-door choice", build.includes('class="daily-root-board"') && build.includes("dailyRoot.doors.map") && !build.includes("click to continue"));
check("permanent daily pages retain the six rabbit-hole launchpads", build.includes('class="rabbit-launcher"') && build.includes('data-rabbit-category=') && build.includes('"sports", "entertainment", "travel", "technology", "business", "politics"'));
check("the homepage promise and bundle are current", page.includes("WHY — provocative questions. Three paths. No bottom.") && page.includes("why-app.js?v=20260905-01"));
check("privacy explains the anonymous aggregate signal", privacy.includes("one-way hash of that token") && privacy.includes("limit the browser to one counted choice per question node"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
