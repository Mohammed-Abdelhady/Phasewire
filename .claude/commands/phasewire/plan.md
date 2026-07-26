---
description: Use when starting a Phasewire workflow from a goal. Trigger with /phasewire:plan, $phasewire-plan, or "phasewire plan".
---

# Phasewire plan

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire plan "<goal>" --harness claude --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

