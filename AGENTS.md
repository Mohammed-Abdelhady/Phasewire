# Phasewire project rules

These rules apply to every harness working in this repository.

## Product invariants

- Phasewire is a persistent, visual control layer for Plan → Execute → Review delivery loops.
- Blocking review findings require a remediation plan, explicit user approval, remediation execution, and a fresh review.
- Deployment readiness is derived evidence. Deployment authorization is a separate user gate. Phasewire never deploys.
- Durable meaning lives under `.phasewire/`; chat transcripts and provider sessions are never authoritative.
- Commands use the unique `phasewire` namespace. Do not add bare `/plan`, `/review`, or similar aliases.

## Architecture

- Keep workflow policy, replay, persistence, and templates in `packages/core`.
- Keep loopback transport, session security, and hosting in `packages/server`.
- Keep command composition in `packages/cli`; keep report projection and interaction in `apps/web`.
- SQLite and rendered reports are disposable projections. Immutable event files are authoritative.
- Keep harness adapters neutral: inputs and outputs must not depend on one provider transcript.

## Code and file limits

- Every authored source, test, stylesheet, schema, configuration, and Markdown file must remain at or below 350 physical lines.
- Use strict TypeScript. Never introduce `any`; narrow `unknown` at boundaries.
- Keep modules single-purpose, prefer pure functions, and reuse existing types and primitives.
- Use semantic HTML and the existing component primitives. Do not recreate available controls.
- Interactive elements require stable `data-testid` attributes and accessible names.
- Preserve LTR and RTL behavior; use logical CSS properties rather than physical left/right spacing.

## Quality gates

- Before commit: `npm run quality:commit`.
- Before push: `npm run quality:push`.
- Never bypass hooks with `--no-verify` and never weaken a gate to make it pass.
- E2E tests use Playwright selectors from `apps/web/e2e/utils/selectors.ts`; do not use fixed sleeps.
- A distinct feature, fix, documentation update, or tooling change receives its own Conventional Commit.

## Security and privacy

- Never read or commit secret-bearing files such as `.env*`, private keys, or cloud credentials.
- Treat harness names as coordination identities, not authentication principals.
- Keep paths project-relative in durable reports. Do not persist raw prompts, full command logs, tokens, ports, PIDs, or browser state.
- Reject traversal, symbolic-link escapes, incompatible schemas, integrity failures, stale event parents, and ambiguous template identities.
- Do not add shell execution or deployment capability to templates, reports, or model-produced values.

## Documentation

- Update README and the relevant file under `docs/` whenever a public command, state transition, security boundary, or quality rule changes.
- Plans and audits belong under `.hyperflow/`, not the repository root or `docs/`.
- Explain decisions in terms of product and technical effects; do not attribute repository work to a model or assistant.
