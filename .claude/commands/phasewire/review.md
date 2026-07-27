---
description: "Use when starting an independent Phasewire review (workflow and/or code). Trigger with /phasewire:review or $phasewire-review. Always apply CODE_QUALITY_AND_ENGINEERING.md multi-axis bar."
---

# Phasewire review

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire review <workflow-id> --harness claude --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

