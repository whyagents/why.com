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

console.log("\n[WHY] unified questioning-layer narrative");
check("About states the mission and business loop", pages["about.html"].includes("WHY teaches machines what to question next.") && pages["about.html"].includes("Free users reveal where curiosity wants to go. Experts show where intelligence should go. AI labs pay to learn the difference."));
check("AI explains the human decision layer", pages["ai.html"].includes("AI that knows why") && pages["ai.html"].includes("one answer and three validated directions") && pages["ai.html"].includes("training data, reward models, and private evaluations"));
check("Research keeps observation distinct from conscious rejection", pages["research.html"].includes("conscious rejection is not assumed") && pages["research.html"].includes("not treated as independent votes or proof that they were read"));
check("Research separates deployed work from hypotheses", pages["research.html"].includes("The deployed product is the baseline") && pages["research.html"].includes("remain a falsifiable research program"));
check("Research separates consumer, expert, AI, and private layers", pages["research.html"].includes("One Platform, Separate Evidence") && pages["research.html"].includes("WHY Pro") && pages["research.html"].includes("not population training data by default"));
check("Desktop is positioned around personal questioning value", pages["app.html"].includes("your private questioning layer") && pages["app.html"].includes("ask what deserves attention next"));
check("Desktop explicitly protects private memory", pages["app.html"].includes("does not become population training data by default") && pages["app.html"].includes("permissioned context"));
check("Each page keeps its short established title", pages["about.html"].includes("<title>About - WHY</title>") && pages["ai.html"].includes("<title>AI - WHY</title>") && pages["research.html"].includes("<title>Research - WHY</title>") && pages["app.html"].includes("<title>Desktop - WHY</title>"));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
