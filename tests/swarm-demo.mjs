import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const root = process.cwd();
const page = readFileSync(join(root, "swarm.html"), "utf8");
const adapterSource = readFileSync(join(root, "swarm-demo.js"), "utf8");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const build = readFileSync(join(root, "scripts/build-public.mjs"), "utf8");

let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.error(`  FAIL  ${name}`); }
};

const sandbox = { window: {} };
runInNewContext(adapterSource, sandbox);
const adapter = sandbox.window.WHY_SWARM_DEMO;
const first = adapter.answer({ query: "Why are superstar athletes becoming bigger than their teams?", domain: "public" });
const second = adapter.answer({ query: first.voiceNote.pulls[0].query, domain: "technology" });

console.log("\n[swarm pilot] isolated offline experience");
check("the exact Swarm greeting is configured", adapter.greeting === "Hello Swarm. We look forward to piloting your services.");
check("the adapter contains no network call", !/\bfetch\s*\(/.test(adapterSource));
check("every canned answer returns three questions", first.voiceNote.pulls.length === 3 && second.voiceNote.pulls.length === 3);
check("canned continuations remain interactive", first.voiceNote.pulls[0].query !== second.voiceNote.pulls[0].query);
check("receipts and preview notices cannot trigger network copy", first.receiptsAvailable === false && first.grounding === "off" && first.preview === false);
check("the page activates the isolated Swarm marker", page.includes('data-swarm-demo="true"'));
check("the page loads the adapter before the shared client", page.includes("swarm-demo.js") && page.indexOf("swarm-demo.js") < page.indexOf("$&"));
check("the client exits through the adapter before production fetch", client.indexOf("if (SWARM_DEMO) {") < client.indexOf('fetch("/api/ultimate-search"'));
check("category generation is bypassed in Swarm mode", client.includes("if (SWARM_DEMO) {\n      const seeds = localCategoryPool(category);"));
check("the homepage replaces custom search with the Whitepaper", client.includes('href="whitepaper.pdf"') && client.includes("WHY Whitepaper"));
check("the deployment allowlist includes both pilot files", build.includes('"swarm.html"') && build.includes('"swarm-demo.js"'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
