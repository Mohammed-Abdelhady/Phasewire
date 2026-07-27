# Code review process (Phasewire)

How humans and harnesses review work in this repository.

## Two review surfaces

| Surface | What it is | Entry |
|---|---|---|
| **Workflow review** | Phasewire product loop: findings on a `workflow-id` | `phasewire review <id>` / `/phasewire:review` |
| **Code / PR review** | GitHub diff against Congar quality bar | Open PR → this doc + `CODE_QUALITY_AND_ENGINEERING.md` |

Both can produce blocking findings. Workflow blocking findings open remediation inside Phasewire. Code review blocking findings block merge until fixed.

## GitHub PR lifecycle (authorization-gated)

**Default: local/draft-only.** Review output is Phasewire findings + local notes. Never post to GitHub unless authorized.

Post to GitHub only when **all** of the following hold:

1. Explicit user authorization for an external GitHub write in the current request.
2. Unambiguous current repository identity.
3. Unambiguous PR number.

Missing any precondition → keep the review local/draft-only; do not post.

When authorized and target-bound:

1. Diff review using picky multi-axis bar (`CODE_QUALITY_AND_ENGINEERING.md`).
2. Submit **one batched** formal review (summary + inline notes as needed). Do **not** emit a mandatory multi-comment start/visual-guide/finish sequence.
3. Optional visual guide content may live inside the batched review body or a local draft (exact heading when used):

```markdown
## Visual guide — what this PR does
```

Include: one-liner · table or before→after · file map (3–8 paths) · 2-minute verify · out of scope.

4. Inline comments only on Critical/Warning lines that appear in the PR diff (wrong path → GitHub 422).
5. Batched finish body **starts with** `Finished reviewing this one.` plus Axes line when posting.
6. Self-authored → `COMMENT` event; third-party → `REQUEST_CHANGES` when Critical/Warning remain.
7. After fixes (when still authorized and bound): push, note SHA + how verified, **resolve** addressed review threads.
8. Humanize title/body only when that edit is separately authorized (no AI-slop, no em dashes).

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
