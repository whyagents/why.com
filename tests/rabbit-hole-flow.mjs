import handler from "../netlify/functions/ultimate-search.mjs";

process.env.OPENROUTER_API_KEY = "test-only-key";
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
const turn = {
  answer: "rome kept fighting over the throne while taxes hollowed out the army. the gates mattered; the civil war had already misplaced the keys.",
  doors: [
    { label: "succession", query: "how did succession crises break rome?" },
    { label: "invasions", query: "were invasions really decisive for rome?" },
    { label: "the east", query: "why did the eastern empire survive?" },
  ],
};
const sse = (payload = turn, status = 200) => new Response(
  `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(payload) } }] })}\n\ndata: [DONE]\n\n`,
  { status, headers: { "content-type": "text/event-stream" } },
);
const completion = (payload, status = 200) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify(payload) } }],
}), { status, headers: { "content-type": "application/json" } });

console.log("\n[transient answer retry]");
let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  return calls === 1 ? new Response("busy", { status: 503 }) : sse();
};
const retried = await handler(request({ action: "answer", query: "why did rome fall?", path: { domain: "public" } }));
const retriedText = await retried.text();
check("one transient 503 receives exactly one retry", calls === 2 && retried.status === 200);
check("the successful retry preserves answer and concept doors", retriedText.includes('"answer"') && retriedText.includes('"doors"'));

console.log("\n[non-retryable answer failure]");
calls = 0;
globalThis.fetch = async () => { calls += 1; return new Response("bad", { status: 422 }); };
const rejected = await handler(request({ action: "answer", query: "why did rome fall?" }));
check("a non-retryable upstream status is attempted once", calls === 1 && rejected.status === 422);

console.log("\n[manual board recovery]");
calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  return completion({ doors: turn.doors });
};
const doorsResponse = await handler(request({
  action: "doors",
  query: "why did rome fall?",
  answer: turn.answer,
  path: { domain: "public", priorQuestions: [] },
}));
const doors = await doorsResponse.json();
check("manual board recovery uses one bounded request", calls === 1 && doorsResponse.status === 200);
check("recovery returns exactly three conversational questions", doors.voiceNote?.pulls?.length === 3 && doors.voiceNote.copyStyle === "question_v2" && doors.voiceNote.pulls.every((door) => door.query.endsWith("?")));
check("each recovery question keeps a compact internal handle", doors.voiceNote?.pulls?.every((door) => door.label !== door.query && !door.label.endsWith("?")));

console.log("\n[invalid recovery]");
globalThis.fetch = async () => completion({ doors: [
  { label: "more", query: "why did rome fail again?" },
  { label: "more", query: "why did rome fail twice?" },
  { label: "next", query: "what happened after rome failed?" },
] });
const invalidResponse = await handler(request({ action: "doors", query: "why did rome fall?", answer: turn.answer }));
const invalid = await invalidResponse.json();
check("invalid recovery returns a handled dead-end state, not 503", invalidResponse.status === 200 && invalid.doorState === "unavailable");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
