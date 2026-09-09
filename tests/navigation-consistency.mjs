import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pages = ["index.html", "about.html", "ai.html", "app.html", "research.html", "pro.html"];
const expectedLabels = ["AI", "About", "Desktop", "Discord", "Research"];
const homepageLabels = ["AI", "About", "Desktop", "Discord", "Pro"];
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.error(`  FAIL  ${name}`); }
};

console.log("\n[WHY] shared dropdown navigation");
for (const filename of pages) {
  const page = readFileSync(join(root, filename), "utf8");
  const dropdown = page.match(/<div class="nav-dropdown"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const labels = [...dropdown.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map((match) => match[1].trim());
  const expected = filename === "index.html" ? homepageLabels : expectedLabels;
  check(`${filename} uses the intended five-link order`, JSON.stringify(labels) === JSON.stringify(expected));
  check(`${filename} keeps the dropdown text-only`, dropdown.length > 0 && !dropdown.includes("<svg"));
  check(`${filename} excludes History and limits PRO to the homepage`, !/History/i.test(dropdown) && (filename === "index.html" ? dropdown.includes('href="/pro"') : !dropdown.includes("pro.html")));
}

const index = readFileSync(join(root, "index.html"), "utf8");
const pro = readFileSync(join(root, "pro.html"), "utf8");
const indexFooter = index.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] || "";
const proFooter = pro.match(/<footer>([\s\S]*?)<\/footer>/)?.[1] || "";
const incArticle = "https://www.inc.com/sam-blum/the-17000-domain-that-could-be-worth-70-million-just-became-an-ai-chatbot-instead-people-are-asking-why/91393038";
for (const signature of ["foot-socials", "https://x.com/whydots", "https://github.com/whyagents", "https://discord.gg/raAQCeDr3e", "© 2026 Ockams Inc. All rights reserved.", "Privacy choices"]) {
  check(`PRO footer includes ${signature}`, proFooter.includes(signature) && indexFooter.includes(signature));
}
check("homepage links its Inc. coverage above the footer", index.includes(`class="press-proof" href="${incArticle}"`) && index.indexOf('<a class="press-proof"') < index.indexOf("<footer>"));
check("Inc. coverage has explicit accessible context", index.includes('aria-label="Read about WHY.com in Inc."') && index.includes("As seen in"));
check("standalone why.com link above the PRO footer is removed", !pro.includes('class="text-link"'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
