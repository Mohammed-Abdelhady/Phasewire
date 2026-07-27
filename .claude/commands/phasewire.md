---
description: "Use for Phasewire workflow control across harnesses. Triggers on /phasewire, /phasewire:*, phasewire plan/execute/review/resume/status/handoff/open, or handoff between codex, grok, claude, and agy."
---

# Phasewire

Follow the Phasewire skill contract for this host.

1. Detect the current host as `claude`.
2. Execute the `phasewire status --json` flow using the phasewire CLI.
3. Keep the `phasewire` namespace and never deploy.

If this command is a hub (`/phasewire`), route to plan, execute, review, resume, status, handoff, or open from the user args.

