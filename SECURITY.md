# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or include
private user data, credentials, or an active exploit in a discussion.

Use GitHub's **Report a vulnerability** workflow from the repository Security
tab. Include the affected route or file, reproduction steps, expected impact,
and any suggested mitigation. We will acknowledge a complete report as soon as
practical and coordinate disclosure after a fix is available.

## Security boundaries

- Browser code never receives the OpenRouter key.
- Model traffic is routed through same-origin Netlify Functions.
- Production credentials belong in host-managed environment variables.
- Local curiosity paths remain on the user's device unless the user explicitly
  submits the active path as part of a question.

Never commit `.env` files, copied production data, session tokens, or API keys.
