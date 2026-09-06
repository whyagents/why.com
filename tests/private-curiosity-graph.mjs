import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const page = readFileSync(join(root, "index.html"), "utf8");

let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}`);
  }
};

const graphSource = client.slice(
  client.indexOf("function graphNodeKey"),
  client.indexOf("function persistCuriosityGraph"),
);
const sandbox = {};
runInNewContext(`
  const cleanText = (value, max = 4000) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, max);
  const cleanSpokenAnswer = (value) => cleanText(value, 8000);
  const hashString = (value) => {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  };
  const canonicalRole = (value) => String(value || "").toLowerCase();
  const VALID_ROLES = new Set(["deepen", "contradiction", "consequence", "origin", "surprise", "pattern"]);
  const VALID_PROMISES = new Set(["microscope", "trapdoor", "telescope"]);
  const PROMISE_FOR_ROLE = { deepen: "microscope", origin: "microscope", contradiction: "trapdoor", surprise: "trapdoor", consequence: "telescope", pattern: "telescope" };
  const VALID_LENSES = new Set(["money", "power", "cost", "mechanism", "evidence", "exception"]);
  const safeDomain = (value) => value || "public";
  const clampHeat = (value) => Number(value) || 0;
  const validSources = (value) => Array.isArray(value) ? value : [];
  const $number = (value) => Number(value) || 0;
  const completedNodes = (thread) => thread.nodes;
  ${graphSource}
  globalThis.build = buildCuriosityGraph;
`, sandbox);

const rootNode = {
  id: "node-root",
  question: "Why did Rome fall?",
  user: { id: "u-root", content: "Why did Rome fall?", source: "typed" },
  answer: { id: "a-root", nodeId: "node-root", content: "Rome's bargains broke.", domain: "public" },
};
const taxNode = {
  id: "node-tax",
  question: "Who carried the tax burden?",
  user: {
    id: "u-tax",
    content: "Who carried the tax burden?",
    source: "door",
    selectionId: "selection-tax",
    via: { role: "consequence", lens: "money", domain: "public", label: "who carried the burden?", heat: 8 },
  },
  answer: { id: "a-tax", nodeId: "node-tax", content: "Small landholders carried it.", domain: "public" },
};
const armyNode = {
  id: "node-army",
  question: "Why did army loyalty fracture?",
  user: {
    id: "u-army",
    content: "Why did army loyalty fracture?",
    source: "door",
    selectionId: "selection-army",
    via: { role: "deepen", lens: "power", domain: "public", label: "why did loyalty fracture?", heat: 7 },
  },
  answer: { id: "a-army", nodeId: "node-army", content: "Generals became the paymasters.", domain: "public" },
};

const graph = sandbox.build([
  { id: "tax-path", title: "Rome", createdAt: 1, updatedAt: 3, nodes: [rootNode, taxNode] },
  { id: "army-path", title: "Rome", createdAt: 1, updatedAt: 4, nodes: [rootNode, armyNode] },
]);
const nodeValues = Object.values(graph.nodes);
const edgeValues = Object.values(graph.edges);

console.log("\n[private graph] compact shared structure");
check("graph envelope is local and versioned", graph.product === "WHY" && graph.version === 1);
check("shared branch prefixes are stored once", nodeValues.length === 3 && nodeValues.filter((node) => node.sourceNodeId === "node-root").length === 1);
check("each accepted selection becomes an explicit edge", edgeValues.length === 2 && edgeValues.every((edge) => edge.from && edge.to));
check("paths contain small node references", graph.paths.length === 2 && graph.paths.every((path) => path.nodeIds.length === 2));
check("edges retain their selected role without duplicating answer bodies", edgeValues.some((edge) => edge.role === "consequence") && !edgeValues.some((edge) => "answer" in edge));

console.log("\n[private graph] safe shadow behavior");
check("graph has its own versioned local key", client.includes('CURIOSITY_GRAPH_KEY = "whyCuriosityGraph.v1"'));
check("accepted threads remain authoritative", client.includes('const THREADS_KEY = "whyUltimateThreads.v2"'));
check("storage pressure evicts the recoverable graph before history", client.indexOf("removeStoredKey(CURIOSITY_GRAPH_KEY)") < client.indexOf("message.sources = []"));
check("imports, clears and cross-tab changes rebuild the graph", (client.match(/refreshCuriosityGraph\(\)/g) || []).length >= 6);

console.log("\n[answer view] no repeated full question");
check("completed and streaming answer cards omit question headings", !client.includes('<h1 class="node-question"'));
check("answer content receives keyboard focus", client.includes('tabindex="-1"><article class="prose"') && client.includes('$(".node-answer")?.focus'));
check("question-only visual rules are removed", !page.includes(".node-question {") && !page.includes(".node-question::before"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
