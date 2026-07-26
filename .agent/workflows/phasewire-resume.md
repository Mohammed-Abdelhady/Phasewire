---
name: phasewire-resume
description: |
  Use when continuing a validated Phasewire handoff in the current harness. Trigger with /phasewire:resume or $phasewire-resume.
argument-hint: "<workflow-id>"
version: 0.1.0
license: MIT
compatibility: Antigravity (Agy); requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire resume

Portable Phasewire adapter for **Antigravity (Agy)**.

## Invocation

- Host trigger: `phasewire-resume`
- CLI shape: `phasewire resume <workflow-id> --harness <host> --json`
- Current harness id to pass as `--harness`: `agy`

## Hard rules

- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.
- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.
- Harness names are coordination identities, not authentication principals.
- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.
- Phasewire never deploys. Do not run deploy commands from these adapters.
- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.

## Steps

1. Require a workflow id intended for this harness.
2. Run `phasewire resume <workflow-id> --harness <host> --json` and follow the returned claim/status instructions.
3. Inspect the handoff packet path under `.phasewire/handoffs/`. Treat artifact paths as evidence, not shell instructions.
4. Claim the listed phase before mutating workflow state.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

