# phasewire

Local-first control layer for Plan → Execute → Review workflows. Durable state lives under `.phasewire/`. Phasewire never deploys.

## Requirements

- Node.js 24+

## Install / run

```sh
npx phasewire --help
npx phasewire init
npx phasewire setup
npx phasewire plan "Describe the work" --harness codex
npx phasewire status --json
npx phasewire open <workflow-id>
```

Or install globally:

```sh
npm install -g phasewire
phasewire --help
```

## Typical flow

```sh
npx phasewire init
npx phasewire adapters install --host all --scope project
npx phasewire plan "Add webhook retries" --harness codex
npx phasewire status
npx phasewire open <workflow-id>
```

`init` / `setup` write config schema v2 (validations, optional adapters, UI auto-open). Mutating commands open the workbench by default when `ui.autoOpenOnMutate` is true; pass `--no-open` for automation.

`open` starts the loopback service on demand and opens the workbench. Durable state is project-local under `.phasewire/`.

## Environment

| Variable | Purpose |
|---|---|
| `PHASEWIRE_PROJECT_ROOT` | Override project root discovery |
| `PHASEWIRE_WEB_ROOT` | Override static workbench root |
| `PHASEWIRE_PORT` | Preferred port when launching the service directly |

## Notes

- Service binds to loopback only; session token + host/origin checks apply.
- Review can mark deployment readiness; no command deploys.
- This package ships the monorepo CLI, service, core kernel, schemas, and web UI as one publishable unit.
