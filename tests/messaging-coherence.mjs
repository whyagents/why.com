import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pages = Object.fromEntries(["about.html", "ai.html", "research.html", "app.html"].map((name) => [name, readFileSync(join(root, name), "utf8")]));
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.error(`  FAIL  ${name}`); }
};

console.log("\n[WHY] unified product-and-research narrative");
check("About preserves the resurrection story", pages["about.html"].includes("The question<br><em>survived.</em>") && pages["about.html"].includes("The product is live. The learning architecture is being tested."));
check("About names the company and separates the two programs", pages["about.html"].includes("built by Ockams, Inc.") && pages["about.html"].includes("one explores questions; the other tests how experience becomes useful memory"));
check("AI uses the canonical umbrella", pages["ai.html"].includes("AI with a WHY") && pages["ai.html"].includes("We build tools for exploring questions and research how AI learns from experience."));
check("AI separates live product from controlled research", pages["ai.html"].includes("Live product") && pages["ai.html"].includes("Controlled experiment") && pages["ai.html"].includes("does not establish that the result transfers to language-model agents"));
check("Research keeps observation distinct from conscious rejection", pages["research.html"].includes("conscious rejection is not assumed") && pages["research.html"].includes("not treated as independent votes or proof that they were read"));
check("Research leads with the current memory experiment", pages["research.html"].includes("Every memory needs a WHY.") && pages["research.html"].includes("Thirteen memory policies across five simulated scenarios and twenty evaluation seeds"));
check("Research states the experimental boundary", pages["research.html"].includes("used a Bayesian logistic agent, not an LLM") && pages["research.html"].includes("requires a separate evaluation"));
check("Research keeps WP-02 accessible as prior work", pages["research.html"].includes("Prior work · WP-02") && pages["research.html"].includes("whitepaper.pdf"));
check("Desktop uses the approved privacy promise", pages["app.html"].includes("Your memory.<br>") && pages["app.html"].includes("<em>Your terms.</em>") && pages["app.html"].includes("Remember more.<br>"));
check("Desktop identifies itself as a pilot", pages["app.html"].includes("local-first pilot") && pages["app.html"].includes("does not yet implement the complete consequence-aware consolidation architecture"));
check("Each page keeps its short established title", pages["about.html"].includes("<title>About - WHY</title>") && pages["ai.html"].includes("<title>AI - WHY</title>") && pages["research.html"].includes("<title>Research - WHY</title>") && pages["app.html"].includes("<title>Desktop - WHY</title>"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
