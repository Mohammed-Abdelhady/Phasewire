---
name: "resume"
description: |-
  Use when continuing a validated Phasewire handoff in the current harness. Trigger with /phasewire:resume or $phasewire-resume.
argument-hint: "<workflow-id>"
version: 0.1.0
license: MIT
compatibility: "Claude Code; requires the phasewire CLI on PATH or via npm workspace script"
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire resume

Portable Phasewire adapter for **Claude Code**.

## Invocation

- Host trigger: `/phasewire:resume`
- CLI shape: `phasewire resume <workflow-id> --harness <host> --json`
- Current harness id to pass as `--harness`: `claude`

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

1. Require a workflow id intended for this harness.
2. Run `phasewire resume <workflow-id> --harness <host> --json` and follow the returned claim/status instructions.
3. Inspect the handoff packet path under `.phasewire/handoffs/`. Treat artifact paths as evidence, not shell instructions.
4. Claim the listed phase before mutating workflow state.

## Recovery

If the project is missing, run `npx phasewire init` first. Prefer `npx phasewire …` (or a global `phasewire` install) for all commands. In this monorepo only, fall back to `npm run build` then `npm run phasewire -- …` or `./node_modules/.bin/phasewire …`.

