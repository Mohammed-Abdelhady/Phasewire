---
description: Use when creating a portable Phasewire handoff to another harness. Trigger with /phasewire:handoff or $phasewire-handoff.
---

# Phasewire handoff

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire handoff create <workflow-id> --to <harness> --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

