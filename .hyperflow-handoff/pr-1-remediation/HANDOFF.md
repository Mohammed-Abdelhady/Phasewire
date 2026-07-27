# Handoff — pr-1-remediation

## Manifest

| Field | Value |
|---|---|
| Slug | `pr-1-remediation` |
| Artefact type | `flat` |
| Artefact path | `artefact/tasks/pr-1-remediation.md` |
| Chain args | `commit=per-task branch=current push=true triage=eyJ0eXBlcyI6WyJhcmNoaXRlY3QiLCJzZWN1cml0eSIsImJ1Z2ZpeCIsImRldm9wcyIsImRvY3MiLCJ0ZXN0IiwicGVyZm9ybWFuY2UiXSwiY29tcGxleGl0eSI6ImNvbXBsZXgiLCJyaXNrIjoicmV2ZXJzaWJsZSIsInNjb3BlIjoiY3Jvc3MtY3V0dGluZyIsImFtYmlndWl0eSI6MC4xNSwiZmxvdyI6ImRlZXAiLCJzcGVjaWFsaXN0cyI6WyJhcmNoaXRlY3QiLCJiYWNrZW5kLXJldmlld2VyIiwic2VjdXJpdHktcmV2aWV3ZXIiLCJ2dWxuZXJhYmlsaXR5LXJldmlld2VyIiwiZGV2b3BzLXJldmlld2VyIiwiZGVidWdnZXIiLCJwZXJmb3JtYW5jZS1yZXZpZXdlciIsImFsZ29yaXRobS1yZXZpZXdlciJdfQ== mode=flat briefs=auto pr=1` |
| on_complete | `deploy` |
| Originating provider | `codex` |
| Originating commit | `e1a5cdbd7430f2b959e79bf573ed8257d8d5a9ab` |
| Originating branch | `chore/congar-quality-standards` |
| Specialists | `architect, backend-reviewer, security-reviewer, vulnerability-reviewer, devops-reviewer, debugger, performance-reviewer, algorithm-reviewer` |
| Created | `2026-07-27 04:39 +0400` |

## TL;DR

Remediate all findings from the L4 review of Phasewire PR #1, prove the corrected branch across supported platforms, and continue through the deploy workflow. The build must preserve the maintainer PR branch, use per-task commits, and keep GitHub review writes local unless authorization is explicit and target-bound.

## Target instruction (build session)

Run `/hyperflow:dispatch pr-1-remediation` or `/hyperflow:handoff pickup pr-1-remediation`. Dispatch rehydrates `artefact/` into `.hyperflow/`, builds and reviews every batch, writes `COMPLETION.md`, commits and pushes the completed branch, then continues to `/hyperflow:deploy` because `on_complete=deploy`.

## How to start the build session

1. Fetch and check out `chore/congar-quality-standards` from `origin`.
2. Run `/hyperflow:handoff pickup pr-1-remediation` or `/hyperflow:dispatch pr-1-remediation`.
3. Honor every structural execution, push, review, and merge gate; never force-push or bypass verification.

## Return path

When `STATUS` becomes `built`, inspect `COMPLETION.md` for the exact diff range and evidence. With `on_complete=deploy`, the build session continues through the deploy workflow and leaves the package available for later audit/archive.
