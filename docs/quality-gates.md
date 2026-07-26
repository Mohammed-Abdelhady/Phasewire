# Quality gates

Phasewire uses the same layered checks locally, in Git hooks, and in CI. A gate failure stops the operation; bypass flags are not part of the supported workflow.

## Quality layers

| Layer | Command | Purpose |
|---|---|---|
| Structure | `npm run quality:structure` | Enforces the 350-line maximum for authored files and excludes generated/vendor output. |
| Static | `npm run quality:static` | Builds `@phasewire/core` + `@phasewire/server` (typed deps), ESLint zero warnings, strict TypeScript. Prettier is available via `npm run format` / `format:check` for contributor hygiene. |
| Tests | `npm run quality:test` | Runs deterministic kernel, security, API, CLI, and component tests. |
| Build | `npm run quality:build` | Produces every workspace package and the optimized visual workbench. |
| Security | `npm run quality:security` | Fails on dependency advisories at high severity or above. |
| Browser | `npm run quality:browser` | Exercises the integrated workflow and accessibility behavior in Chromium. |

`npm run quality` runs every layer in dependency order.

## Local Git hooks

Husky installs hooks through the `prepare` script after `npm install`.

- Pre-commit runs `quality:commit`: structure, static analysis, and the fast test suite.
- Commit-msg enforces Conventional Commits with a focused subject of at most 72 characters.
- Pre-push runs `quality:push`: all pre-commit layers plus production builds, dependency audit, and browser tests.

Set `HUSKY=0` only in non-interactive CI or production dependency installation. Local bypasses such as `--no-verify` are unsupported.

## CI

The verification matrix runs on Linux, macOS, and Windows with Node.js 24. Browser acceptance runs separately on Chromium. The CI commands call the same npm scripts used by local hooks, so a green local gate predicts the remote result.

## Failure handling

Fix the earliest failing layer, rerun that layer, then rerun the aggregate gate. Do not suppress strict types, reduce audit severity, disable tests, or expand the file-size exemption list to make a gate pass.
