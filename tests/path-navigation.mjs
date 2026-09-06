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

const labelSource = client.slice(
  client.indexOf("const PATH_FILLER_WORDS"),
  client.indexOf("const NAME_MIN_PULLS"),
);
const labelSandbox = {};
runInNewContext(`
  const cleanText = (value, max = 4000) => String(value || "").replace(/\\s+/g, " ").trim().slice(0, max);
  const recentLabel = (query) => cleanText(query, 40);
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  ${labelSource}
  globalThis.label = pathLabel;
  globalThis.markup = pathMarkup;
`, labelSandbox);

console.log("\n[path labels] compact connection language");
check("Afghanistan origin becomes a compact concept", labelSandbox.label("Why did the USA go into Afghanistan?") === "USA in Afghanistan");
check("door question becomes an actor plus action", labelSandbox.label("why did al-qaeda leaders escape?") === "al-qaeda escape");
check("possessive questions become clean noun connections", labelSandbox.label("why did Rome lose its armies?") === "Rome's armies");

const nodes = Array.from({ length: 6 }, (_, index) => ({
  id: `node-${index + 1}`,
  question: index === 0 ? "Why did the USA go into Afghanistan?" : `Why did event ${index + 1} happen?`,
  user: { via: index === 1 ? { label: "why did al-qaeda leaders escape?" } : null },
}));
const markup = labelSandbox.markup(nodes, "thread-1");
check("prior concepts are real local links", (markup.match(/data-path-node=/g) || []).length === 5 && markup.includes('data-path-thread="thread-1"'));
check("current concept is visibly non-linked", markup.includes('class="path-crumb path-current"') && markup.includes('aria-current="page"'));
check("desktop and mobile overflow counts are explicit", markup.includes('path-more-desktop">+1') && markup.includes('path-more-mobile">+3'));
check("trail announces its current depth", markup.includes("your path · 6 deep"));

const restoreSource = client.slice(
  client.indexOf("function restorePathNode"),
  client.indexOf("function restoreThread"),
);
const original = {
  id: "thread-original",
  title: "Why did the USA go into Afghanistan?",
  messages: [
    { id: "u1", role: "user", content: "Why did the USA go into Afghanistan?" },
    { id: "a1", nodeId: "node-1", role: "assistant", content: "answer one" },
    { id: "u2", role: "user", content: "why did al-qaeda leaders escape?" },
    { id: "a2", nodeId: "node-2", role: "assistant", content: "answer two" },
  ],
};
const restoreSandbox = {
  state: { threads: [original] },
  active: original,
  lastVisibleNodeId: "node-2",
  ledger: { currentDepthStreak: 1 },
  structuredClone,
  saved: null,
  rendered: null,
  tracked: null,
};
runInNewContext(`
  const completedNodes = (thread) => thread ? [
    { id: "node-1", depth: 1, answerIndex: 1 },
    { id: "node-2", depth: 2, answerIndex: 3 },
  ] : [];
  const uid = () => "thread-branch";
  const invalidateNavigation = () => {};
  const resetPathSession = () => {};
  const persistLedger = () => {};
  const closeComposer = () => {};
  const saveThread = (thread) => { saved = thread; state.threads.unshift(thread); return true; };
  const warnVolatileThread = () => {};
  const renderActiveNode = (thread) => { rendered = thread; };
  const track = (_name, detail) => { tracked = detail; };
  const $ = () => null;
  ${restoreSource}
  globalThis.restore = restorePathNode;
`, restoreSandbox);
restoreSandbox.restore("thread-original", "node-1");

console.log("\n[path navigation] non-destructive local branching");
check("returning to a prior answer creates a prefix branch", restoreSandbox.saved?.messages.length === 2 && restoreSandbox.rendered?.id === "thread-branch");
check("the original deeper path remains intact", original.messages.length === 4 && restoreSandbox.state.threads.some((thread) => thread.id === "thread-original"));
check("breadcrumb navigation performs no network request", !restoreSource.includes("fetch(") && !restoreSource.includes("requestAnswer") && restoreSource.includes("suppressPrefetch: true"));
check("connection trail is desktop-only", page.includes(".path-status{display:none!important}"));
check("mobile History remains available through the shared menu", page.includes('data-action="history"'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
