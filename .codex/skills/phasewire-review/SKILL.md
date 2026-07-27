---
name: "phasewire-review"
description: |-
  Use when starting an independent Phasewire review (workflow and/or code). Trigger with /phasewire:review or $phasewire-review. Always apply CODE_QUALITY_AND_ENGINEERING.md multi-axis bar.
argument-hint: "<workflow-id>"
version: 0.1.0
license: MIT
compatibility: "Codex; requires the phasewire CLI on PATH or via npm workspace script"
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire review

Portable Phasewire adapter for **Codex**.

## Invocation

- Host trigger: `$phasewire-review`
- CLI shape: `phasewire review <workflow-id> --harness <host> --json`
- Current harness id to pass as `--harness`: `codex`

## Hard rules

- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.
- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.
- Harness names are coordination identities, not authentication principals.
- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.
- Phasewire never deploys. Do not run deploy commands from these adapters.
- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.
- Code quality bar is `CODE_QUALITY_AND_ENGINEERING.md`. Review process is `docs/code-review.md`.
- Never attribute commits, docs, or findings to an AI model.

## Steps

1. Require a workflow id. Load `phasewire status <workflow-id> --json` before reviewing.
2. Read `CODE_QUALITY_AND_ENGINEERING.md` and `docs/code-review.md` before judging code or findings.
3. Run `phasewire review <workflow-id> --harness <host> --json`.
4. Apply picky multi-axis review on changed code: reuse, security, correctness, re-render, perf, a11y, i18n/RTL, gate honesty.
5. Record findings with `phasewire finding` and validations with `phasewire validate`. Blocking findings must open remediation, not be silently cleared.
6. Keep review findings local/draft-only by default. Do not post to GitHub unless the user explicitly authorizes an external write for this review.
7. Post to GitHub only when authorization is explicit AND the current repository and PR number are unambiguous; otherwise keep the review local.
8. When posting is authorized and target-bound, submit one batched formal review (summary + inline notes as needed; visual guide may live inside the batch body or local draft). Do not emit a mandatory multi-comment start/visual-guide/finish spam sequence.
9. Finish with `phasewire complete-review` only after evidence is recorded and blocking issues are filed or fixed.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

