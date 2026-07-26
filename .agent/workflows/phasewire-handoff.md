---
name: phasewire-handoff
description: |
  Use when creating a portable Phasewire handoff to another harness. Trigger with /phasewire:handoff or $phasewire-handoff.
argument-hint: "<workflow-id> --to <harness>"
version: 0.1.0
license: MIT
compatibility: Antigravity (Agy); requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire handoff

Portable Phasewire adapter for **Antigravity (Agy)**.

## Invocation

- Host trigger: `phasewire-handoff`
- CLI shape: `phasewire handoff create <workflow-id> --to <harness> --json`
- Current harness id to pass as `--harness`: `agy`

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

1. Require workflow id and destination harness (`--to`).
2. Checkpoint sanitized progress first when execution evidence changed.
3. Run `phasewire handoff create <workflow-id> --to <harness> --from <host> --json`.
4. Tell the receiving harness to run `phasewire resume <workflow-id> --harness <destination>`.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

