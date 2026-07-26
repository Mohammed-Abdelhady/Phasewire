---
name: review
description: |
  Use when starting an independent Phasewire review. Trigger with /phasewire:review or $phasewire-review.
argument-hint: "<workflow-id>"
version: 0.1.0
license: MIT
compatibility: Claude Code; requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire review

Portable Phasewire adapter for **Claude Code**.

## Invocation

- Host trigger: `/phasewire:review`
- CLI shape: `phasewire review <workflow-id> --harness <host> --json`
- Current harness id to pass as `--harness`: `claude`

## Hard rules

- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.
- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.
- Harness names are coordination identities, not authentication principals.
- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.
- Phasewire never deploys. Do not run deploy commands from these adapters.
- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.

## Steps

1. Require a workflow id. Load `phasewire status <workflow-id> --json` before reviewing.
2. Run `phasewire review <workflow-id> --harness <host> --json`.
3. Record findings with `phasewire finding` and validations with `phasewire validate`. Blocking findings must open remediation, not be silently cleared.
4. Finish with `phasewire complete-review` only after evidence is recorded.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

