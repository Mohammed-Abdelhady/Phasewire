# Security and privacy

Phasewire assumes coding harnesses can read project files and propose events, but they do not receive implicit user authority. The service, event reducer, and filesystem boundary validate every state-changing request.

Harness names are coordination identities in v1, not authentication principals: project-token holders can assert another harness name. Claims prevent accidental concurrent mutation, while plan approval and deployment authorization remain cookie-and-CSRF-protected user capabilities. Claim timestamps come from the store clock and leases are capped at one hour.

## Local service

- Bind only to IPv4 or IPv6 loopback.
- Validate `Host` and exact `Origin` for unsafe requests to prevent DNS-rebinding and same-host cross-port attacks.
- Require a cryptographic session token for all APIs.
- Require an interactive cookie plus CSRF token for plan approval and deployment authorization.
- Treat bearer and header credentials as harness capabilities; they cannot forge interactive user gates.
- Store endpoint metadata with owner-only permissions and atomic, no-follow writes.
- Keep launch capabilities out of normal CLI and JSON output; only explicit `open --no-open` prints a one-time session URL.

## Auto-open does not weaken gates

UI preferences such as `ui.autoOpenOnMutate`, `ui.autoOpenOnStatusWithId`, and the default browser launch from mutators only control whether a loopback workbench URL is opened. They do not:

- grant plan approval or deployment authorization,
- skip CSRF or interactive cookie requirements,
- relax host/origin validation, token checks, or root-confined filesystem access,
- turn harness coordination identities into authentication principals.

`--no-open` is the supported automation escape hatch; security policy is identical whether the browser opens or not.

## Filesystem boundary

Every identifier is portable and path-safe. Reads and writes resolve against the real project root, reject traversal, reject symbolic-link escapes, and use no-follow final-file operations where the platform supports them. Runtime locks and projections stay under `.phasewire/.runtime/`.

The remaining platform-level race between a containment check and a parent-directory swap cannot be fully eliminated with path-based Node APIs. Phasewire narrows this window with no-follow file handles, single-writer ownership, and repeated containment checks; hostile concurrent filesystem mutation is outside the v1 trust model.

## Durable privacy profile

Safe durable state includes approved plans, decisions, annotations, finding evidence, validation summaries, transitions, neutral handoffs, relevant project-relative paths and hashes, and pinned template identities.

Private runtime state includes raw prompts and conversations, full command output, environment values, credentials, absolute machine paths, browser state, local indexes, locks, ports, process identifiers, and unsanitized logs. Store sanitized excerpts only when a user deliberately includes them.

## Template trust

Templates are declarative data. Installation validates schema, namespace, semantic version, relationships, layout constraints, accessibility metadata, renderer compatibility, and integrity. Resolution is explicit across built-in, user, and project layers. A template package never executes JavaScript.

## Deployment boundary

Deployment readiness is derived from review and validation evidence. Approval is an authenticated user event. Phasewire never executes a deployment command, interpolates model output into a shell, or treats a harness identity as user authorization.

## Reporting a problem

Run `phasewire doctor --json` and preserve only the redacted result. Do not attach `.phasewire/.runtime/`, raw logs, environment files, or credentials to an issue.
