---
description: Use when opening the local Phasewire visual workbench. Trigger with /phasewire:open or $phasewire-open.
---

# Phasewire open

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire open [workflow-id] --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

