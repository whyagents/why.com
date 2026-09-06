// Runnable validation for Release 1 local-memory integrity.
// Usage: node tests/memory-integrity.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const consent = readFileSync(join(root, "why-consent.js"), "utf8");
const page = readFileSync(join(root, "index.html"), "utf8");
const privacy = readFileSync(join(root, "privacy.html"), "utf8");
const netlify = readFileSync(join(root, "netlify.toml"), "utf8");

let pass = 0;
let fail = 0;
function check(name, condition) {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
  }
}

const topicHelpers = client.slice(
  client.indexOf("const SENSITIVE_TOPIC_PATTERN"),
  client.indexOf("function loadCuriosity()"),
);
const topicSandbox = {};
runInNewContext(`
  const cleanText = (value, max = 4000) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, max);
  const $number = (value, cap = Number.MAX_SAFE_INTEGER) => Math.max(0, Math.min(cap, Number(value) || 0));
  ${topicHelpers}
  globalThis.retain = boundedTopicCounts;
`, topicSandbox);

console.log("\n[curiosity] frequency plus recency retention");
const counts = Object.fromEntries(Array.from({ length: 45 }, (_, index) => [`topic-${index}`, 45 - index]));
counts.newcomer = 1;
counts.therapy = 100;
counts.cancer = 100;
const retained = topicSandbox.retain(counts, ["newcomer", "topic-44", "therapy"]);
check("topic profile remains capped at 40", Object.keys(retained).length === 40);
check("a newly encountered topic survives a full profile", retained.newcomer === 1);
check("recent low-frequency topics survive", retained["topic-44"] === 1);
check("known sensitive tokens are removed during migration", !("therapy" in retained));
check("expanded sensitive health tokens are removed during migration", !("cancer" in retained));

const mergeSource = client.slice(
  client.indexOf("function mergeThreadLists"),
  client.indexOf("function storedThreadsForMerge"),
);
const mergeSandbox = {};
runInNewContext(`${mergeSource}\nglobalThis.merge = mergeThreadLists;`, mergeSandbox);

console.log("\n[threads] cross-tab merge and recovery guards");
const merged = mergeSandbox.merge(
  [{ id: "local", updatedAt: 20 }, { id: "shared", updatedAt: 30, title: "new" }],
  [{ id: "remote", updatedAt: 25 }, { id: "shared", updatedAt: 10, title: "old" }],
);
check("distinct local and remote paths both survive", merged.some(({ id }) => id === "local") && merged.some(({ id }) => id === "remote"));
check("newer same-thread state wins", merged.find(({ id }) => id === "shared")?.title === "new");
check("clear history explicitly bypasses stored merge", client.includes("persistThreads({ mergeStored: false })"));
check("malformed current history is marked for quarantine", client.includes('reason: "invalid_json"') && client.includes("quarantineThreadIssue()"));
check("failed quarantine blocks destructive persistence", client.includes("if (!quarantineThreadIssue()) return false;"));

console.log("\n[curiosity] authoritative single-write behavior");
const acceptedAnswerWrites = client.match(/noteCuriosity\(\{ query, domain, depth \}\);/g) || [];
check("topic and domain share one authoritative accepted-answer writer", acceptedAnswerWrites.length === 1 && client.includes("function noteAcceptedAnswer(query, domain, depth)") && client.includes("noteCuriosity({ query, domain, depth });"));
check("every accepted answer path uses the authoritative writer", client.includes("noteAcceptedAnswer(pending.query, result.domain, depth);") && client.includes("noteAcceptedAnswer(door.query, dailyTargetNode.domain, depth);") && client.includes("noteAcceptedAnswer(door.query, target.domain, 1);"));
check("door selection records behavior without speculative topic classification", client.includes("noteCuriosity({ role: door.role, heat: door.heat, pull: true });"));
check("profile copy describes the actual connection boundary", client.includes("Saved paths stay on this device") && client.includes("recent messages from the active path") && client.includes("one compact non-sensitive path cue may shape the third question"));

console.log("\n[analytics] consent and local-buffer behavior");
const gaScript = [...page.matchAll(/<script data-cookieconsent="ignore">([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .find((script) => script.includes("WHY_GA_PARAMETERS"));
const denied = { WHYConsent: { statisticsAllowed: () => false } };
denied.window = denied;
runInNewContext(gaScript, denied);
denied.whyAnalytics.track("door_selected", { depth: 2 });
check("GA adapter drops events when statistics consent is denied", !denied.dataLayer.some((entry) => entry[0] === "event"));
const allowed = { WHYConsent: { statisticsAllowed: () => true } };
allowed.window = allowed;
runInNewContext(gaScript, allowed);
allowed.whyAnalytics.track("door_selected", { depth: 2 });
check("GA adapter sends allowlisted events after consent", allowed.dataLayer.some((entry) => entry[0] === "event" && entry[1] === "door_selected"));
check("consent controller exposes live statistics state", consent.includes("statisticsAllowed: () => window.Cookiebot?.consent?.statistics === true"));
check("production analytics history is debug-only", client.includes("if (DEBUG) try {") && client.indexOf("if (DEBUG) try {") < client.indexOf("const storedEvents = readJSON(ANALYTICS_KEY)"));

console.log("\n[storage] whole-app accounting and staged pruning");
const storageHelpers = client.slice(
  client.indexOf("function domStringBytes"),
  client.indexOf("function validSources"),
);
const storageSandbox = { stored: new Map([["threads", "old"], ["ledger", "score"]]) };
runInNewContext(`
  const MANAGED_STORAGE_KEYS = ["threads", "ledger"];
  const THREADS_KEY = "threads";
  const readRaw = (key) => stored.has(key) ? stored.get(key) : null;
  ${storageHelpers}
  globalThis.bytes = domStringBytes;
  globalThis.managed = managedStorageBytes;
`, storageSandbox);
check("DOM-string accounting includes keys and two-byte code units", storageSandbox.bytes("ab", "cde") === 10);
check("thread overrides replace rather than double-count stored threads", storageSandbox.managed({ ok: true }) === 2 * ("threads".length + JSON.stringify({ ok: true }).length + "ledger".length + "score".length));
check("pre-serialized thread overrides are counted without re-stringifying", storageSandbox.managed(null, JSON.stringify({ ok: true })) === 2 * ("threads".length + JSON.stringify({ ok: true }).length + "ledger".length + "score".length));
check("all WHY stores participate in the managed budget", client.includes("THREADS_QUARANTINE_KEY, THREADS_V1_KEY, LEGACY_THREADS_KEY") && client.includes("RABBIT_HOLE_KEY, DAILY_PROGRESS_KEY, ANALYTICS_KEY, VISIT_KEY, STORAGE_PERSISTENCE_KEY"));
check("legacy UTF-8 payload-only accounting is gone", !client.includes("new TextEncoder()"));
const persistenceBody = client.slice(client.indexOf("function persistThreads"), client.indexOf("function persistNameProfile"));
const receiptsAt = persistenceBody.indexOf("message.sources = []");
const turnsAt = persistenceBody.indexOf("thread.messages = thread.messages.slice(-4)");
const pathsAt = persistenceBody.indexOf("candidateThreads.pop()");
check("pruning removes receipts, then old turns, then whole paths", receiptsAt > -1 && turnsAt > receiptsAt && pathsAt > turnsAt);
check("each pruning stage retries the durable write", (persistenceBody.match(/tryCandidate\(\)/g) || []).length >= 4);
check("each persistence candidate serializes once for accounting and writing", persistenceBody.includes("managedStorageBytes(null, raw)") && persistenceBody.includes("writeRaw(THREADS_KEY, raw)") && !persistenceBody.includes("managedStorageBytes(payload)"));

console.log("\n[performance] hidden history and immutable bundle caching");
check("history rendering exits while its modal is closed", client.includes('if (!("#historyModal")?.classList.contains("open")) return;') || client.includes('if (!$("#historyModal")?.classList.contains("open")) return;'));
const appVersion = page.match(/why-app\.js\?v=([0-9-]+)/)?.[1] || "";
check("application bundle URL carries an explicit release version", appVersion.length > 0);
check("only the versioned application bundle receives immutable caching", netlify.includes('for = "/why-app.js"') && netlify.includes('Cache-Control = "public, max-age=31536000, immutable"') && netlify.includes('for = "/api/*"') && netlify.includes('Cache-Control = "no-store"'));

console.log("\n[persistence] meaningful-engagement cadence");
check("persistent storage is requested only after three accepted answers", client.includes("if (depth >= 3) void requestPersistentStorage();"));
check("persistence requests are session-deduped and time-bounded", client.includes("if (persistenceRequestStarted) return;") && client.includes("STORAGE_PERSIST_RETRY_MS"));
check("browser persistence and estimates are best-effort diagnostics", client.includes("await storage.persisted()") && client.includes("await storage.persist()") && client.includes("storagePressureState(await storage.estimate())"));

console.log("\n[portability] explicit path-only backup");
const exportSource = client.slice(client.indexOf("function pathExportPayload"), client.indexOf("function exportPaths"));
const exportSandbox = { state: { threads: [{ id: "path-1" }] } };
runInNewContext(`
  const PATH_EXPORT_VERSION = 1;
  ${exportSource}
  globalThis.makeExport = pathExportPayload;
`, exportSandbox);
const exported = exportSandbox.makeExport();
check("export envelope is versioned and contains paths", exported.product === "WHY" && exported.version === 1 && exported.threads.length === 1);
check("export excludes profile, points, analytics and consent", !Object.hasOwn(exported, "nameProfile") && !Object.hasOwn(exported, "ledger") && !Object.hasOwn(exported, "analytics") && !Object.hasOwn(exported, "consent"));
check("imports enforce schema, size and complete sanitization", client.includes("file.size > MAX_IMPORT_BYTES") && client.includes('payload?.product !== "WHY"') && client.includes("threads.length !== payload.threads.length"));
check("failed imports restore the previous in-memory paths", client.includes("state.threads = previousThreads;") && client.includes("Those paths could not be saved on this device."));
check("history exposes explicit export and import controls", page.includes('data-action="export-paths"') && page.includes('data-action="import-paths"') && page.includes('id="pathImportInput"'));

console.log("\n[memory] earned cross-path cues");
const memoryCueSource = client.slice(client.indexOf("function memoryCuesFor"), client.indexOf("function curiositySummary"));
const memorySandbox = {
  curiosity: { totalPulls: 9 },
  state: { threads: [] },
  curiosityGraph: {
    nodes: {
      currentRoot: { question: { content: "current subject" }, answer: { domain: "public", voiceNote: { signature: { mechanism: "access control", entity: "current" } } } },
      romeRoot: { question: { content: "rome empire" }, answer: { domain: "public", voiceNote: { signature: { mechanism: "access control", entity: "rome" } } } },
      iceRoot: { question: { content: "ice density" }, answer: { domain: "science", voiceNote: { signature: { mechanism: "density shift", entity: "ice" } } } },
      privateRoot: { question: { content: "my anxiety" }, answer: { domain: "personal", voiceNote: { signature: { mechanism: "threat response", entity: "self" } } } },
    },
    paths: [
      { id: "current", updatedAt: 40, nodeIds: ["currentRoot", "currentLeaf", "currentThird"] },
      { id: "rome", updatedAt: 30, nodeIds: ["romeRoot", "romeLeaf", "romeThird"] },
      { id: "ice", updatedAt: 20, nodeIds: ["iceRoot", "iceLeaf", "iceThird"] },
      { id: "private", updatedAt: 10, nodeIds: ["privateRoot", "privateLeaf", "privateThird"] },
    ],
  },
};
runInNewContext(`
  const MEMORY_MIN_PULLS = 10;
  const MEMORY_MIN_PATHS = 3;
  const buildCuriosityGraph = () => curiosityGraph;
  const safeDomain = (domain) => domain;
  const safeTopicWords = (question, domain) => domain === "personal" ? [] : question.split(" ");
  const cleanText = (value, limit = 4000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  const isSensitiveTopic = (value) => /anxiety|health|trauma/i.test(value || "");
  ${memoryCueSource}
  globalThis.cues = memoryCuesFor;
`, memorySandbox);
check("cross-path cues stay locked before ten pulls", memorySandbox.cues("current").length === 0);
memorySandbox.curiosity.totalPulls = 10;
const earnedCues = memorySandbox.cues("current");
check("earned cues exclude the current and personal paths", earnedCues.length === 2 && earnedCues.every((cue) => cue.domain !== "personal"));
check("cues contain compact graph meaning without transcripts", earnedCues.every((cue) => Object.keys(cue).sort().join(",") === "domain,entity,mechanism,topics"));
check("earned cues are derived from graph nodes rather than transcript scans", memoryCueSource.includes("graph.paths") && memoryCueSource.includes("graph.nodes[path.nodeIds[0]]"));
check("request profile no longer sends broad rankings", !client.includes("topDomains: ranked") && !client.includes("topTopics: ranked") && !client.includes("topRoles: ranked"));
check("privacy copy discloses the exact limited transmission", privacy.includes("one compact, non-sensitive path cue") && privacy.includes("It does not send the earlier questions, answers, or transcripts") && client.includes("memoryCuesFor(currentThreadId).slice(0, 1)"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
