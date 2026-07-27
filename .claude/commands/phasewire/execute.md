---
description: "Use when beginning or continuing Phasewire execution after plan approval. Trigger with /phasewire:execute or $phasewire-execute."
---

# Phasewire execute

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire execute <workflow-id> --harness claude --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

