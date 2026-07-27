# Phasewire

Phasewire is a local-first control layer for persistent software-delivery workflows that move safely between coding harnesses.

```text
Plan → Execute → Review
  ↑                 │
  └──── issues ─────┘
```

Durable workflow meaning is stored as immutable, Git-portable events under `.phasewire/`. A disposable local index powers the CLI and visual workbench. Blocking review findings always open a remediation cycle; a clean review can mark the workflow deployment-ready, but Phasewire never deploys.

## Quick start (published package)

Requires **Node.js 24+** for the published `phasewire` package (monorepo engines allow 22.13+ for development).

```sh
npx phasewire init
npx phasewire setup
npx phasewire adapters install --host all --scope project
npx phasewire plan "Add idempotent webhook retries" --harness codex
npx phasewire status --json
npx phasewire open <workflow-id>
```

Or install globally:

```sh
npm install -g phasewire
phasewire --help
```

`init` creates `.phasewire/config.json` (schema v2). `setup` re-runs the same wizard on an existing project. Prefer `npx phasewire …` for consumers; monorepo scripts below are for contributors only.

## Local service and workbench

- `phasewire open` and default mutators (for example `plan`) start a loopback service on demand and open the visual workbench when UI auto-open is enabled.
- Pass `--no-open` to skip the browser (automation, CI, headless agents).
- Config keys `ui.autoOpenOnMutate` (default preference for mutators) and `ui.autoOpenOnStatusWithId` control optional open behavior; `--no-open` always wins.
- Development monorepo pair: API on **4317**, Vite UI on **4318** via `npm run dev`. Production `open` uses an ephemeral loopback port.

## Command namespace

Phasewire owns one conflict-resistant namespace. Host adapters must keep the `phasewire` prefix:

| Surface | Form |
|---|---|
| Shell / npx | `npx phasewire <command>` / `phasewire <command>` |
| Claude Code slash | `/phasewire`, `/phasewire:plan`, `/phasewire:execute`, … |
| Skill hosts | `$phasewire-plan`, `$phasewire-execute`, … |
| Antigravity (Agy) | `phasewire-*` skills/workflows under `.agent/` |

Bare `/plan`, `/execute`, `/review`, and `/resume` aliases are intentionally absent.

## Harness adapters

```sh
npx phasewire adapters install --host all --scope project
```

| Host | Triggers after install |
|---|---|
| Claude Code | `/phasewire`, `/phasewire:plan`, `/phasewire:execute`, `/phasewire:review`, `/phasewire:resume`, `/phasewire:status`, `/phasewire:handoff`, `/phasewire:open` |
| Codex / Grok | `$phasewire-plan`, `$phasewire-execute`, `$phasewire-review`, `$phasewire-resume`, … |
| Antigravity (Agy) | skills/workflows named `phasewire-*` under `.agent/` |

Restart the host session after install so slash menus refresh.

## Manual npm publish runbook

Publish only when explicitly authorized. From the monorepo root:

```sh
npm run build
npm test
npm run pack:ship
npm publish -w phasewire --access public
```

`pack:ship` rewrites workspace imports into `packages/phasewire/dist` and copies schemas + built web assets. Inspect `packages/phasewire/` before publish. Do not use `npm publish` from package roots other than the ship package, and never bypass quality gates.

## Monorepo contributor path (secondary)

Requires **Node.js 22.13+** (CI also covers Node 24). Run every command from the **repository root**.

```sh
npm install
npm run build
npm run phasewire -- init
npm run phasewire -- adapters install --host all --scope project
npm run dev
```

Workbench while developing:

- Web UI: [http://127.0.0.1:4318/](http://127.0.0.1:4318/)
- API service: [http://127.0.0.1:4317/](http://127.0.0.1:4317/) (proxied by Vite as `/api`)

CLI in this workspace (after build):

```sh
npm run phasewire -- <command> [args]
./node_modules/.bin/phasewire status --json
npx phasewire status --json
```

Quality:

```sh
npm run quality:commit # structure + static (build:deps + lint + typecheck) + unit tests
npm run quality:push   # quality:commit + full build + audit + browser
npm run quality        # alias of quality:push (pre-push gate)
```

Every authored source, test, configuration, style, schema, and documentation file is limited to 350 physical lines. See [Quality gates](docs/quality-gates.md).

**Engineering bar:** [Code quality & engineering](CODE_QUALITY_AND_ENGINEERING.md) · **Review process:** [Code review](docs/code-review.md)

## Durable and private state

Commit `.phasewire/config.json`, workflow events, approved plans, decisions, findings, validation summaries, handoff packets, and template pins. Runtime locks, SQLite projections, raw conversations, full logs, environment values, browser state, and unsanitized command output remain under ignored `.phasewire/.runtime/` paths.

## Security model

The service binds to loopback, validates host and origin, and requires a per-session token. Project file access is root-confined. Templates are declarative data; they do not execute package code. Auto-opening the workbench does not weaken approval or authorization gates. Deployment authorization is an explicit user event and is deliberately separate from any external deployment tool.

## Documentation

- [Architecture](docs/architecture.md)
- [Workflow guide](docs/workflow.md)
- [Visual templates](docs/templates.md)
- [Report design system](docs/report-design-system.md)
- [Security and privacy](docs/security.md)
- [Quality gates](docs/quality-gates.md)
- [Code quality & engineering](CODE_QUALITY_AND_ENGINEERING.md)
- [Code review process](docs/code-review.md)
- [Contributor and harness rules](AGENTS.md)
- [Published package README](packages/phasewire/README.md)
