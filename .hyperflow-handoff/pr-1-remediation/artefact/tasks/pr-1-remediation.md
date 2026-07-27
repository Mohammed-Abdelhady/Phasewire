## Status

| Field | Value |
|---|---|
| Status | pending |
| Progress | `░░░░░░░░░░░░░░░░░░░░` 0 / 10 sub-tasks (0%) |
| Branch | `chore/congar-quality-standards` |
| Commits | 0 remediation commits · per-task cadence |
| Specialists | `architect · backend-reviewer · security-reviewer · vulnerability-reviewer · devops-reviewer · debugger · performance-reviewer` |
| Source | `.hyperflow/specs/audit-2026-07-27-pr-1.md` |
| Updated | 2026-07-27 |

# Phasewire PR #1 remediation

## TL;DR

Merge current `main` into the maintainer-owned PR branch, fix all nine review findings in isolated commits, and restore cross-platform quality evidence. Work stays in the isolated PR worktree; executing contributor code, pushing, and merging remain separate structural gates.

## Goal and why

Make PR #1 safe and truthful to merge without weakening Phasewire's product, security, portability, or quality invariants. The chain addresses invalid generated YAML, unauthorized external-write instructions, unsupported Node claims, Windows failures, CI build ordering, and duplicated build work.

## Scope at a glance

| Surface | Files | Created | Modified | Risk |
|---|---:|---:|---:|---|
| Adapter source/tests | 5 | 1 | 4 | high |
| Generated adapters | 13 | 0 | 13 | medium |
| Toolchain/CI/browser | 5 | 0 | 5 | high |
| Lifecycle tests | 1 | 0 | 1 | medium |
| Policy/documentation | 5 | 0 | 5 | high |

## Integration prerequisite

Before T1, merge current `main` (`017b1be`) into the isolated `pr-1` worktree using `chore: merge main into PR branch`. Resolve only the expected README overlap, preserving main's fixed-port/CLI guidance and the PR's quality/review links. Verify `git merge-base --is-ancestor main HEAD`, zero unresolved paths, no current-main server deletion, and an unchanged primary checkout.

## Task roster

- [ ] T1 — Debugger · Make adapter path assertions cross-platform
       Modify: `packages/cli/src/adapters/install.test.ts` · Complexity: low · Specialist: debugger · Commit: `test: make adapter paths cross-platform` · Brief: `pr-1-remediation/T1.md`
- [ ] T2 — Backend implementer · Escape and validate generated frontmatter
       Modify: renderer, renderer tests, manifest/lock · Complexity: high · Specialist: backend-reviewer · Commit: `fix(adapters): escape generated skill frontmatter` · Brief: `pr-1-remediation/T2.md`
- [ ] T3 — Security implementer · Gate GitHub review writes at the policy source
       Modify: catalog, renderer tests, review doctrine · Complexity: high · Specialist: security-reviewer · Commit: `fix(adapters): gate GitHub review writes` · Brief: `pr-1-remediation/T3.md`
- [ ] T4 — Debugger · Split workflow lifecycle coverage
       Modify: `packages/cli/src/progress.test.ts` · Complexity: medium · Specialist: debugger · Commit: `test: split workflow lifecycle coverage` · Brief: `pr-1-remediation/T4.md`
- [ ] T5 — Adapter implementer · Regenerate plan and review projections
       Modify: 13 checked-in generated adapters · Complexity: medium · Specialist: backend-reviewer · Commit: `chore(adapters): regenerate host skills` · Brief: `pr-1-remediation/T5.md`
- [ ] T6 — DevOps implementer · Align Node support and minimum-version evidence
       Modify: manifest/lock, README, CI · Complexity: medium · Specialist: devops-reviewer · Commit: `chore: align Node support with toolchain` · Brief: `pr-1-remediation/T6.md`
- [ ] T7 — Tooling implementer · Pin Prettier exactly
       Modify: manifest/lock · Complexity: low · Specialist: devops-reviewer · Commit: `chore: pin Prettier version` · Brief: `pr-1-remediation/T7.md`
- [ ] T8 — DevOps implementer · Correct browser build ordering
       Modify: CI and optional named root script · Complexity: medium · Specialist: devops-reviewer · Commit: `fix(ci): build dependencies before browser tests` · Brief: `pr-1-remediation/T8.md`
- [ ] T9 — Performance implementer · Reuse build artifacts across gates
       Modify: root scripts, CI, Playwright config, quality docs · Complexity: high · Specialist: performance-reviewer · Commit: `perf(ci): reuse workspace build artifacts` · Brief: `pr-1-remediation/T9.md`
- [ ] T10 — Writer · Correct the documented quality-gate contract
       Modify: contributor and review docs · Complexity: medium · Specialist: architect · Commit: `docs: correct quality gate contract` · Brief: `pr-1-remediation/T10.md`

## Execution plan

```text
Integration prerequisite — merge main
  ↓
Batch 1 — independent regressions
  T1 · T4
  ↓
Batch 2 — serialization source
  T2
  ↓
Batch 3 — parallel policy/toolchain source
  T3 · T6
  ↓
Batch 4 — projection and manifest continuation
  T5 · T7
  ↓
Batch 5 — browser graph
  T8
  ↓
Batch 6 — build reuse
  T9
  ↓
Batch 7 — final documentation truth
  T10
  ↓
quality:push → push gate → CI → fresh L4 review → merge gate
```

Dependencies: T2 follows T1; T3 follows T2; T5 follows T2 and T3; T6 follows T2 because both touch the manifest/lock; T7 follows T6; T8 follows T7; T9 follows T8; T10 follows T3, T5, T6, and T9. Do not parallel-write any shared generated projection, manifest/lock, CI workflow, Playwright configuration, or documentation file.

## Affected files

**Created (1)**

- `packages/cli/src/adapters/render.test.ts` — parser-backed renderer and policy regression coverage.

**Modified (grouped)**

- `packages/cli/src/adapters/{render,catalog}.ts` — serialization and authorization sources.
- `packages/cli/src/adapters/install.test.ts`, `packages/cli/src/progress.test.ts` — Windows-safe integration coverage.
- `.agent/`, `.claude/`, `.codex/`, `.grok/` plan/review projections — deterministic generated mirrors only.
- `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `apps/web/playwright.config.ts` — Node, formatter, and build graph.
- `AGENTS.md`, `README.md`, `CODE_QUALITY_AND_ENGINEERING.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/{code-review,quality-gates}.md` — final policy truth.

**Skipped (confirmed)**

- `packages/cli/src/adapters/{hosts,install}.ts` — production native-path and generation fan-out are already correct.
- `packages/server/` — current-main fixed-port behavior is preserved, not rewritten.
- Application UI — no visual, accessibility, LTR, or RTL surface changes are required.

## Verification

1. Parse every generated skill/workflow frontmatter document and verify literal plan argument hints.
2. Prove plain review requests remain local/draft-only and authorized posting requires a bound repository and PR.
3. Run focused adapter, lifecycle, and build-graph tests on Node 22.13.x and current Node 24.
4. Run `npm run quality:commit`, then `npm run quality:push` from the cumulative isolated worktree.
5. Confirm every authored source, test, configuration, schema, stylesheet, and Markdown file is at most 350 physical lines.
6. Push only after the structural push gate; wait for Linux, macOS, Windows, minimum-Node, security, and browser checks.
7. Perform a fresh L4 cumulative review and merge only after PASS plus the explicit merge gate.

## Constraints

- Work only in `/tmp/phasewire-pr1.JWIoGJ`; preserve the user's `main` checkout and untracked `.phasewire/` state.
- Never use `--no-verify`, rebase, force-push, weaken a test/gate, or add deployment capability.
- Do not read secret-bearing files or persist prompts, logs, tokens, ports, PIDs, or browser state.
- Keep adapters harness-neutral, outputs deterministic, and all authored files within the 350-line limit.
- Each sub-task receives its listed Conventional Commit and a separate matching-specialist review.

## Estimated cost

| Role | Agents | Tokens |
|---|---:|---:|
| Workers | 10 | ~65k |
| Per-task reviewers | 10 | ~35k |
| Integration/verification | 3 | ~25k |
| **Total** | **23** | **~125k** |
