# Phasewire

Phasewire is a local-first control layer for persistent software-delivery workflows that move safely between coding harnesses.

```text
Plan → Execute → Review
  ↑                 │
  └──── issues ─────┘
```

The project stores durable workflow meaning as immutable, Git-portable events under `.phasewire/`. A disposable local index powers the CLI and visual workbench. Blocking review findings always open a remediation cycle; a clean review can mark the workflow deployment-ready, but Phasewire never deploys.

## Command namespace

Phasewire owns one conflict-resistant namespace:

```sh
phasewire init
phasewire plan "Add idempotent webhook retries" --harness codex
phasewire status --json
phasewire handoff create <workflow-id> --to grok
phasewire resume <workflow-id> --harness grok
phasewire review <workflow-id> --harness agy
phasewire open <workflow-id>
```

Slash-command adapters must use `/phasewire:plan`; skill hosts use `$phasewire-plan`. Bare `/plan`, `/execute`, `/review`, and `/resume` aliases are intentionally absent.

## Development

Requires Node.js 24 or newer.

```sh
npm install
npm run build
npm test
npm run dev
```

The development web app runs through Vite and proxies project API requests to the loopback service. Production `phasewire open` serves the built workbench from the on-demand local service.

## Durable and private state

Commit `.phasewire/config.json`, workflow events, approved plans, decisions, findings, validation summaries, handoff packets, and template pins. Runtime locks, SQLite projections, raw conversations, full logs, environment values, browser state, and unsanitized command output remain under ignored `.phasewire/.runtime/` paths.

## Security model

The service binds to loopback, validates host and origin, and requires a per-session token. Project file access is root-confined. Templates are declarative data; they do not execute package code. Deployment authorization is an explicit user event and is deliberately separate from any external deployment tool.

