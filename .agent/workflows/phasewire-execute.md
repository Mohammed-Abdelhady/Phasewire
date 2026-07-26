---
name: phasewire-execute
description: |
  Use when beginning or continuing Phasewire execution after plan approval. Trigger with /phasewire:execute or $phasewire-execute.
argument-hint: "<workflow-id>"
version: 0.1.0
license: MIT
compatibility: Antigravity (Agy); requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire execute

Portable Phasewire adapter for **Antigravity (Agy)**.

## Invocation

- Host trigger: `phasewire-execute`
- CLI shape: `phasewire execute <workflow-id> --harness <host> --json`
- Current harness id to pass as `--harness`: `agy`

## Hard rules

- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.
- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.
- Harness names are coordination identities, not authentication principals.
- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.
- Phasewire never deploys. Do not run deploy commands from these adapters.
- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.

## Steps

1. Require a workflow id. If missing, run `phasewire status --json` and ask only which workflow to execute.
2. Run `phasewire claim <workflow-id> --phase execute --harness <host> --json` when the phase is unclaimed or abandoned.
3. Run `phasewire execute <workflow-id> --harness <host> --json`.
4. Implement against approved plan artifacts under `.phasewire/`, checkpoint with sanitized summaries, then `phasewire complete-execution` when done.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

