import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../netlify/functions/ultimate-search.mjs";

const remoteUrl = String(process.env.WHY_EVAL_URL || "").trim();
if (!remoteUrl && !process.env.OPENROUTER_API_KEY) {
  console.error("Set OPENROUTER_API_KEY for local evaluation or WHY_EVAL_URL for a deployed endpoint.");
  process.exit(2);
}

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = process.env.WHY_EVAL_OUTPUT || join(projectRoot, "artifacts", "why-voice-eval.json");
const concurrency = Math.max(1, Math.min(6, Number(process.env.WHY_EVAL_CONCURRENCY) || (remoteUrl ? 1 : 3)));
const questions = [
  "why did the roman empire fall?",
  "why did the civil war happen?",
  "how did vikings reach america?",
  "why did google beat yahoo?",
  "why did the printing press change europe?",
  "why did prohibition fail?",
  "why does ice float?",
  "why do humans dream?",
  "why is the sky blue?",
  "why do dogs remember people?",
  "why do antibiotics stop working?",
  "why is reality tv popular?",
  "why do luxury brands destroy products?",
  "why is love island popular?",
  "why do memes spread?",
  "why are concert tickets expensive?",
  "why do people procrastinate?",
  "why do people stay in bad relationships?",
  "why does embarrassment linger?",
  "why do we miss people who hurt us?",
  "why does boredom feel painful?",
  "why do databases need indexes?",
  "why do websites fail under sudden traffic?",
  "why does technical debt compound?",
  "why do recommendation algorithms become repetitive?",
  "why does caching make software faster?",
  "how do i remember what i read?",
  "how should i prepare for a difficult conversation?",
  "AI is overhyped",
  "pizza",
  "elon musk",
];

const percentile = (values, fraction) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
};
const words = (value) => String(value || "").trim().split(/\s+/).filter(Boolean);
const parsePayload = (raw) => {
  const text = String(raw || "").trim();
  for (const candidate of [text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)]) {
    if (!candidate) continue;
    try { return JSON.parse(candidate); } catch {}
  }
  return null;
};
const request = (body) => new Request("https://why.com/api/ultimate-search", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const invoke = (body) => remoteUrl
  ? fetch(remoteUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: new URL(remoteUrl).origin,
        "sec-fetch-site": "same-origin",
      },
      body: JSON.stringify(body),
    })
  : handler(request(body));
const validLabel = (value) => {
  const label = String(value || "").trim();
  const count = words(label).length;
  return count >= 3 && count <= 12 && label.length <= 72 && /^(why|how|what|which|where|when|who|did|does|do|can|could|would|is|are|was|were)\b/i.test(label) && /\?$/.test(label);
};
const visibleAnswer = (value) => {
  const text = String(value || "").trim();
  const tokens = [...text.matchAll(/\S+/g)];
  if (tokens.length <= 36) return text;
  const boundary = tokens[35].index + tokens[35][0].length;
  const prefix = text.slice(0, boundary);
  const endings = [...prefix.matchAll(/[.!?](?=\s|$)/g)].filter((match) => prefix.slice(0, match.index + 1).trim().split(/\s+/).length >= 8);
  return endings.length ? prefix.slice(0, endings.at(-1).index + 1).trim() : `${prefix.replace(/[,:;\-–—\s]+$/g, "").trim()}.`;
};

const runTurn = async ({ query, history, priorQuestions, depth }) => {
  const started = performance.now();
  const requestBody = {
    action: "answer",
    query,
    history,
    path: { depth, priorQuestions },
  };
  const response = await invoke(requestBody);
  const raw = await response.text();
  const payload = parsePayload(raw);
  const rawAnswer = String(payload?.answer || "").trim();
  const answer = visibleAnswer(rawAnswer);
  const roles = ["deepen", "contradiction", "consequence"];
  const promises = ["microscope", "trapdoor", "telescope"];
  const doors = Array.isArray(payload?.doors) ? payload.doors.slice(0, 3) : [];
  let pulls = doors.length === 3 && doors.every((door) => validLabel(door?.query))
    ? doors.map((door, index) => ({
        internalLabel: String(door?.label || "").trim(),
        label: String(door.query).trim(),
        query: String(door.query).trim(),
        role: roles[index],
        promise: promises[index],
      }))
    : [];
  const embeddedReady = pulls.length === 3;
  let boardSource = embeddedReady ? "single_turn" : "unavailable";
  let recoveryStatus = null;
  let recoveryAttempts = 0;
  if (answer && !embeddedReady) {
    // Exercise the same one-call recovery the user can trigger manually.
    for (let attempt = 0; attempt < 1 && boardSource === "unavailable"; attempt += 1) {
      recoveryAttempts += 1;
      const recovery = await invoke({
        ...requestBody,
        action: "doors",
        answer,
        embeddedFallbackReason: "evaluation_questions_invalid",
      });
      recoveryStatus = recovery.status;
      const recoveryPayload = await recovery.json().catch(() => null);
      const recoveredPulls = Array.isArray(recoveryPayload?.voiceNote?.pulls) ? recoveryPayload.voiceNote.pulls : [];
      if (recoveryPayload?.doorState === "ready" && recoveredPulls.length === 3) {
        pulls = recoveredPulls;
        boardSource = "recovery";
      }
    }
  }
  return {
    status: response.status,
    recoveryStatus,
    recoveryAttempts,
    latencyMs: Math.round(performance.now() - started),
    query,
    answer,
    rawAnswerWordCount: words(rawAnswer).length,
    wordCount: words(answer).length,
    pulls,
    boardSource,
    checks: {
      answerPresent: Boolean(answer),
      tweetSized: words(answer).length >= 8 && words(answer).length <= (depth ? 40 : 45),
      cleanOpening: Boolean(answer) && !/^(because|look|duh|oh)\b/i.test(answer),
      cleanLanding: Boolean(answer) && !/\?$/.test(answer),
      boardReady: pulls.length >= 3,
      labelsValid: pulls.length >= 3 && pulls.every((pull) => validLabel(pull?.label)),
      visibleEqualsSubmitted: pulls.length >= 3 && pulls.every((pull) => pull.label === pull.query),
      distinctRoles: new Set(pulls.map((pull) => pull?.role)).size === pulls.length,
    },
  };
};

const runPath = async (rootQuestion) => {
  const history = [];
  const priorQuestions = [];
  const turns = [];
  let query = rootQuestion;
  for (let depth = 0; depth < 3; depth += 1) {
    const turn = await runTurn({ query, history, priorQuestions, depth });
    turns.push(turn);
    if (!turn.answer) break;
    history.push({ role: "user", content: query }, { role: "assistant", content: turn.answer });
    priorQuestions.push(query);
    const next = turn.pulls.find((pull) => pull?.query && !priorQuestions.includes(pull.query));
    if (!next) break;
    query = next.query;
  }
  return { rootQuestion, turns };
};

const paths = new Array(questions.length);
let cursor = 0;
const worker = async () => {
  for (;;) {
    const index = cursor;
    cursor += 1;
    if (index >= questions.length) return;
    paths[index] = await runPath(questions[index]);
    console.log(`[${index + 1}/${questions.length}] ${questions[index]}`);
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));

const turns = paths.flatMap((path) => path.turns);
const latencies = turns.map((turn) => turn.latencyMs);
const rates = Object.fromEntries(
  Object.keys(turns[0]?.checks || {}).map((key) => [
    key,
    turns.length ? Math.round((turns.filter((turn) => turn.checks[key]).length / turns.length) * 1000) / 1000 : 0,
  ]),
);
const openings = turns.map((turn) => words(turn.answer).slice(0, 3).join(" ").toLowerCase()).filter(Boolean);
const repeatedOpenings = openings.filter((opening, index) => openings.indexOf(opening) !== index);

const report = {
  generatedAt: new Date().toISOString(),
  model: "configured production model",
  target: remoteUrl || "local handler",
  questionCount: questions.length,
  requestedTurns: questions.length * 3,
  completedTurns: turns.length,
  automated: {
    rates,
    answerLatencyP50Ms: percentile(latencies, 0.5),
    answerLatencyP95Ms: percentile(latencies, 0.95),
    repeatedOpeningRate: openings.length ? Math.round((repeatedOpenings.length / openings.length) * 1000) / 1000 : 0,
  },
  humanReviewRequired: {
    factualAccuracy: "mark pass, uncertain or fail for every answer",
    directness: "does the first clause answer the actual question?",
    voice: "does this sound like the same socially sharp, mischievous person without forcing slang or attitude?",
    earnedSkepticism: "does WHY question a polished explanation only when the evidence leaves a real loose thread?",
    causalClarity: "does the answer clearly explain what produced the outcome or why the claim holds?",
    groundedSpecificity: "does it prefer a supported actor, institution, object or mechanism without inventing or forcing one?",
    characterThroughObservation: "is WHY felt through what it notices rather than self-description, mascot behavior or automatic contrarianism?",
    spark: "is there no more than one earned vivid detail, reversal, joke or memorable line?",
    doorRelevance: "does each door clearly continue a concrete answer detail?",
    doorNovelty: "does each door buy information not already covered?",
    doorPayoffDiversity: "do the three doors offer genuinely different reasons to click rather than filling fixed categories?",
    repetition: "flag recurring metaphors, rhythms, jokes and sentence shapes",
  },
  reviewerBenchmark: {
    question: "how did vikings reach america?",
    strong: "norse sailors pushed past greenland around 1000 and reached newfoundland. l'anse aux meadows is where a viking saga stopped sounding like gossip and became archaeology.",
    weak: "vikings reached america through iceland and greenland. here are three related questions.",
    instruction: "use this only to calibrate human review for direct truth, causal clarity, supported specificity and one memorable spark. do not require or reward copying its wording.",
  },
  paths,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote ${turns.length} turns to ${outputPath}`);
const operationallyComplete = turns.length === questions.length * 3 && turns.every((turn) => turn.status === 200 && turn.answer && turn.checks.boardReady);
if (!operationallyComplete) {
  console.error("Evaluation incomplete: every path must produce three successful answers before quality scores are valid.");
  process.exitCode = 1;
}
