import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const page = readFileSync(join(root, "pro.html"), "utf8");
const build = readFileSync(join(root, "scripts/build-public.mjs"), "utf8");
const visiblePage = page.slice(page.indexOf("<body>"));
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.error(`  FAIL  ${name}`); }
};

console.log("\n[WHY PRO] application-first content");
check("the application is the first main section", /<main>\s*<section class="apply-section"/.test(page));
check("the early cohort leads the page", page.includes('<p class="eyebrow">Early cohort</p><h1>Teach AI what to question.</h1>'));
check("the cohort headline stays proportionate", page.includes("font-size:clamp(3.25rem,5.35vw,5.4rem)") && page.includes("font-size:clamp(3rem,14.5vw,4.2rem)"));
check("page avoids named-company comparisons", !/AfterQuery|OpenAI|Anthropic|Google|Perplexity/i.test(visiblePage));
check("the removed manifesto is absent", !page.includes("Before an answer, there is a question.") && !page.includes("WHY already generates questioning data.") && !page.includes("A corpus that renews itself."));
check("privacy separation remains explicit", page.includes("My private WHY curiosity history is separate"));
check("the shorter application omits unnecessary qualification fields", !page.includes("strong-questions") && !page.includes("missing-questions") && !page.includes('name="reddit"'));

console.log("\n[WHY PRO] application and interaction");
check("application uses the existing Netlify host", page.includes('data-netlify="true"') && page.includes('netlify-honeypot="company-website"'));
check("all retained application fields exist", ["name", "email", "expertise", "background", "links"].every((name) => page.includes(`name="${name}"`)));
check("submission explicitly preserves the Netlify form identity", page.includes('payload.set("form-name", form.getAttribute("name"))'));
check("the compact application no longer carries an emphasized essay field", !page.includes('class="field wide important"'));
check("success is gated on an OK response", page.indexOf("if (!response.ok)") < page.indexOf("Application received."));
check("reduced motion is respected", page.includes("prefers-reduced-motion:reduce") && page.includes("animation-duration:.001ms"));
check("navigation exposes accessible state", page.includes('aria-expanded="false"') && page.includes('aria-hidden="true"') && page.includes("menuPanel.inert"));

console.log("\n[WHY PRO] metadata, analytics and deployment");
check("metadata matches the application-first page", page.includes("WHY PRO — Teach AI What to Question") && page.includes("WHY PRO is building human questioning data for the next generation of AI models."));
check("metadata uses the clean public URL", page.includes('<meta property="og:url" content="https://why.com/pro">') && page.includes('<link rel="canonical" href="https://why.com/pro">'));
check("analytics uses the existing consent-aware adapter", page.includes("window.whyAnalytics?.track") && !page.includes("formData") && !page.includes("gtag(\"event\", name,"));
check("page-view and successful-submit events remain", ["pro_page_view", "pro_application_submit"].every((event) => page.includes(event)));
check("deployment manifest includes pro.html", build.includes('"pro.html"'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
