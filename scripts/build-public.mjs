import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CURRENT_DAILY_WHY, DAILY_WHY_EPISODES, publicDailyEpisode } from "../netlify/lib/daily-why.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, ".netlify-dist");

// This manifest is the deployment boundary. Only files listed here can be
// served by Netlify's static publisher.
const publicFiles = [
  "about.html",
  "ads-demo.js",
  "ads.html",
  "ai.html",
  "app.html",
  "banner.png",
  "banner.svg",
  "deck.html",
  "favicon.svg",
  "index.html",
  "litepaper.pdf",
  "os.png",
  "privacy.html",
  "pro.html",
  "public/og.png",
  "research.html",
  "swarm-demo.js",
  "swarm.html",
  "terms.html",
  "why-app.js",
  "why-consent.css",
  "why-consent.js",
  "whitepaper.pdf",
];

const requireSource = async (relativePath) => {
  const source = join(projectRoot, relativePath);
  const details = await stat(source).catch(() => null);
  if (!details?.isFile()) throw new Error(`Missing public source: ${relativePath}`);
  return source;
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const relativePath of publicFiles) {
  const source = await requireSource(relativePath);
  const destination = join(outputRoot, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const rabbitCategories = ["sports", "entertainment", "travel", "technology", "business", "politics"];
const rabbitLauncher = `<section class="rabbit-launcher" aria-labelledby="rabbitLauncherTitle"><h2 id="rabbitLauncherTitle">Pick a rabbit hole</h2><div class="rabbit-grid">${rabbitCategories.map((category) => `<button class="rabbit-category" type="button" data-rabbit-category="${category}">${category}</button>`).join("")}</div></section>`;

await writeFile(
  join(outputRoot, "daily-why.json"),
  JSON.stringify({ episode: publicDailyEpisode(CURRENT_DAILY_WHY), stats: { available: false, participants: 0, nodes: {} } }),
);

const appShell = await readFile(join(projectRoot, "index.html"), "utf8");
const adsTemplate = await readFile(join(projectRoot, "ads.html"), "utf8");
const adsStyles = adsTemplate.match(/const demoStyles = `([\s\S]*?)`;/)?.[1];
if (!adsStyles) throw new Error("The advertising demo styles could not be extracted.");
const adsPage = appShell
  .replace(/(<script id="Cookiebot"[^>]*?)\s+src="[^"]+"/i, "$1")
  .replace("<body>", '<body data-ads-demo="true">')
  .replace("<title>WHY.</title>", "<title>AI-Native Advertising Demo — WHY.</title>")
  .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex,nofollow">')
  .replace("</head>", adsStyles + "</head>")
  .replace(
    /<script src="why-app\.js[^>]*><\/script>/,
    '<script src="ads-demo.js?v=20260915-05" defer></script>\n  <script src="why-app.js?v=20260915-ads03" defer></script>',
  );
await writeFile(join(outputRoot, "ads.html"), adsPage);

for (const dailyEpisode of DAILY_WHY_EPISODES) {
  const dailyUrl = `https://why.com/daily/${dailyEpisode.id}/`;
  const description = `Today’s WHY: ${dailyEpisode.question} Choose a path and see where everyone else went.`;
  const dailyRoot = dailyEpisode.nodes.find((node) => node.id === dailyEpisode.rootNodeId);
  if (!dailyRoot || dailyRoot.doors.length !== 3) throw new Error(`Daily episode ${dailyEpisode.id} needs exactly three root doors.`);
  const rootDoors = dailyRoot.doors.map((door, index) => `<button class="daily-root-door" type="button" data-daily-door-id="${escapeHtml(door.id)}" data-position="${index + 1}" aria-label="${escapeHtml(`${door.label} — ${door.query}`)}"><span>${escapeHtml(door.query)}</span></button>`).join("");
  const serverRenderedDaily = `<section class="daily-home-card is-ready" aria-label="Today’s WHY: ${escapeHtml(dailyEpisode.question)}"><span class="daily-kicker">Today’s WHY</span><h1><span class="daily-question-text" data-daily-question>${escapeHtml(dailyEpisode.question)}</span></h1><div class="daily-root-board" data-daily-root-board aria-label="Choose one of three paths">${rootDoors}</div><small class="daily-explorers">collective paths appear after you choose</small></section>${rabbitLauncher}<button class="daily-own-toggle" type="button" data-action="open-daily-search">Ask your own WHY</button>`;
  const dailyPage = appShell
    .replace("<head>", '<head>\n  <base href="/">')
    .replace("<body>", `<body data-daily-episode-id="${escapeHtml(dailyEpisode.id)}">`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(dailyEpisode.question)} · WHY.">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${dailyUrl}">`)
    .replace("<title>WHY.</title>", `<title>${escapeHtml(dailyEpisode.question)} · WHY.</title>`)
    .replace('<div class="seed-board" id="seedBoard" aria-label="Start a curiosity path"></div>', `<div class="seed-board" id="seedBoard" aria-label="Start today’s WHY">${serverRenderedDaily}</div>`);
  const dailyDirectory = join(outputRoot, "daily", dailyEpisode.id);
  await mkdir(dailyDirectory, { recursive: true });
  await writeFile(join(dailyDirectory, "index.html"), dailyPage);
  await writeFile(
    join(dailyDirectory, "episode.json"),
    JSON.stringify({ episode: publicDailyEpisode(dailyEpisode), stats: { available: false, participants: 0, nodes: {} } }),
  );
}

console.log(`Built ${publicFiles.length} approved files and ${DAILY_WHY_EPISODES.length} daily episode into .netlify-dist`);
