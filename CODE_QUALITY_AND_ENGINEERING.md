# Phasewire — Code Quality & Engineering

| Field | Value |
|---|---|
| Owner | Mohammed Abdelhady (Congar) |
| Scope | All Phasewire code, PRs, and harness reviews |
| Status | Authoritative |
| Related | `AGENTS.md`, `docs/quality-gates.md`, `docs/code-review.md` |

## Principles

1. **Quality first** — never trade correctness, safety, or clarity for speed.
2. **Code health** — every change should leave the system healthier (or no worse).
3. **Boring over clever** — proven patterns beat novelty.
4. **Small diffs** — reviewable in one sitting; one concern per commit (Conventional Commits).
5. **No AI attribution** — describe what changed, never which model wrote it.

## TypeScript & architecture

- Strict TypeScript. No `any`. Narrow `unknown` at boundaries.
- Package boundaries stay hard:
  - `packages/core` — policy, replay, persistence, templates
  - `packages/server` — loopback transport, session security, hosting
  - `packages/cli` — command composition
  - `apps/web` — report projection and interaction
- Pure core; side effects at edges.
- Authored files max **350 physical lines** (structure gate + ESLint `max-lines`).
- Prefer reuse of existing types, helpers, and UI primitives before adding new ones.

## Security

- Never commit secrets (`.env*`, keys, certs, cloud credentials).
- Loopback-only service; host/origin validation; session + CSRF on interactive mutations.
- Project-root path confinement; reject traversal and symlink escapes.
- Harness names are coordination IDs, not auth principals.
- Templates are data — no package execution, no shell, no deploy from model output.
- Prefer timing-safe compares for tokens (`tokensMatch`).

## React / workbench UI

- Semantic HTML; accessible names; stable `data-testid` on interactive controls.
- Logical CSS properties (start/end) for RTL readiness.
- Prefer composition; do not recreate existing controls.
- No fabricated product truth in the UI.

## Tests & gates

| When | Command |
|---|---|
| Before commit | `npm run quality:commit` |
| Before push | `npm run quality:push` |
| Full | `npm run quality` |

- Never `--no-verify` to land green.
- Never weaken audit severity, skip tests, or raise line limits to pass.
- E2E: selectors from `apps/web/e2e/utils/selectors.ts` — no fixed sleeps.
- Do not invent green CI; report ad-hoc checks honestly.

## Product invariants (Phasewire)

- Plan → Execute → Review control layer; durable events under `.phasewire/`.
- Blocking findings require remediation plan → approval → execution → fresh review.
- Deployment readiness ≠ deploy. Phasewire **never deploys**.
- Unique `phasewire` command namespace — no bare `/plan` aliases.

## PR prose

- Titles: Conventional Commits (`feat:`, `fix:`, `docs:`, …).
- Bodies: Summary / Test plan / Risk. Plain technical voice.
- No em dashes, no hype, no AI footers, no “Generated with …”.
- Every PR needs a **Visual guide** comment (see `docs/code-review.md`).

## Picky multi-axis review (mandatory)

Every non-trivial PR is scored on:

| Axis | Hunt for |
|---|---|
| Reuse | Existing module/type/component before new code |
| Security | XSS, path escape, token leak, CSRF, unsafe HTML |
| Correctness | Races, replay integrity, event parent rules |
| Re-render | Unstable props, effect loops (web) |
| Perf | Bundle bloat, unnecessary work in hot paths |
| a11y | Names, focus, keyboard, contrast, reduced motion |
| i18n/RTL | Logical CSS; no hard-coded LTR assumptions |
| Gates honesty | Scripts/docs claim only what actually passes |

Finish every formal review with:

```text
Finished reviewing this one.

**Verdict:** COMMENT | REQUEST_CHANGES | APPROVE
**Critical:** N · **Warnings:** M · **Suggestions:** K

Axes: reuse✓ security✓ rerender✓ a11y✓ perf✓ i18n~ | C0 W2 S3
```

Self-authored PRs use event **COMMENT** with honest severity language (GitHub blocks self REQUEST_CHANGES).

Detail: `docs/code-review.md`.
