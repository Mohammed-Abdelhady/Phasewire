---
description: "Use for a read-only Phasewire status snapshot. Trigger with /phasewire:status or $phasewire-status."
---

# Phasewire status

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire status [workflow-id] --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

