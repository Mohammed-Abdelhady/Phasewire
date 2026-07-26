---
name: phasewire-plan
description: |
  Use when starting a Phasewire workflow from a goal. Trigger with /phasewire:plan, $phasewire-plan, or "phasewire plan".
argument-hint: ""<goal>" [--template <id>] [--validation <check>]"
version: 0.1.0
license: MIT
compatibility: Grok; requires the phasewire CLI on PATH or via npm workspace script
tags: [phasewire, workflow, harness-adapter]
---

# Phasewire plan

Portable Phasewire adapter for **Grok**.

## Invocation

- Host trigger: `$phasewire-plan`
- CLI shape: `phasewire plan "<goal>" --harness <host> --json`
- Current harness id to pass as `--harness`: `grok`

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

1. Require a non-empty goal string from the user args or the latest user request.
2. Run `phasewire plan "<goal>" --harness <host> --json`. Add `--no-open` only when the user asks for automation without the workbench.
3. Report the created workflow id, current phase, and that material decisions/approval happen in the workbench or via `phasewire approve-plan`.
4. Do not implement product code in this skill. Planning only creates durable Phasewire state.

## Recovery

If the project is missing, run `phasewire init` first. If the CLI is missing, build the workspace with `npm run build` and use `npx phasewire` or `npm run phasewire --`.

