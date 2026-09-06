import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const extractFunction = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
};

const LENS_SETS = {
  public: ["money", "power", "cost"], science: ["mechanism", "evidence", "exception"],
  problem: ["method", "assumption", "check"], personal: ["habit", "fear", "reward"],
  decision: ["upside", "risk", "alternative"], technology: ["design", "failure", "tradeoff"],
};
const VALID_LENSES = new Set(Object.values(LENS_SETS).flat());
const VALID_ROLES = new Set(["deepen", "contradiction", "consequence", "origin", "surprise", "pattern"]);
const VALID_PROMISES = new Set(["microscope", "trapdoor", "telescope"]);
const PROMISE_FOR_ROLE = { deepen: "microscope", origin: "microscope", contradiction: "trapdoor", surprise: "trapdoor", consequence: "telescope", pattern: "telescope" };
const LEGACY_GENERIC_DOOR_LABELS = new Set(["who gets paid?", "who decides?", "who pays later?"]);
const QUESTION_DOOR_STARTER = /^(?:why|how|what|which|where|when|who|did|does|do|can|could|would|is|are|was|were)\b/i;
const CONCEPT_LABEL_TOKEN = /^[\p{L}\p{N}][\p{L}\p{N}'’&+\-]*$/u;
const GENERIC_CONCEPT_LABELS = new Set(["deeper", "origin", "surprise", "consequence", "another angle", "more", "why", "evidence", "interesting", "learn more", "next question", "mechanism", "twist", "beyond", "underworld", "heresy", "aftershock"]);
const cleanText = (value, limit = 4000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
const safeDomain = (value) => Object.hasOwn(LENS_SETS, value) ? value : "public";
const guessDomain = () => "public";
const canonicalRole = (value) => ({ reveal: "contradiction", jump: "pattern" }[String(value || "").toLowerCase().trim()] || String(value || "").toLowerCase().trim());
const clampHeat = (value) => Math.max(1, Math.min(10, Math.round(Number(value) || 0)));
const hashString = (value) => [...String(value || "")].reduce((hash, character) => Math.imul(hash ^ character.codePointAt(0), 16777619), 2166136261) >>> 0;
const isQuestionDoorLabel = (label) => {
  const text = cleanText(label, 72).toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 3 && words.length <= 12 && text.length <= 72 && QUESTION_DOOR_STARTER.test(text) && /[?]$/.test(text);
};
const isConceptDoorLabel = (value) => {
  const label = cleanText(value, 24).toLowerCase();
  const words = label.split(/\s+/u).filter(Boolean);
  return label.length <= 24 && words.length >= 1 && words.length <= 2 && words.every((word) => CONCEPT_LABEL_TOKEN.test(word)) && !GENERIC_CONCEPT_LABELS.has(label);
};
const normalizeVoiceNote = new Function(
  "cleanText", "safeDomain", "guessDomain", "LENS_SETS", "VALID_LENSES", "LEGACY_GENERIC_DOOR_LABELS", "QUESTION_DOOR_STARTER", "isQuestionDoorLabel", "isConceptDoorLabel", "canonicalRole", "VALID_ROLES", "VALID_PROMISES", "PROMISE_FOR_ROLE", "hashString", "clampHeat",
  `return (${extractFunction(client, "normalizeVoiceNote")});`,
)(cleanText, safeDomain, guessDomain, LENS_SETS, VALID_LENSES, LEGACY_GENERIC_DOOR_LABELS, QUESTION_DOOR_STARTER, isQuestionDoorLabel, isConceptDoorLabel, canonicalRole, VALID_ROLES, VALID_PROMISES, PROMISE_FOR_ROLE, hashString, clampHeat);
const parseTurnPayload = new Function(`return (${extractFunction(client, "parseTurnPayload")});`)();
const requireStructuredTurnPayload = new Function(`return (${extractFunction(client, "requireStructuredTurnPayload")});`)();
const unavailableDoorBoardMarkup = new Function(`return (${extractFunction(client, "unavailableDoorBoardMarkup")});`)();

let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};

console.log("\n[concept-door normalizer]");
const viking = normalizeVoiceNote({ copyStyle: "concept_v1", doors: [
  { label: "ships", query: "how did viking ships survive the atlantic?" },
  { label: "leif", query: "was leif erikson really the first?" },
  { label: "settlement", query: "why did the viking settlement fail?" },
] }, "how did vikings reach america?", "public");
check("three valid concept pairs become three doors", viking.pulls.length === 3 && viking.copyStyle === "concept_v1");
check("visible concepts and submitted questions stay separate", viking.pulls.every((door) => door.label !== door.query));
check("roles are fixed to the three jobs", viking.pulls.map((door) => door.role).join("|") === "deepen|contradiction|consequence");
check("promises are microscope, trapdoor and telescope", viking.pulls.map((door) => door.promise).join("|") === "microscope|trapdoor|telescope");
check("domain lenses remain deterministic", viking.pulls.map((door) => door.lens).join("|") === "money|power|cost");
check("generic concept labels are rejected", normalizeVoiceNote({ copyStyle: "concept_v1", doors: [{ label: "deeper", query: "why did roman taxes keep rising?" }, { label: "power", query: "why did emperors lose political control?" }, { label: "war", query: "why did border armies lose loyalty?" }] }, "why did rome fall?").pulls.length === 0);
check("duplicate concept labels withhold the whole board", normalizeVoiceNote({ copyStyle: "concept_v1", doors: [{ label: "money", query: "why did roman taxes keep rising?" }, { label: "money", query: "why did roman currency lose value?" }, { label: "war", query: "why did border armies lose loyalty?" }] }, "why did rome fall?").pulls.length === 0);
const historical = normalizeVoiceNote({ copyStyle: "question_v2", questions: ["how did their ships survive?", "was leif really first?", "why did settlement fail?"] }, "how did vikings reach america?", "public");
check("historical question boards still normalize", historical.pulls.length === 3 && historical.copyStyle === "question_v2" && historical.pulls.every((door) => door.label === door.query));

console.log("\n[explicit stream failures]");
let emptyCode = "";
try { requireStructuredTurnPayload("", parseTurnPayload("")); } catch (error) { emptyCode = error.code; }
check("empty HTTP 200 bodies fail explicitly", emptyCode === "EMPTY_STREAM");
let proseCode = "";
try { requireStructuredTurnPayload("plain prose", parseTurnPayload("plain prose")); } catch (error) { proseCode = error.code; }
check("schema-ignoring prose fails explicitly", proseCode === "MALFORMED_STREAM");
const fenced = parseTurnPayload('```json\n{"answer":"true","doors":[{"label":"timing","query":"why did the timing matter?"},{"label":"change","query":"what changed beneath the surface?"},{"label":"future","query":"where does the system go next?"}]}\n```');
check("valid fenced structured output remains recoverable", fenced.payload?.doors?.length === 3);

console.log("\n[recovery and removed complexity]");
check("failed boards keep the explicit retry action", unavailableDoorBoardMarkup().includes('data-action="retry-doors"'));
check("normal fetch reads conversational questions from its own turn", client.includes('normalizeVoiceNote({ doors: turnPayload.doors, copyStyle: "question_v2" }') && client.includes('status: "single_turn"'));
check("manual recovery calls fetchDoors exactly once", client.includes("const data = await fetchDoors(context, controller.signal") && !client.includes("fetchDoorsWithRetry"));
check("no speculative answer pack remains", !/(answer-pack|schedulePrefetch|claimPrefetch|prefetchCache)/.test(client));
check("mobile haptics remain intact", client.includes("function triggerDoorHaptic(result)") && client.includes("[32, 55, 48]") && client.includes("function triggerWebKitSwitchHaptic()"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
