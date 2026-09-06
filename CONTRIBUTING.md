# Contributing to WHY

WHY is built around one product promise: answer the question, then make the
next three questions difficult to ignore. Contributions should make that loop
more truthful, more reliable, more accessible, or more interesting.

## Before opening a pull request

1. Search existing issues and discussions.
2. Keep one pull request focused on one problem.
3. Explain the user-visible outcome, not only the implementation.
4. Add or update a regression test for behavior changes.
5. Run the complete test and build checks.

```bash
npm ci
npm test
npm run build
```

The automated test suite does not require an API key. Live answer testing does.

## Product invariants

- A completed normal turn contains one answer and exactly three next questions.
- Questions must be grounded in the accepted answer and meaningfully different
  from one another.
- A failed question board must not destroy a valid answer or create a dead end.
- Private curiosity history remains local-first.
- Raw questions, answers, path identifiers, and personal memory never enter
  analytics events.
- Reduced-motion, keyboard navigation, mobile spacing, and haptics are part of
  the product—not optional polish.
- Never weaken request, prompt-injection, same-site, rate-limit, or secret
  boundaries to make a demo pass.

## Where help is especially useful

- Better evaluations for answer voice and next-question quality
- Provider adapters and self-hosting documentation
- Accessibility and cross-browser testing
- Local curiosity-graph portability
- Daily WHY editorial tooling
- Performance and failure-mode hardening

## Coding style

The codebase intentionally uses browser-native JavaScript and small ES modules.
Prefer focused changes over framework migrations. Follow nearby naming and
error-handling patterns, avoid new dependencies unless they remove more
complexity than they add, and keep paid model calls out of tests.

## Pull-request checklist

- [ ] The change has a clear user or contributor benefit.
- [ ] Tests cover the new behavior or explain why none are needed.
- [ ] `npm test` passes.
- [ ] `npm run build` succeeds.
- [ ] No credentials, private data, or generated local state are included.
- [ ] Documentation reflects any changed setup or behavior.

By contributing, you agree that your contribution is licensed under the MIT
License included in this repository.
