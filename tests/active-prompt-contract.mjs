import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../netlify/functions/ultimate-search.mjs";

process.env.OPENROUTER_API_KEY = "test-only-key";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = readFileSync(join(root, "netlify/functions/ultimate-search.mjs"), "utf8");
let pass = 0;
let fail = 0;
const check = (name, condition) => {
  if (condition) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}`); }
};
const request = (body) => new Request("https://why.com/api/ultimate-search", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const sse = (payload) => new Response(
  `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(payload) } }] })}\n\ndata: [DONE]\n\n`,
  { status: 200, headers: { "content-type": "text/event-stream" } },
);
const completion = (payload) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(payload) } }],
  usage: { prompt_tokens: 100, prompt_tokens_details: { cached_tokens: 80 } },
}), { status: 200, headers: { "content-type": "application/json" } });

console.log("\n[one-turn answer contract]");
const answerCalls = [];
globalThis.fetch = async (_url, init) => {
  answerCalls.push(JSON.parse(init.body));
  return sse({
    answer: "ice floats because freezing spreads its molecules into a roomier lattice. solid water is the rare guest that takes up more space.",
    doors: [
      { label: "lattice", query: "how does the crystal lattice open?" },
      { label: "exceptions", query: "does every frozen liquid also float?" },
      { label: "lakes", query: "why do lakes freeze from above?" },
    ],
  });
};
const response = await handler(request({
  action: "answer",
  query: "why does ice float?",
  runtime: { timeZone: "America/Los_Angeles" },
  history: [{ role: "assistant", content: "earlier context" }],
  path: { domain: "science", grounding: "required" },
  curiosity: { memoryCues: [{ domain: "public", topics: ["bridges"], mechanism: "load sharing", entity: "" }] },
}));
const streamed = await response.text();
const upstream = answerCalls[0];
const system = upstream?.messages?.[0]?.content || "";
const user = upstream?.messages?.at(-1)?.content || "";
const schema = upstream?.response_format?.json_schema?.schema;
check("normal turns make exactly one upstream request", answerCalls.length === 1);
check("the active voice is one evidence-first main character", system.includes("restless, rebellious energy of a mid-twenties main character") && system.includes("you do not rebel against facts") && system.includes("smartest person at the afterparty"));
check("character comes from observation rather than forced performance", system.includes("the character is felt through what you notice") && system.includes("never strain for slang") && system.includes("posture as a shock jock"));
check("truth still outranks personality", system.includes("never invent a name, number, date, quote, study, motive or allegation") && system.includes("calm, direct, humane"));
check("the voice has one-flourish discipline", system.includes("no more than one spark") && system.includes("vivid detail, reversal, joke or line worth repeating"));
check("answers are streamlined around truth, causality and one spark", system.includes("20-45 words") && system.includes("give the clearest true answer first") && system.includes("show the causal movement"));
check("forced controversy and concrete openers are gone", !system.includes("pick a side in the first four words") && !system.includes("a person, a scene or a real number has to show up in the first sentence") && !system.includes("at least one of the two must be a reaction"));
check("the three questions use a flexible payoff menu", system.includes("human desire, status, money, incentives, power, danger, scandal, hidden mechanisms, reversals and surprising consequences") && system.includes("never force a category"));
check("fixed desire money power slots are gone", !system.includes("question one is DESIRE") && !system.includes("question two is MONEY") && !system.includes("question three is POWER"));
check("the visible question is the entire button", system.includes("is the entire button") && system.includes("label is a short internal handle nobody will ever see"));
check("doors require three different promises anchored to the answer", system.includes("different temptations") && system.includes("concrete detail or claim in the answer") && system.includes("information the answer has not already revealed"));
check("crisis receives calm questions", system.includes("ask three calm, useful, humane questions") && !system.includes("STAKE ASSIGNMENT"));
// This model accepts only the default temperature, and require_parameters turns an
// unsupported sampling parameter into an unroutable request. Voice comes from the
// prompt and from reasoning budget on this model family, never from sampling.
check("the live turn sends no unsupported sampling parameter", upstream?.temperature === undefined && upstream?.top_p === undefined);
check("the schema asks only for compact handles and visible questions", JSON.stringify(schema?.required) === JSON.stringify(["answer", "doors"]) && schema?.properties?.doors?.minItems === 3 && schema?.properties?.doors?.maxItems === 3 && JSON.stringify(schema?.properties?.doors?.items?.required) === JSON.stringify(["label", "query"]) && !schema?.properties?.doors?.items?.properties?.role && !schema?.properties?.doors?.items?.properties?.stake);
check("structured turns never attach web tools", !Object.hasOwn(upstream || {}, "tools"));
check("one earned cue is isolated to door three", user.includes("DOOR THREE ONLY") && user.includes("load sharing") && user.includes("never use this in the answer"));
check("the actual upstream request receives trusted runtime context", user.includes("TRUSTED RUNTIME CONTEXT") && user.includes("time zone: America/Los_Angeles") && /current date: \w+, \w+ \d{1,2}, \d{4}/.test(user));
check("the stream contains the complete structured turn", streamed.includes('"answer"') && streamed.includes('"doors"'));

console.log("\n[manual recovery contract]");
const recoveryCalls = [];
globalThis.fetch = async (_url, init) => {
  recoveryCalls.push(JSON.parse(init.body));
  return completion({ doors: [
    { label: "ships", query: "how did viking ships cross the atlantic?" },
    { label: "leif", query: "was leif erikson really the first?" },
    { label: "settlement", query: "why did the viking settlement fail?" },
  ] });
};
const recoveryResponse = await handler(request({
  action: "doors",
  query: "how did vikings reach america?",
  answer: "vikings sailed through iceland and greenland to newfoundland around 1000. l’anse aux meadows turned saga into archaeology.",
  domain: "public",
  path: { priorQuestions: [] },
}));
const recovery = await recoveryResponse.json();
const recoveryPayload = recoveryCalls[0];
check("manual recovery makes one request and no judge request", recoveryCalls.length === 1);
check("manual recovery requests only three label-query pairs", recoveryPayload?.response_format?.json_schema?.schema?.properties?.doors?.minItems === 3 && recoveryPayload?.response_format?.json_schema?.schema?.properties?.doors?.items?.additionalProperties === false && recoveryPayload?.max_tokens === 220);
check("manual recovery never uses web tools", !Object.hasOwn(recoveryPayload || {}, "tools"));
check("manual recovery preserves the accepted answer as data", recoveryPayload?.messages?.at(-1)?.content.includes("l’anse aux meadows"));
check("manual recovery keeps compact handles beside conversational questions", recovery.doorState === "ready" && recovery.voiceNote?.copyStyle === "question_v2" && recovery.voiceNote?.pulls?.length === 3 && recovery.voiceNote.pulls.every((door) => door.label !== door.query));
check("the three jobs are assigned deterministically", recovery.voiceNote?.pulls?.map((door) => door.promise).join("|") === "microscope|trapdoor|telescope");

console.log("\n[removed machinery]");
let rejectedCalls = 0;
globalThis.fetch = async () => { rejectedCalls += 1; return completion({}); };
const rejected = await handler(request({ action: "answer-pack", query: "why?" }));
check("answer-pack is rejected before any upstream request", rejected.status === 400 && rejectedCalls === 0);
check("one canonical voice source exists", (server.match(/const WHY_VOICE\s*=/g) || []).length === 1);
// gpt-5.6-luna lists neither temperature nor top_p in supported_parameters, so any
// sampling parameter is either dropped in silence or, under require_parameters,
// makes the request unroutable. No generator may send one.
check("no generator sends a sampling parameter this model cannot accept", [
  "netlify/functions/ultimate-search.mjs",
  "netlify/lib/category-seeds.mjs",
  "netlify/lib/daily-why-generation.mjs",
].every((file) => !/^\s*(?:temperature|top_p|top_k):/m.test(readFileSync(join(root, file), "utf8"))));
check("candidate, judge, prefetch and stake machinery is absent", !/(formatVoiceNote|semanticDoorContract|WHY_JUDGE_MODE|answer-pack|selectDiverseDoors|doorCombinations|STAKE_BANDS|stakeAssignment|stakeBlock)/.test(server));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
