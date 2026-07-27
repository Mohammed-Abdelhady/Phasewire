---
description: "Use when continuing a validated Phasewire handoff in the current harness. Trigger with /phasewire:resume or $phasewire-resume."
---

# Phasewire resume

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire resume <workflow-id> --harness claude --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

