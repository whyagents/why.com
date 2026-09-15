import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "why-questions-"));
const server = readFileSync(join(root, "netlify/functions/ultimate-search.mjs"), "utf8");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const page = readFileSync(join(root, "index.html"), "utf8");
const seedBank = client.match(/const SEED_BANK = \[([\s\S]*?)\n  \];/)?.[1] || "";
const seedQueries = [...seedBank.matchAll(/query: "([^"]+)"/g)].map((match) => match[1]);
const seedLabels = [...seedBank.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]);
const seedCategories = [...seedBank.matchAll(/category: "([^"]+)"/g)].map((match) => match[1]);
const rabbitCategories = ["sports", "entertainment", "travel", "technology", "business", "politics"];

const gaScript = [...page.matchAll(/<script data-cookieconsent="ignore">([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).find((script) => script.includes("WHY_GA_PARAMETERS"));
const gaSandbox = { WHYConsent: { statisticsAllowed: () => true } };
gaSandbox.window = gaSandbox;
runInNewContext(gaScript, gaSandbox);
gaSandbox.whyAnalytics.track("door_selected", { depth: 2, role: "deepen", promise: "microscope", memoryConnected: true, threadId: "private", query: "private" });
const gaEvent = gaSandbox.dataLayer.find((entry) => entry[0] === "event" && entry[1] === "door_selected");

writeFileSync(join(work, "server.mjs"), server.slice(0, server.indexOf("export default async (request)")) + "\nexport { simpleVoiceNote, promptCacheTelemetry };\n");
const S = await import(join(work, "server.mjs"));
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};

console.log("\n[server] deterministic three-question hydration");
const board = S.simpleVoiceNote([
  { label: "power", query: "how did civil wars break rome?" },
  { label: "invasions", query: "were invasions really decisive for rome?" },
  { label: "the east", query: "why did the eastern empire survive?" },
], "why did rome fall?", "public", []);
check("three question pairs produce exactly three doors", board.pulls.length === 3 && board.copyStyle === "question_v2");
check("roles are distinct and ordered", board.pulls.map((door) => door.role).join("|") === "deepen|contradiction|consequence");
check("promises are distinct and ordered", board.pulls.map((door) => door.promise).join("|") === "microscope|trapdoor|telescope");
check("compact graph handles remain separate from submitted questions", board.pulls.every((door) => door.label !== door.query));
check("science uses its own three lenses", S.simpleVoiceNote([{ label: "lattice", query: "how does the crystal lattice open?" }, { label: "exceptions", query: "does every frozen liquid behave alike?" }, { label: "lakes", query: "why do lakes freeze from above?" }], "why does ice float?", "science").pulls.map((door) => door.lens).join("|") === "mechanism|evidence|exception");
check("prior questions cannot repeat", S.simpleVoiceNote([{ label: "power", query: "how did civil wars break rome?" }, { label: "invasions", query: "were invasions really decisive for rome?" }, { label: "the east", query: "why did the eastern empire survive?" }], "why did rome fall?", "public", ["were invasions really decisive for rome?"]).pulls.length === 0);
check("only door three can earn a memory mark", S.simpleVoiceNote([{ label: "fees", query: "how do hidden ticket fees work?" }, { label: "scarcity", query: "did real scarcity cause high prices?" }, { label: "rome", query: "why did rome collect public tolls?" }], "why are tickets expensive?", "public", [], [{ domain: "public", topics: ["rome"], mechanism: "tolls", entity: "rome" }]).pulls.filter((door) => door.memoryConnected).map((door) => door.role).join("") === "consequence");

console.log("\n[server] cache telemetry");
const cache = S.promptCacheTelemetry({ prompt_tokens: 1200, prompt_tokens_details: { cached_tokens: 900 } });
check("prompt-cache hits are measured", cache.cacheHit === true && cache.cachedTokens === 900 && cache.cacheRate === 0.75);
check("missing usage is distinct from a cache miss", S.promptCacheTelemetry(null).usageAvailable === false);

console.log("\n[client] preserved product experience");
check("GA keeps only privacy-safe event fields", gaEvent?.[2]?.depth === 2 && gaEvent?.[2]?.role === "deepen" && !("threadId" in gaEvent[2]) && !("query" in gaEvent[2]));
check("homepage keeps 60 unique curated questions", seedQueries.length === 60 && new Set(seedQueries).size === 60);
check("homepage keeps compact unique labels", seedLabels.length === 60 && new Set(seedLabels).size === 60 && seedLabels.every((label) => { const words = label.trim().split(/\s+/).length; return words >= 2 && words <= 3; }));
check("rabbit holes contain exactly ten openings in each of six categories", rabbitCategories.every((category) => seedCategories.filter((candidate) => candidate === category).length === 10) && seedCategories.length === 60);
check("rabbit-hole openings are concise standalone questions", seedQueries.every((query) => { const words = query.replace(/[^\p{L}\p{N}'-]+/gu, " ").trim().split(/\s+/).filter(Boolean); return words.length >= 6 && words.length <= 16 && query.endsWith("?"); }));
check("homepage is one live question and three oval categories without an oversized logo", !client.includes('class="search-logo display"') && client.includes('data-home-hero-question') && client.includes('const HOMEPAGE_CATEGORIES = Object.freeze(["sports", "technology", "politics"])') && page.includes('.home-category {') && page.includes('border-radius:999px'));
check("the three homepage launchpads enter the existing path without a category page", client.includes('data-home-category=') && client.includes('const seed = homeHeroSeed(category)') && client.includes('startPath(seed.query, "rabbit", seed.domain)') && !client.includes('href="/sports"'));
check("the simplified homepage is independent of Today's WHY loading", client.includes('if (!DAILY_PAGE_ID) {') && client.includes('innerHTML = homeHeroMarkup()') && client.indexOf('if (!DAILY_PAGE_ID) {') < client.indexOf('const dailyLoading = dailyLoadState === "loading"'));
check("category rotation is deterministic, local and history-aware", client.includes('hashString(`${currentPacificDay}:${normalized}`)') && client.includes("const cursor = Math.max(0") && client.includes("const asked = exploredQuestions()") && client.includes("RABBIT_HOLE_KEY"));
check("question rotation, hover and focus stay linked to each category", client.includes("function showHomeHeroCategory(category") && client.includes('event.target.closest("[data-home-category]")') && client.includes("homeHeroPaused = true") && client.includes("scheduleHomeHeroRotation()"));
check("reduced motion shows a stable question without automatic rotation", client.includes("if (ADS_DEMO || SWARM_DEMO || REDUCED_MOTION.matches || DAILY_PAGE_ID || views.home.hidden || homeHeroPaused) return") && client.includes("animate && !REDUCED_MOTION.matches"));
check("rabbit-hole impressions and selections use privacy-safe aggregate fields", client.includes('track("rabbit_hole_categories_shown", { source: "rabbit", area: "homepage"') && client.includes('track("rabbit_hole_category_selected", { source: "rabbit", area: category'));
check("custom search replaces the three choices and can restore them", client.includes('class="home-choice-slot"') && client.includes('homeHero.querySelector(".home-category-row")?.setAttribute("hidden", "")') && client.includes('data-action="close-daily-search" hidden>Ask WHY.</button>') && client.includes('homeHero.querySelector(\'[data-action="close-daily-search"]\')?.removeAttribute("hidden")') && client.includes('homeHero.querySelector(".home-category-row")?.removeAttribute("hidden")') && client.includes('placeholder="Ask anything…"'));
check("WHY Pro remains tightly aligned beside one matching, legible homepage Ask control", client.includes('class="home-action-row"') && client.includes('class="daily-own-toggle home-pro-link" href="/pro">WHY. Pro</a>') && page.includes('gap:0 .35rem') && page.includes('padding-inline:.35rem; color:rgba(240,235,224,.76); font-style:normal; line-height:1;') && page.includes('.home-action-row .daily-own-toggle[hidden] { display:none; }'));
check("the Porsche meter is replaced by the reduced-motion-safe signal map", page.includes('class="signal-map"') && page.includes("Connect the dots.") && page.includes("@keyframes signal-draw") && page.includes(".signal-path{stroke-dashoffset:0") && !page.includes('class="rev-cluster"') && !page.includes(".rev-dial"));
check("every signal point has a bright core and sequential halo", (page.match(/class="signal-halo/g) || []).length === 4 && page.includes("@keyframes signal-halo") && page.includes("fill:#f0e2bd") && page.includes('class="signal-pulse" cx="0" cy="0" r="3.5"'));
check("the app bundle is freshly versioned", page.includes('why-app.js?v=20260915-01'));
check("failed boards preserve the answer and manual retry", client.includes('data-action="retry-doors"') && client.includes("async function retryDoorBoard()") && client.includes("const data = await fetchDoors(context, controller.signal"));
check("normal turns never make a second door request", client.includes('normalizeVoiceNote({ doors: turnPayload.doors, copyStyle: "question_v2" }') && !client.includes("fetchDoorsWithRetry"));
check("answer buttons show conversational questions", client.includes('normalizeVoiceNote({ doors: turnPayload.doors, copyStyle: "question_v2" }') && client.includes('isQuestionDoorLabel(candidateLabel) ? candidateLabel : doorQuery') && client.includes('<span>${escapeHtml(door.label)}</span>'));
check("clicks submit the displayed question", client.includes("const context = buildRequestContext(thread, door.query, via)") && client.includes('appendUser(thread, door.query, "door"'));
check("copy style follows impressions and selections", client.includes("doorCopyStyle: voice.copyStyle") && client.includes("copyStyle: door.copyStyle"));
check("crisis actions retain explicit question copy", server.includes('copyStyle: "question_v2"') && client.includes('copyStyle: "question_v2", pulls }'));
check("removed orchestration stays removed", !/(answer-pack|schedulePrefetch|selectDiverseDoors|independent quest judge|exactly twelve)/.test(`${server}\n${client}`));
check("answer and door telemetry remain", server.includes('console.info("why_turn_generation"') && server.includes('console.warn("why_door_generation"'));
check("the curiosity score no longer competes with the copy", !client.includes('class="door-score"') && !client.includes('<small>pts</small>') && page.includes('.door-brand-lockup { display:flex; align-items:center;'));
check("desktop composer stays aligned", page.includes('.answer-shell { flex:1 1 auto; width:min(820px,100%);') && page.includes('.answer-screen .follow-form{max-width:820px'));
check("desktop doors retain the electric sequence", page.includes('animation:door-electric 1.2s') && page.includes('--invite-delay:1.65s;') && page.includes('--invite-delay:2.85s;'));
check("mobile concept doors remain three across", page.includes('.door-board.is-concept{grid-template-columns:repeat(3,minmax(0,1fr));gap:.38rem;padding:0 0 1.25rem}'));
check("normal conversational questions stack legibly on mobile", page.includes('.door-board{grid-template-columns:1fr;gap:1.3rem;padding:0 .1rem 1.25rem}') && client.includes('copyStyle: "question_v2"'));
check("mobile waiting feedback preserves the selected concept", page.includes('.door-board.is-concept .curiosity-door.is-selected .door-opening{display:block}'));
check("mobile hides desktop path chrome and receipt prompt", page.includes('.path-status{display:none!important}') && page.includes('.node-trust .receipts-request{display:none}'));
check("haptic feedback remains perceptible", client.includes("function triggerDoorHaptic(result)") && client.includes("[32, 55, 48]") && page.includes("@keyframes door-ring"));
check("JSON-shaped metadata is scrubbed from visible prose", client.includes("function cleanSpokenAnswer(value)") && client.includes("cleanSpokenAnswer(streamed.text)"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
