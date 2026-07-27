# Architecture

Phasewire is a local-first control plane with four separable layers.

```text
Harness adapters and the phasewire CLI
                  │
                  ▼
Authenticated loopback service ───── Visual workbench
                  │                         │
                  ▼                         ▼
Workflow reducer and policy engine   Declarative templates
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
Immutable event files   Disposable SQLite index
```

The CLI and JSON contracts are the universal harness boundary. The browser is an interactive projection; it never owns workflow state. The event store is authoritative. Markdown reports, current-state JSON, SQLite, and visuals are rebuildable projections.

## Workspace packages

| Package | Responsibility |
|---|---|
| `@phasewire/core` | Schemas, canonical events, replay, state policy, claims, diagnostics, migrations, handoffs, templates, and indexing. |
| `@phasewire/server` | Loopback API, interactive session security, SSE updates, and production workbench hosting. |
| `@phasewire/cli` | Conflict-free commands, project discovery, neutral handoffs, and service lifecycle. |
| `@phasewire/web` | Editorial workflow reports, decisions, annotations, evidence, review loops, and explicit readiness gates. |
| `phasewire` (ship) | Publishable single package assembled by `npm run pack:ship` from core, server, CLI, schemas, and built web assets. |

## Ship package

Consumers install or run the published `phasewire` binary (`npx phasewire` / `npm install -g phasewire`). The monorepo remains the development surface; `scripts/pack-ship.mjs` copies built `dist` trees into `packages/phasewire/`, rewrites `@phasewire/*` imports to relative paths, and stages schemas plus the static workbench. Contributors develop with workspace packages; consumers never need the monorepo layout.

## Config schema v2

`.phasewire/config.json` uses `schemaVersion: 2`:

| Field | Role |
|---|---|
| `projectId` | Stable project identity |
| `defaultTemplateId` | Visual template pin default |
| `requiredValidations` | Checks required for readiness evidence |
| `defaultHarness` | Optional default coordination harness |
| `adapters` | Optional installed host list, scope, and install timestamp |
| `ui.autoOpenOnMutate` | Prefer opening the workbench after mutators |
| `ui.autoOpenOnStatusWithId` | Prefer opening on `status <id>` |

Older projects require `phasewire migrate` before write paths accept the config.

## Project state

```text
.phasewire/
├── config.json
├── template-lock.json
├── workflows/<workflow-id>/events/<event-id>.json
├── artifacts/{plans,decisions,executions,reviews,validations}/
├── handoffs/
├── templates/
└── .runtime/
    ├── index.sqlite
    ├── endpoint.json
    └── locks/
```

The `.runtime/` subtree is ignored. Durable semantic events, approved decisions, sanitized evidence, and template pins may travel through Git. Raw conversations, environment values, full logs, credentials, process identifiers, browser state, and local indexes must not.

## Event authority

Each event has a schema version, workflow and event IDs, phase, actor, timestamp, parent event IDs, logical clock, idempotency key, typed payload, and SHA-256 integrity digest. Event parents form a directed acyclic graph. A workflow with multiple heads is read-only until an explicit reconciliation event joins and resolves them; Phasewire never uses last-write-wins.

Writes use an exclusive temporary file, flush, atomic link or rename, and integrity verification. Startup diagnostics replay the event graph and reject missing parents, cycles, duplicate idempotency keys, invalid transitions, integrity failures, unsupported schemas, and unsafe paths.

## Local service lifecycle

`phasewire open` and default mutators that honor UI auto-open start the service on demand. The service binds only to loopback, chooses an available port (or `PHASEWIRE_PORT` when launching the service directly), writes a protected runtime endpoint, and serves the built workbench. Authenticated SSE publishes projection changes. The service is a single writer; readers can rebuild state from disk at any time. Development `npm run dev` uses a fixed 4317/4318 pair with Vite proxying `/api`; production open still uses an ephemeral loopback port.

## Portability boundary

Harness adapters receive a neutral work order containing the objective, current phase, approved decisions, artifact references, validations, expected event heads, and required output schema. A handoff packet carries the same meaning without depending on a provider transcript or active chat session.

`phasewire adapters install` materializes those adapters as host skill/command files for Claude Code, Codex, Grok, and Antigravity. The install target is portable markdown plus optional plugin manifests; every skill still shells out to the `phasewire` CLI and never owns durable state.
