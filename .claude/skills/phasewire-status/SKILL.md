---
name: phasewire-status
description: |
  Use for a read-only Phasewire status snapshot. Trigger with /phasewire:status or $phasewire-status.
argument-hint: "[workflow-id]"
version: 0.1.0
license: MIT
compatibility: Claude Code; requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire status

Portable Phasewire adapter for **Claude Code**.

## Invocation

- Host trigger: `/phasewire:status`
- CLI shape: `phasewire status [workflow-id] --json`
- Current harness id to pass as `--harness`: `claude`

## Hard rules

- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.
- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.
- Harness names are coordination identities, not authentication principals.
- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.
- Phasewire never deploys. Do not run deploy commands from these adapters.
- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.

## Steps

1. Run `phasewire status --json` or `phasewire status <workflow-id> --json`.
2. Summarize phase, claims, blockers, validations, and the next legal command only. Do not mutate state.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

