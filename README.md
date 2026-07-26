# Phasewire

Phasewire is a local-first control layer for persistent software-delivery workflows that move safely between coding harnesses.

```text
Plan → Execute → Review
  ↑                 │
  └──── issues ─────┘
```

Durable workflow meaning is stored as immutable, Git-portable events under `.phasewire/`. A disposable local index powers the CLI and visual workbench. Blocking review findings always open a remediation cycle; a clean review can mark the workflow deployment-ready, but Phasewire never deploys.

## Quick start

Requires **Node.js 24+**. Run every command from the **repository root** (not `packages/*` or `apps/*`).

```sh
npm install
npm run build
npm run phasewire -- init
npm run phasewire -- adapters install --host all --scope project
npm run dev
```

Then open the workbench:

- Web UI: [http://127.0.0.1:4318/](http://127.0.0.1:4318/)
- API service: [http://127.0.0.1:4317/](http://127.0.0.1:4317/) (proxied by Vite as `/api`)

`npm run dev` starts both the loopback service on **4317** and the Vite app on **4318**. If the UI shows proxy errors to `:4317`, stop the process and start `npm run dev` again from the repo root.

## CLI invocation

In this monorepo, `phasewire` is **not** a global shell command until you publish or `npm link` the CLI.

Prefer:

```sh
npm run phasewire -- <command> [args]
```

Examples:

```sh
npm run phasewire -- init
npm run phasewire -- plan "Add idempotent webhook retries" --harness codex
npm run phasewire -- status --json
npm run phasewire -- handoff create <workflow-id> --to grok
npm run phasewire -- resume <workflow-id> --harness grok
npm run phasewire -- review <workflow-id> --harness claude
npm run phasewire -- open <workflow-id>
npm run phasewire -- adapters install --host all --scope project
```

Also works from the repo root after `npm install` + `npm run build`:

```sh
./node_modules/.bin/phasewire status --json
npx phasewire status --json
```

Optional global link (developer machine only):

```sh
npm run build -w @phasewire/cli
npm link -w @phasewire/cli
phasewire --help
```

## Command namespace

Phasewire owns one conflict-resistant namespace. Host adapters must keep the `phasewire` prefix:

| Surface | Form |
|---|---|
| Shell / npm script | `phasewire <command>` / `npm run phasewire -- <command>` |
| Claude Code slash | `/phasewire`, `/phasewire:plan`, `/phasewire:execute`, … |
| Skill hosts | `$phasewire-plan`, `$phasewire-execute`, … |
| Antigravity (Agy) | `phasewire-*` skills/workflows under `.agent/` |

Bare `/plan`, `/execute`, `/review`, and `/resume` aliases are intentionally absent.

## Harness adapters

Install portable skills/commands for Claude Code, Codex, Grok, and Antigravity:

```sh
npm run build
npm run phasewire -- adapters install --host all --scope project
```

| Host | Triggers after install |
|---|---|
| Claude Code | `/phasewire`, `/phasewire:plan`, `/phasewire:execute`, `/phasewire:review`, `/phasewire:resume`, `/phasewire:status`, `/phasewire:handoff`, `/phasewire:open` |
| Codex / Grok | `$phasewire-plan`, `$phasewire-execute`, `$phasewire-review`, `$phasewire-resume`, … |
| Antigravity (Agy) | skills/workflows named `phasewire-*` under `.agent/` |

Restart the host session after install so slash menus refresh.

```sh
npm run phasewire -- adapters install --host claude --scope project
npm run phasewire -- adapters install --host all --scope user
```

## Development

```sh
npm install
npm run build
npm test
npm run dev
```

Quality:

```sh
npm run quality        # full gate used by pre-push
npm run quality:commit # structure + lint + typecheck + unit tests
```

`npm run quality` runs structural limits, lint, strict typechecking, unit and integration tests, production builds, dependency auditing, and browser acceptance. Husky installs a fast pre-commit gate and the complete pre-push gate through `npm install`.

Every authored source, test, configuration, style, schema, and documentation file is limited to 350 physical lines. Generated and vendored files such as `package-lock.json`, `dist/`, and `node_modules/` are excluded. See [Quality gates](docs/quality-gates.md).

Production `phasewire open` still launches an on-demand loopback service on an ephemeral port. Dev mode keeps the fixed 4317/4318 pair for Vite proxying.

## Durable and private state

Commit `.phasewire/config.json`, workflow events, approved plans, decisions, findings, validation summaries, handoff packets, and template pins. Runtime locks, SQLite projections, raw conversations, full logs, environment values, browser state, and unsanitized command output remain under ignored `.phasewire/.runtime/` paths.

## Security model

The service binds to loopback, validates host and origin, and requires a per-session token. Project file access is root-confined. Templates are declarative data; they do not execute package code. Deployment authorization is an explicit user event and is deliberately separate from any external deployment tool.

## Documentation

- [Architecture](docs/architecture.md)
- [Workflow guide](docs/workflow.md)
- [Visual templates](docs/templates.md)
- [Report design system](docs/report-design-system.md)
- [Security and privacy](docs/security.md)
- [Quality gates](docs/quality-gates.md)
- [Contributor and harness rules](AGENTS.md)
