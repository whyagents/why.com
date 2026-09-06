# WHY.com — Netlify handoff

1. Upload this folder to Netlify (or connect it to your existing `why.com` site).
2. In **Project configuration → Environment variables**, add:
   - Key: `OPENROUTER_API_KEY`
   - Value: your OpenRouter API key
   - Scope: Functions (or all scopes)
3. Use a dedicated OpenRouter key for production. In OpenRouter, give that key a
   USD spending limit with a daily reset before launch. Keep auto top-up outside
   that limit unless it is intentionally budgeted.
4. Redeploy after saving the variable, then confirm the deploy log says the
   `/api/ultimate-search` rate-limit rule was accepted.
5. Visit `/` and test one typed question, one door, and Receipts.

The browser never receives the key, server prompt, provider selection, or internal
generation telemetry. The public app calls the same-origin Netlify Function at
`/api/ultimate-search`; only the approved static-file manifest is published.
