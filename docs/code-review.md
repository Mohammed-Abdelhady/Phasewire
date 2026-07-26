# Code review process (Phasewire)

How humans and harnesses review work in this repository.

## Two review surfaces

| Surface | What it is | Entry |
|---|---|---|
| **Workflow review** | Phasewire product loop: findings on a `workflow-id` | `phasewire review <id>` / `/phasewire:review` |
| **Code / PR review** | GitHub diff against Congar quality bar | Open PR → this doc + `CODE_QUALITY_AND_ENGINEERING.md` |

Both can produce blocking findings. Workflow blocking findings open remediation inside Phasewire. Code review blocking findings block merge until fixed.

## GitHub PR lifecycle (mandatory)

1. **Start comment** on the PR: `Starting review on this PR (head <sha>).`
2. **Visual guide** if missing (exact heading):

```markdown
## Visual guide — what this PR does
```

Include: one-liner · table or before→after · file map (3–8 paths) · 2-minute verify · out of scope.

3. Humanize title/body (no AI-slop, no em dashes).
4. Diff review using picky multi-axis bar (`CODE_QUALITY_AND_ENGINEERING.md`).
5. Formal review with **inline comments** on Critical/Warning lines that appear in the PR diff only (wrong path → GitHub 422).
6. Finish body **starts with** `Finished reviewing this one.`
7. Self-authored → `COMMENT` event; third-party → `REQUEST_CHANGES` when Critical/Warning remain.
8. After fixes: push, comment SHA + how verified, **resolve** addressed review threads.

## Severity

| Level | Meaning |
|---|---|
| **Critical** | Security, data loss, broken invariant, merge-blocker |
| **Warning** | Must fix or explicitly defer with tracking note |
| **Suggestion** | Improve when cheap; not merge-blocking alone |

Product honesty on live UI (fake status, fabricated readiness) is at least **Warning**.

## Workflow review (CLI)

```sh
phasewire status <workflow-id> --json
phasewire review <workflow-id> --harness <host> --json
# record findings / validations
phasewire complete-review ...
```

Rules:

- Chat is never authoritative; `.phasewire/` events are.
- Blocking findings open remediation — never silent clear.
- Prefer `--json` and summarize for the user.
- Never deploy from a review skill.

When the workflow under review includes code changes, **also** apply the GitHub multi-axis bar before completing a clean review.

## Quality gates (local truth)

```sh
npm run quality:commit   # structure + lint + typecheck + unit tests
npm run quality:push     # + build + audit + browser e2e
npm run quality          # alias of quality:push
```

CI runs the same npm scripts on Node 24 (Linux/macOS/Windows + Chromium e2e).

## Inline comment rules

- Only files listed in the PR files API.
- Prefer one actionable comment per issue.
- Put cross-cutting findings in the summary if no diff anchor exists.

## Visual guide template

```markdown
## Visual guide — what this PR does

**One-liner:** …

| Layer | Change | Why |
|---|---|---|
| … | … | … |

### Before → after
…

### Where to look
`path/a` · `path/b`

### Verify in 2 minutes
1. `npm run quality:commit`
2. …

### Out of scope
…

*Guide for discussion — not a verdict.*
```
