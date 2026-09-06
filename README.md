<p align="center">
  <a href="https://why.com">
    <img src="os.png" width="260" alt="WHY.">
  </a>
</p>

<h1 align="center">One answer. Three questions.</h1>

<p align="center">
  An open-source curiosity engine that makes the next question the product.
</p>

<p align="center">
  <a href="https://why.com"><strong>Try WHY</strong></a>
  ·
  <a href="https://why.com/research"><strong>Research</strong></a>
  ·
  <a href="https://why.com/whitepaper.pdf"><strong>Whitepaper</strong></a>
  ·
  <a href="CONTRIBUTING.md"><strong>Contribute</strong></a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-c4aa72.svg"></a>
  <a href="https://why.com"><img alt="Live at why.com" src="https://img.shields.io/badge/live-why.com-080806.svg"></a>
  <img alt="No framework" src="https://img.shields.io/badge/framework-none-080806.svg">
  <img alt="Local-first memory" src="https://img.shields.io/badge/memory-local--first-080806.svg">
</p>

---

## WHY

Most AI products optimize the answer. WHY focuses on the moment immediately
after it: **what is the most interesting question you should ask next?**

Ask anything. WHY gives you one compact answer and three genuinely different
directions. Choose one and the process repeats, turning a search into a path:

```text
question → answer → three questions → choice → deeper answer → three more
                         │
                         └─ the two visible alternatives become comparative signal
```

The current product combines a live curiosity engine, an editorial Daily WHY,
and a private curiosity graph stored on the user's device. The larger research
question is whether chosen and unselected paths can help AI systems learn not
only how to answer a problem, but what deserves investigation next.

## What is open

This repository contains the production web application, server orchestration,
prompt and response contracts, local memory graph, Daily WHY system, database
migrations, security boundaries, build pipeline, and regression tests.

Production credentials, production databases, user data, and operational logs
are not included. The code is MIT licensed; the WHY name, domain, and brand are
not. See [TRADEMARKS.md](TRADEMARKS.md).

## The product loop

### 1. One structured turn

A normal request makes one structured model call. The response contains one
short answer and exactly three next questions. The answer can stream while the
complete turn is still being assembled.

### 2. Three different promises

The questions are composed to create three distinct kinds of curiosity:

- **Microscope** — get closer to the mechanism or origin
- **Trapdoor** — challenge the assumption or reveal the reversal
- **Telescope** — follow the consequence or larger pattern

The roles describe what a good board achieves; they are not visible category
labels and they do not excuse repetitive questions.

### 3. Deterministic boundaries

Model output is probabilistic. Product behavior is not. Server and client code
validate response shape, question count, length, uniqueness, prior-path
repetition, and safe request boundaries. Transient model failures receive one
bounded retry. A valid answer survives a failed question board, and the user
gets an explicit recovery action rather than a blank screen.

### 4. Local-first memory

The browser records questions as nodes and choices as edges in a compact private
graph. Earlier branches can share the same prefix instead of duplicating whole
transcripts. After meaningful history, WHY may use one small, non-sensitive cue
to make a later question feel connected. Raw cross-path transcripts are not sent.

### 5. Daily WHY

Daily WHY presents one editorial question and a shared three-way choice. Each
browser receives a stable, randomized order. The server stores a one-way hash of
an episode-scoped browser token with the selected path, position, and stake band,
then returns aggregate choice counts. No account or curiosity transcript is
attached to the vote.

## Architecture

```text
┌──────────────────────────────── Browser ────────────────────────────────┐
│ index.html          Product shell, consent and responsive presentation  │
│ why-app.js          Paths, rendering, local graph, recovery, analytics  │
│ localStorage        Private threads, graph, preferences and outcomes    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ same-origin JSON
┌──────────────────────── Netlify Functions ──────────────────────────────┐
│ ultimate-search.mjs   Structured answer + three-question orchestration  │
│ category-seeds.mjs    Shared rotating homepage question pools           │
│ daily-why.mjs         Editorial episode delivery and anonymous choices  │
│ publish-daily-why.mjs Scheduled Daily WHY publication                    │
└───────────────────┬────────────────────────────┬─────────────────────────┘
                    │                            │
              OpenRouter API              Netlify Database
              model inference             episodes + aggregate choices
```

WHY is intentionally small and inspectable:

- Browser-native HTML, CSS, and JavaScript
- ES modules on the server
- Netlify Functions and Netlify Database
- OpenRouter's OpenAI-compatible chat-completions API
- Node's built-in test runner
- No frontend framework and no client-side model credential

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | Main product shell and visual system |
| `why-app.js` | Client state, curiosity paths, local graph, UI and telemetry |
| `netlify/functions/ultimate-search.mjs` | Answer and next-question engine |
| `netlify/functions/daily-why.mjs` | Daily episode and aggregate choice API |
| `netlify/lib/` | Editorial generation, validation, storage and ordering logic |
| `netlify/database/migrations/` | Additive Postgres schema |
| `tests/` | Product, prompt, privacy, security and reliability contracts |
| `scripts/build-public.mjs` | Explicit public deployment allowlist |
| `scripts/eval-voice.mjs` | Live answer and voice evaluation harness |

## Quick start

### Requirements

- Node.js 22.12 or newer
- An [OpenRouter](https://openrouter.ai/) API key for live answers
- Netlify CLI for the full local function environment

### Install

```bash
git clone https://github.com/whyagents/why.com.git
cd why.com
npm ci
cp .env.example .env
```

Add your OpenRouter key to `.env`, then start Netlify's local environment:

```bash
npx netlify-cli dev
```

Open the local URL printed by Netlify, normally `http://localhost:8888`.

The static interface can be inspected without a model call, but live answers
require the function environment and `OPENROUTER_API_KEY`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes for live AI | Server-side model access |
| `WHY_DAILY_MODEL` | No | Override Daily WHY and category generation model |
| `WHY_DAILY_COPY_MODEL` | No | Override editorial label generation model |
| `WHY_EVAL_URL` | No | Run the voice evaluator against a deployed endpoint |
| `WHY_EVAL_CONCURRENCY` | No | Bound evaluation concurrency |
| `WHY_EVAL_OUTPUT` | No | Override the local evaluation artifact path |

Never expose `OPENROUTER_API_KEY` in browser code or commit it to source.

## Test and build

The regression suite uses mocked upstream calls and does not spend model tokens:

```bash
npm test
npm run build
```

The build does not publish the repository root. It creates `.netlify-dist` from
an explicit manifest, which keeps tests, prompts, internal documents, and local
working material off the static web surface.

To run the optional live voice evaluation:

```bash
OPENROUTER_API_KEY=your_key npm run eval:voice
```

## Database behavior

The included migrations create tables for Daily WHY choices, generated episodes,
and rotating category seeds. Apply them through your linked Netlify Database
before expecting shared vote counts or generated episode persistence.

The product degrades deliberately when no database is connected: the bundled
Daily WHY episode can still render, but collective counts and generated shared
pools will be unavailable.

## Privacy and safety

- The OpenRouter key exists only in the server environment.
- Function endpoints reject unknown actions, oversized payloads, unsupported
  content types, and cross-site browser writes.
- Model context, prior history, retrieved evidence, and memory cues are treated
  as untrusted data rather than instructions.
- Analytics is consent-aware and uses an explicit property allowlist.
- Analytics events exclude raw questions, answers, node IDs, and personal paths.
- Local history can be exported and imported by the user.
- Self-harm and urgent safety language takes a separate, calmer response path.

Read the deployed [privacy policy](https://why.com/privacy) and
[SECURITY.md](SECURITY.md) before operating a public fork.

## Contributing

The best contributions strengthen the answer → three questions → choice loop.
We are especially interested in:

- Objective evaluations for next-question relevance, novelty, and diversity
- Support for additional model providers and self-hosted models
- Better accessibility, internationalization, and mobile behavior
- Privacy-preserving curiosity-graph portability
- Daily WHY editorial and moderation tools
- Performance, rate-limit, and malformed-stream resilience

Start with [CONTRIBUTING.md](CONTRIBUTING.md), then open a focused issue or pull
request. Security reports belong in GitHub's private vulnerability workflow, not
a public issue.

## License

The software is available under the [MIT License](LICENSE).

The WHY name, WHY. wordmark, WHY.com domain, logos, and trade dress are not
licensed for use by forks. See [TRADEMARKS.md](TRADEMARKS.md).

---

<p align="center">
  <a href="https://why.com">why.com</a>
  ·
  <a href="https://x.com/whydots">X</a>
  ·
  <a href="https://discord.gg/raAQCeDr3e">Discord</a>
  ·
  <a href="https://t.me/whydotcom">Telegram</a>
</p>
