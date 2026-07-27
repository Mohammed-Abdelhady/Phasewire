# Workflow guide

Phasewire manages one persistent loop:

```text
Plan → Execute → Review
  ↑                 │
  └── blockers ─────┘
```

Review findings with blocking severity return the workflow to remediation planning. The new plan must be approved, executed, and independently reviewed. Zero blocking findings and all required validations derive deployment readiness. Readiness does not deploy anything.

## Init and setup

Prefer the published CLI:

```sh
npx phasewire init
npx phasewire setup
```

- `init` creates `.phasewire/` and config schema **v2** (project id, default template, required validations, optional `defaultHarness`, `adapters`, and `ui`).
- `setup` re-runs the wizard on an existing project without wiping durable events.
- Interactive TTY prompts for project id, default harness, adapter hosts/scope, validations, and auto-open preference.
- Non-interactive: `--yes` / `--json` / non-TTY use flags and defaults (`--project-id`, `--default-harness`, `--hosts`, `--scope`, `--validation`, `--auto-open` / `--no-auto-open`, `--no-adapters`).

Config inspection and edits:

```sh
npx phasewire config show
npx phasewire config set ui.autoOpenOnMutate true
```

## Start and inspect

```sh
npx phasewire plan "Add idempotent webhook retries" --harness codex
npx phasewire status --json
npx phasewire open <workflow-id>
```

### Auto-open and `--no-open`

- Mutating commands that may surface the workbench honor `ui.autoOpenOnMutate` (default preference after setup).
- `status <workflow-id>` opens only when `ui.autoOpenOnStatusWithId` is true.
- Explicit `open` always launches unless `--no-open` is set.
- `--no-open` always skips the browser (automation, CI, agents) and, for `open --no-open`, can print a one-time session URL for copy/paste.
- Auto-open is a UX preference only; it never bypasses plan approval, CSRF-protected user gates, or deployment authorization.

In this monorepo only, after `npm run build`:

```sh
npm run phasewire -- plan "…" --harness codex
```

## Phase ownership and continuation

```sh
phasewire claim <workflow-id> --phase execute --harness grok
phasewire checkpoint <workflow-id> --harness grok --summary "Retry store implemented"
phasewire release <workflow-id> --phase execute --harness grok
phasewire handoff create <workflow-id> --to agy
phasewire resume <workflow-id> --harness agy
```

Claims are renewable ownership leases, not workflow transitions. An expired or abandoned claim makes unfinished work recoverable. Checkpoints record sanitized summaries and project-relative artifacts; raw command output remains private.

## Execute and review

```sh
phasewire execute <workflow-id> --harness grok
phasewire review <workflow-id> --harness agy
phasewire status <workflow-id>
```

Illegal transitions fail with the next legal command. Execution cannot start before user plan approval. Review cannot start before execution completion. A blocking finding opens another cycle; it cannot be cleared without remediation evidence and re-review.

## Remediation cycle

```sh
phasewire plan-remediation <workflow-id> --harness codex --artifact artifacts/plans/remediation.md
phasewire approve-remediation <workflow-id>
phasewire start-remediation <workflow-id> --harness grok
phasewire complete-remediation <workflow-id> --harness grok --resolved <finding-id>
phasewire review <workflow-id> --harness claude
```

The dedicated remediation proposal preserves the exact open blocker IDs. A user must approve it before remediation execution starts. Completion must resolve exactly that set, and readiness remains impossible until a new review completes without blockers.

## Recovery

```sh
phasewire doctor
phasewire rebuild
phasewire migrate
phasewire export > phasewire-export.json
phasewire reconcile <workflow-id> --select-parent <event-id> --rationale "Keep the verified branch"
```

`doctor` checks schemas, integrity, event topology, unsafe paths, handoffs, and template pins. `rebuild` recreates disposable projections. `migrate` upgrades supported older schemas without rewriting immutable events. `export` remains available for newer read-only schemas. `reconcile` is required when Git produces more than one event head.

## Deployment boundary

```sh
phasewire authorize-deployment <workflow-id>
```

Authorization can be recorded only after readiness and only through an interactive user gate. It records intent; Phasewire has no deployment command or deployment adapter in v1. External release tooling remains a separate, user-controlled action.

## Command namespace

CLI commands always start with `phasewire`. Install host adapters once per project or user profile:

```sh
npx phasewire adapters install --host all --scope project
```

After install and a host restart:

- Claude Code: `/phasewire`, `/phasewire:plan`, `/phasewire:execute`, `/phasewire:review`, `/phasewire:resume`, `/phasewire:status`, `/phasewire:handoff`, `/phasewire:open`
- Codex / Grok skill hosts: `$phasewire-plan`, `$phasewire-execute`, `$phasewire-review`, `$phasewire-resume`, …
- Antigravity (Agy): `phasewire-*` skills and workflows under `.agent/`

Bare `/plan`, `/execute`, `/review`, and `/resume` aliases remain intentionally unsupported.
