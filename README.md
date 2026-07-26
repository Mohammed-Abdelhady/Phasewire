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
phasewire review <workflow-id> --harness claude
phasewire open <workflow-id>
```

## Harness adapters

Install portable skills/commands so Claude Code, Codex, Grok, and Antigravity (Agy) can drive Phasewire with the unique namespace:

```sh
npm run build
phasewire adapters install --host all --scope project
```

| Host | Triggers after install |
|---|---|
| Claude Code | `/phasewire`, `/phasewire:plan`, `/phasewire:execute`, `/phasewire:review`, `/phasewire:resume`, `/phasewire:status`, `/phasewire:handoff`, `/phasewire:open` |
| Codex / Grok | `$phasewire-plan`, `$phasewire-execute`, `$phasewire-review`, `$phasewire-resume`, … |
| Antigravity (Agy) | skills/workflows named `phasewire-*` under `.agent/` |

Adapters only wrap the `phasewire` CLI. Bare `/plan`, `/execute`, `/review`, and `/resume` aliases stay intentionally absent. Restart the host session after install so slash menus refresh.

```sh
phasewire adapters install --host claude --scope project
phasewire adapters install --host all --scope user
```

## Development

Requires Node.js 24 or newer.

```sh
npm install
npm run build
npm test
npm run dev
phasewire adapters install --host all --scope project
```

## Quality gates

`npm run quality` runs structural limits, lint, format check, strict typechecking, unit and integration tests, production builds, dependency auditing, and browser acceptance. Husky installs a fast pre-commit gate and the complete pre-push gate through `npm install`.

Every authored source, test, configuration, style, schema, and documentation file is limited to 350 physical lines. Generated and vendored files such as `package-lock.json`, `dist/`, and `node_modules/` are excluded. See [Quality gates](docs/quality-gates.md) for the layer contract and failure policy.

**Engineering bar:** [Code quality & engineering](CODE_QUALITY_AND_ENGINEERING.md) · **Review process:** [Code review](docs/code-review.md)

The development web app runs through Vite and proxies project API requests to the loopback service. Production `phasewire open` serves the built workbench from the on-demand local service.

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
- [Code quality & engineering](CODE_QUALITY_AND_ENGINEERING.md)
- [Code review process](docs/code-review.md)
- [Contributor and harness rules](AGENTS.md)
