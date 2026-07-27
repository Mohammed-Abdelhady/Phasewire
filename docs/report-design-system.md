# Report design system

Phasewire reports are educational control surfaces, not generic analytics dashboards. Every screen answers: what is happening, why, what connects to it, what could fail, and what happens next.

## Reference synthesis

The report system was checked against the supplied [CoFounder Mobbin reference](https://mobbin.com/sites/cofounder-c556f86f-a320-42fd-bc5f-ee8886297361/8988c520-ae85-4541-b47b-e9265afbab25/preview) and workflow-product references found through Mobbin MCP:

- [Linear project detail](https://mobbin.com/screens/4334db74-bfd4-44fc-a65e-194059099a78): quiet master-detail hierarchy, compact status language, and contextual evidence rail.
- [Linear issue list](https://mobbin.com/screens/6f09ba39-6566-4510-83f1-59cb5115fea9): scan-efficient rows with minimal chrome.
- [Wrike dashboard](https://mobbin.com/screens/d3464e0c-1e21-4076-b612-e12310517b09): modular work summaries and explicit review groupings.
- [Asana reporting](https://mobbin.com/screens/9ad8cea9-3938-4e85-9776-77cc78f598f3): top-level counts that lead into detailed evidence.

Phasewire borrows the information behaviors, not the visual identity. Decorative charts are excluded: a diagram must clarify a relationship, transition, or decision that prose cannot explain as efficiently.

## Surface anatomy

```text
Header: identity · workflow title · connection · direction
                         │
Phase spine ── Report canvas ── Evidence rail
                         │
             decisions · findings · gates
```

- Phase spine: persistent state orientation and current-vs-viewed phase distinction.
- Report canvas: one focused explanation with the current decision or evidence task.
- Evidence rail: immutable events, artifacts, claims, and validation provenance.
- Return trace: a semantic text-first explanation of Review → remediation Plan.
- Gates: bordered, explicit actions that state what they unlock and what they never trigger.

At narrow widths the reading order becomes header → phase spine → report → evidence. The DOM follows this order; CSS never creates a misleading visual order.

## Visual tokens

| Token | Meaning | Required non-color cue |
|---|---|---|
| Blocking red | Stops readiness | Octagon or `Blocking` label |
| Risk amber | Unresolved risk or decision | Triangle or `Risk` label |
| Active blue | Current work or selection | Solid marker and `Active` label |
| Verified green | Passed or complete | Check mark and `Verified` label |
| Context gray | Deferred, inactive, supporting | `Deferred` or contextual label |

Surfaces use neutral paper-like layers, restrained borders, and one high-contrast primary action. Color never carries status alone. Text and focus indicators meet WCAG contrast targets.

## Typography and density

- Display: compact workflow title with disclosure on narrow screens.
- Report title: one clear statement, never a vague dashboard heading.
- Body: short technical sentences with a comfortable reading width.
- Metadata: tabular numerals for clocks, counts, and cycle IDs.
- Code, paths, event IDs: monospace, bidirectionally isolated, and allowed to wrap safely.

Spacing follows a 4px base. Report sections use 16–28px internal rhythm; evidence rows use 12–16px. Every pointer target has a minimum 44×44px hit area.

## Component contracts

### Phase spine

Shows all phases at once. `aria-current="step"` identifies actual workflow state; `aria-pressed` identifies the report being viewed. Selecting a report moves focus to the report heading and announces the change.

### Decision panel

Shows context, realistic options, selected outcome, alternatives, and approval consequence. Failed mutations retain input and attach a visible error through `aria-describedby`.

### Review findings

Groups blocking, non-blocking, improvement, verified, and unverified items. Each finding includes severity, evidence, component, root cause, resolution, and whether another cycle is required.

### Deployment gate

Displays policy evidence and authorization separately. Readiness never implies authorization; authorization never triggers deployment. Any later workflow mutation invalidates prior authorization.

### Connection state

Live, stale, and offline modes remain visibly distinct. Stale state keeps the last confirmed projection and announces that updates are paused. Offline data is read-only.

## Motion and direction

Motion is limited to state continuity: phase selection, incoming evidence, the Review return trace, and non-essential edge flow on interactive diagrams. `prefers-reduced-motion: reduce` removes all essential movement while retaining state labels and relationships.

Horizontal relationships mirror in RTL. Text, paths, and event IDs use explicit bidi isolation. Layout remains usable at 320px and 200% zoom without horizontal page scrolling.

## Interactive diagram contracts

Living maps explain relationships that prose cannot:

- Phase constellation: sequence edges between Plan → Execute → Review → Deploy gate, plus animated return loops for remediation cycles.
- Relation graphs: findings, evidence, and remediation targets with `blocks` / `resolves` / `evidence-for` edges.
- Event river: ordered durable events with actor and phase metadata.
- Readiness chain: validations and review clearance derive ready; authorization remains a separate human node.
- Orientation strip: always shows current phase vs viewed report.

### Interaction rules

- Click or activate a node to focus it and dim unrelated edges.
- Arrow keys follow outgoing/incoming relationships.
- Every diagram ships an ordered text/list equivalent under the SVG.
- Status uses shape + label, never color alone.
- Agents rebuild maps from `apps/web/src/visuals/*` primitives (`geometry`, `InteractiveGraph`, model builders) instead of inventing one-off SVG.

## Template-first rendering

Before a visual is rendered, Phasewire searches the pinned template catalog. The selected template contributes required data, relationships, reading order, semantic tokens, renderer constraints, and motion policy. If no contract fits, a new versioned template is scaffolded, validated, installed, pinned by version+integrity+layer, and then rendered.

## Acceptance checklist

- The screen answers now, why, connections, decisions, risks, and next step.
- Current phase and viewed report are distinguishable without color.
- Every interactive control is keyboard reachable, named, and at least 44px.
- Blocking status is visible in text and shape.
- Tables and diagrams have ordered text equivalents.
- Errors retain user input and identify the affected control.
- Reduced motion and RTL preserve the same meaning.
- Counts and readiness claims come only from durable workflow evidence.
