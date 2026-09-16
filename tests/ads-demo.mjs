import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const root = process.cwd();
const page = readFileSync(join(root, "ads.html"), "utf8");
const adapterSource = readFileSync(join(root, "ads-demo.js"), "utf8");
const client = readFileSync(join(root, "why-app.js"), "utf8");
const index = readFileSync(join(root, "index.html"), "utf8");
const build = readFileSync(join(root, "scripts/build-public.mjs"), "utf8");

let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log("  PASS  " + name); }
  else { fail += 1; console.error("  FAIL  " + name); }
};

const sandbox = { window: {} };
runInNewContext(adapterSource, sandbox);
const adapter = sandbox.window.WHY_ADS_DEMO;
const first = adapter.answer({ query: adapter.homeChoices[0].query, domain: "public" });
const second = adapter.answer({ query: first.voiceNote.pulls[0].query, domain: "public" });
const third = adapter.answer({ query: second.voiceNote.pulls[0].query, domain: "public" });
const sponsoredDoor = third.voiceNote.pulls.find((door) => door.query === adapter.campaign.sponsoredQuery);
const sponsored = adapter.answer({ query: sponsoredDoor?.query, domain: "public" });

console.log("\n[AI-native advertising demo] isolated four-step experience");
check("the page reuses the WHY shell", page.includes('fetch("index.html"') && page.includes('data-ads-demo="true"'));
check("the page is explicitly excluded from search", page.includes('name="robots" content="noindex,nofollow"'));
check("the adapter loads before the shared client", page.includes("ads-demo.js?v=20260915-03") && page.includes("why-app.js?v=20260915-ads01"));
check("the adapter makes no network or persistence call", !/\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)\b/.test(adapterSource));
check("the campaign starts with three native choices", adapter.homeChoices.length === 3);
check("the first three answer boards each contain exactly three paths", [first, second, third].every((result) => result.voiceNote.pulls.length === 3));
check("the sponsored path appears only after three organic answers", !first.voiceNote.pulls.some((door) => door.query === adapter.campaign.sponsoredQuery) && !second.voiceNote.pulls.some((door) => door.query === adapter.campaign.sponsoredQuery) && Boolean(sponsoredDoor));
check("the sponsored answer remains a real WHY answer", typeof sponsored.answer === "string" && sponsored.answer.length > 40);
check("the sample campaign is conspicuously disclosed", adapter.campaign.disclosure.includes("no affiliation") && adapterSource.includes('tag.textContent = "Sponsored"'));
check("the sponsored path uses only the minimal label", !adapterSource.includes("Sponsored · Cars.com example") && page.includes("color:#d97969"));
check("the illustrative economics are explicit", adapter.campaign.bidDollars === 100 && adapterSource.includes("qualified-lead bid"));
check("lead capture asks for only four useful signals", adapter.campaign.qualifiers.length === 2 && adapter.campaign.fields.length === 2 && adapter.campaign.fields.some((field) => field.name === "email" && field.required));
check("tap choices reveal one compact contact step", adapterSource.includes('input.type = "radio"') && adapterSource.includes("contactStep.hidden = !ready"));
check("the lead moment temporarily hides competing questions and composer", adapterSource.includes('root.querySelector(".door-zone")?.setAttribute("hidden", "")') && adapterSource.includes('followForm?.setAttribute("hidden", "")'));
check("a valid opt-in restores the exact curiosity path", adapterSource.includes('doorZone?.removeAttribute("hidden")') && adapterSource.includes('document.querySelector("#followForm")?.removeAttribute("hidden")'));
check("the restored path receives an accessible continuation focus", adapterSource.includes('firstDoor?.focus({ preventScroll: true })'));
check("the lead surface stays visually native", page.includes(".ads-choice-row") && !page.includes("background:linear-gradient") && !page.includes("border:1px solid rgba(196,170,114,.34)"));
check("the submit control is transparent and rectangular", page.includes(".ads-lead-submit") && page.includes("border-radius:2px") && page.includes("background:transparent"));
check("the demo states that form data is never transmitted or retained", adapterSource.includes("Nothing entered here is transmitted or retained."));
check("the shared client isolates the ads adapter before production fetch", client.indexOf("if (ADS_DEMO) {") < client.indexOf('fetch("/api/ultimate-search"'));
check("the demo greeting cannot rotate into production questions", client.includes("if (ADS_DEMO || SWARM_DEMO || REDUCED_MOTION.matches"));
check("the production homepage does not activate the ads demo", !index.includes('data-ads-demo="true"') && !index.includes("ads-demo.js"));
check("the deployment boundary includes both demo files", build.includes('"ads.html"') && build.includes('"ads-demo.js"'));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exitCode = 1;
