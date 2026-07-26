---
name: phasewire
description: |
  Use for Phasewire workflow control across harnesses. Triggers on /phasewire, /phasewire:*, phasewire plan/execute/review/resume/status/handoff/open, or handoff between codex, grok, claude, and agy.
argument-hint: "<plan|execute|review|resume|status|handoff|open> [args]"
version: 0.1.0
license: MIT
compatibility: Grok; requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire

Portable Phasewire adapter for **Grok**.

## Invocation

- Host trigger: `$phasewire`
- CLI shape: `phasewire status --json`
- Current harness id to pass as `--harness`: `grok`

## Hard rules

- Durable state lives under `.phasewire/`. Chat transcripts are never authoritative.
- Keep the unique `phasewire` namespace. Do not add bare `/plan`, `/execute`, `/review`, or `/resume`.
- Harness names are coordination identities, not authentication principals.
- Blocking review findings require remediation plan → user approval → remediation execution → fresh review.
- Phasewire never deploys. Do not run deploy commands from these adapters.
- Prefer `phasewire ... --json` and summarize the machine-readable result for the user.

## Steps

1. Resolve the intended subcommand from the user args: plan, execute, review, resume, status, handoff, or open.
2. If no subcommand is given, run `phasewire status --json` and summarize active workflows plus the next legal command.
3. Route to the matching phasewire CLI command with `--harness <current-host>` when the command accepts harness ownership.
4. Never invent bare `/plan`, `/execute`, `/review`, or `/resume` aliases. Keep the `phasewire` namespace.
5. Never deploy. Deployment readiness and authorization remain separate user gates.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

