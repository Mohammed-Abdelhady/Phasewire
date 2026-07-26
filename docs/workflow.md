# Workflow guide

Phasewire manages one persistent loop:

```text
Plan → Execute → Review
  ↑                 │
  └── blockers ─────┘
```

Review findings with blocking severity return the workflow to remediation planning. The new plan must be approved, executed, and independently reviewed. Zero blocking findings and all required validations derive deployment readiness. Readiness does not deploy anything.

## Start and inspect

```sh
phasewire init
phasewire plan "Add idempotent webhook retries" --harness codex
phasewire status --json
phasewire open <workflow-id>
```

`phasewire plan` opens the visual workbench by default. Use `--no-open` in automation. The browser records material decisions and the explicit plan approval event.

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

CLI commands always start with `phasewire`. Slash hosts use `/phasewire:<command>` and skill hosts use `$phasewire-<command>`. Bare `/plan`, `/execute`, `/review`, and `/resume` aliases are intentionally unsupported.
