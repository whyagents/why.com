import { DAILY_WHY_GENERATED_LABELS } from "./daily-why-labels.generated.mjs";
import { bandOf, clampStake } from "./stakes.mjs";

const DAILY_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_ITEM_ID_PATTERN = /^[a-z0-9_]{8,100}$/;
const DAILY_LABEL_PATTERN = /^\p{L}[\p{L}\p{N}'’&+\-]*(?:\s+\p{L}[\p{L}\p{N}'’&+\-]*)?$/u;
const DAILY_DOMAINS = Object.freeze({
  public: new Set(["money", "power", "cost"]),
  science: new Set(["mechanism", "evidence", "exception"]),
  problem: new Set(["method", "assumption", "check"]),
  personal: new Set(["habit", "fear", "reward"]),
  decision: new Set(["upside", "risk", "alternative"]),
  technology: new Set(["design", "failure", "tradeoff"]),
});
const DAILY_ROLES = new Set(["deepen", "contradiction", "consequence", "origin", "surprise", "pattern"]);
const DAILY_PROMISES = new Set(["microscope", "trapdoor", "telescope"]);
const DAILY_PROMISE_FOR_ROLE = Object.freeze({
  deepen: "microscope", origin: "microscope",
  contradiction: "trapdoor", surprise: "trapdoor",
  consequence: "telescope", pattern: "telescope",
});

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const wordCount = (value) => clean(value).split(" ").filter(Boolean).length;

export function pacificDayKey(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addCalendarDays(day, amount = 1) {
  if (!DAILY_ID_PATTERN.test(String(day || ""))) return "";
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + Math.trunc(Number(amount) || 0));
  return value.toISOString().slice(0, 10);
}

export function validDailyEpisode(value, expectedId = "") {
  if (!value || typeof value !== "object") return false;
  const episodeId = clean(value.id);
  if (!DAILY_ID_PATTERN.test(episodeId) || (expectedId && episodeId !== expectedId)) return false;
  if (clean(value.publishedDate) !== episodeId || clean(value.question) !== clean(value.nodes?.[0]?.question)) return false;
  if (wordCount(value.question) < 6 || wordCount(value.question) > 18 || !value.question.endsWith("?")) return false;
  if (!Array.isArray(value.nodes) || value.nodes.length !== 4) return false;
  const nodeIds = new Set();
  const doorIds = new Set();
  for (const node of value.nodes) {
    if (!DAILY_ITEM_ID_PATTERN.test(clean(node?.id)) || nodeIds.has(node.id)) return false;
    nodeIds.add(node.id);
    const domainLenses = DAILY_DOMAINS[clean(node?.domain)];
    if (!domainLenses || wordCount(node.question) < 4 || wordCount(node.question) > 22 || !node.question.endsWith("?")) return false;
    if (wordCount(node.answer) < 8 || wordCount(node.answer) > 40) return false;
    if (!Array.isArray(node.doors) || node.doors.length !== 3) return false;
    const labels = new Set();
    const queries = new Set();
    const promises = new Set();
    const bands = new Set();
    for (const door of node.doors) {
      const label = clean(door?.label).toLocaleLowerCase("en-US");
      const query = clean(door?.query).toLocaleLowerCase("en-US");
      const stake = clampStake(door?.heat);
      if (!DAILY_ITEM_ID_PATTERN.test(clean(door?.id)) || doorIds.has(door.id)) return false;
      if (!DAILY_LABEL_PATTERN.test(label) || label.length > 24 || labels.has(label)) return false;
      if (wordCount(query) < 4 || wordCount(query) > 20 || !query.endsWith("?") || queries.has(query)) return false;
      if (!DAILY_ROLES.has(door?.role) || !DAILY_PROMISES.has(door?.promise) || DAILY_PROMISE_FOR_ROLE[door.role] !== door.promise || promises.has(door.promise)) return false;
      if (!domainLenses.has(door?.lens) || !stake) return false;
      doorIds.add(door.id);
      labels.add(label);
      queries.add(query);
      promises.add(door.promise);
      bands.add(bandOf(stake));
    }
    if (promises.size !== 3 || bands.size !== 3) return false;
  }
  const root = value.nodes.find((node) => node.id === value.rootNodeId);
  if (!root || root.id !== value.nodes[0].id) return false;
  const childIds = new Set(root.doors.map((door) => clean(door.targetNodeId)));
  if (childIds.size !== 3 || [...childIds].some((nodeId) => !nodeIds.has(nodeId))) return false;
  return value.nodes.slice(1).every((node) => node.doors.every((door) => !clean(door.targetNodeId)));
}

const EPISODE_ID = "2026-08-27";
const publishedLabel = (doorId, fallback) => DAILY_WHY_GENERATED_LABELS[EPISODE_ID]?.[doorId] || fallback;

const episode = {
  id: EPISODE_ID,
  publishedDate: "2026-08-27",
  slug: "singing-with-strangers",
  question: "Why does singing with thousands of strangers feel powerful?",
  rootNodeId: "daily_2026_08_27_root",
  nodes: [
    {
      id: "daily_2026_08_27_root",
      question: "Why does singing with thousands of strangers feel powerful?",
      domain: "science",
      answer: "shared rhythm synchronizes attention and movement, softening the border between ‘me’ and ‘us.’ thousands of strangers stop feeling accidental and briefly become a chorus with a pulse.",
      sources: [
        { title: "Synchrony and cooperation · Psychological Science", url: "https://pubmed.ncbi.nlm.nih.gov/19152536/" },
        { title: "Live music and collective effervescence · PSPB", url: "https://journals.sagepub.com/doi/10.1177/01461672241288027" },
      ],
      doors: [
        {
          id: "daily_sync_trust",
          label: publishedLabel("daily_sync_trust", "borrowed trust"),
          query: "why does moving in sync build trust?",
          role: "deepen",
          promise: "microscope",
          lens: "mechanism",
          heat: 4,
          grounding: "optional",
          targetNodeId: "daily_2026_08_27_sync",
        },
        {
          id: "daily_crowd_danger",
          label: publishedLabel("daily_crowd_danger", "crowd crush"),
          query: "when does crowd energy turn dangerous?",
          role: "contradiction",
          promise: "trapdoor",
          lens: "evidence",
          heat: 9,
          grounding: "optional",
          targetNodeId: "daily_2026_08_27_danger",
        },
        {
          id: "daily_concert_ritual",
          label: publishedLabel("daily_concert_ritual", "secular faith"),
          query: "why do concerts feel almost religious?",
          role: "pattern",
          promise: "telescope",
          lens: "exception",
          heat: 7,
          grounding: "optional",
          targetNodeId: "daily_2026_08_27_ritual",
        },
      ],
    },
    {
      id: "daily_2026_08_27_sync",
      question: "why does moving in sync build trust?",
      domain: "science",
      answer: "moving in time makes other people more predictable and the group feel less separate; synchronized participants cooperate more. apparently trust sometimes enters through the feet.",
      sources: [
        { title: "Synchrony and cooperation · Psychological Science", url: "https://pubmed.ncbi.nlm.nih.gov/19152536/" },
      ],
      doors: [
        { id: "daily_sync_judgment", label: publishedLabel("daily_sync_judgment", "groupthink"), query: "can synchrony override personal judgment?", role: "contradiction", promise: "trapdoor", lens: "evidence", heat: 9, grounding: "optional" },
        { id: "daily_sync_armies", label: publishedLabel("daily_sync_armies", "obedience"), query: "why do armies march together?", role: "origin", promise: "microscope", lens: "mechanism", heat: 4, grounding: "optional" },
        { id: "daily_sync_online", label: publishedLabel("daily_sync_online", "synthetic trust"), query: "does online rhythm create trust?", role: "pattern", promise: "telescope", lens: "exception", heat: 6, grounding: "optional" },
      ],
    },
    {
      id: "daily_2026_08_27_danger",
      question: "when does crowd energy turn dangerous?",
      domain: "science",
      answer: "crowds become dangerous when density turns movement into pressure: stop-and-go waves, bottlenecks and blocked exits can overpower individual control. the villain is often geometry, not panic.",
      sources: [
        { title: "Dynamics of crowd disasters · Physical Review E", url: "https://journals.aps.org/pre/abstract/10.1103/PhysRevE.75.046109" },
      ],
      doors: [
        { id: "daily_danger_panic", label: publishedLabel("daily_danger_panic", "scapegoat"), query: "why does panic get blamed?", role: "contradiction", promise: "trapdoor", lens: "exception", heat: 10, grounding: "optional" },
        { id: "daily_danger_prediction", label: publishedLabel("daily_danger_prediction", "warning signs"), query: "can dangerous crowds be predicted?", role: "deepen", promise: "microscope", lens: "evidence", heat: 3, grounding: "optional" },
        { id: "daily_danger_exits", label: publishedLabel("daily_danger_exits", "gatekeepers"), query: "who controls the exits?", role: "consequence", promise: "telescope", lens: "mechanism", heat: 6, grounding: "optional" },
      ],
    },
    {
      id: "daily_2026_08_27_ritual",
      question: "why do concerts feel almost religious?",
      domain: "science",
      answer: "concerts borrow ritual’s machinery—shared attention, repeated symbols, synchronized movement and emotional intensity. researchers call the connection collective effervescence; the cathedral simply installed subwoofers.",
      sources: [
        { title: "Live music and collective effervescence · PSPB", url: "https://journals.sagepub.com/doi/10.1177/01461672241288027" },
        { title: "Sources of collective effervescence · Sociological Science", url: "https://www.sociologicalscience.com/articles-v6-2-27/" },
      ],
      doors: [
        { id: "daily_ritual_repetition", label: publishedLabel("daily_ritual_repetition", "conditioning"), query: "why do rituals need repetition?", role: "origin", promise: "microscope", lens: "mechanism", heat: 4, grounding: "optional" },
        { id: "daily_ritual_break", label: publishedLabel("daily_ritual_break", "disillusionment"), query: "what breaks the collective spell?", role: "contradiction", promise: "trapdoor", lens: "exception", heat: 9, grounding: "optional" },
        { id: "daily_ritual_livestream", label: publishedLabel("daily_ritual_livestream", "synthetic crowds"), query: "can livestreams create the same feeling?", role: "pattern", promise: "telescope", lens: "evidence", heat: 6, grounding: "optional" },
      ],
    },
  ],
};

export const DAILY_WHY_EPISODES = Object.freeze([episode]);
export const CURRENT_DAILY_WHY = episode;

export function dailyEpisodeById(episodeId) {
  return DAILY_WHY_EPISODES.find((candidate) => candidate.id === episodeId) || null;
}

export function dailyNodeById(episodeValue, nodeId) {
  return episodeValue?.nodes?.find((node) => node.id === nodeId) || null;
}

export function dailyDoorById(episodeValue, nodeId, doorId) {
  return dailyNodeById(episodeValue, nodeId)?.doors?.find((door) => door.id === doorId) || null;
}

export function publicDailyEpisode(episodeValue = CURRENT_DAILY_WHY) {
  return JSON.parse(JSON.stringify(episodeValue));
}
