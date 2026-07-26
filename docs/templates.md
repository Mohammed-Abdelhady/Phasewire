# Visual template library

Phasewire searches the reusable library before constructing a new visual.

```text
Visual needed
     ↓
Search pinned project, user, and built-in templates
     ↓
Suitable contract found?
├── Yes → configure → validate → render
└── No  → scaffold → validate → register → render
```

## Template contract

Templates define meaning as well as appearance:

- intended and excluded uses;
- input schema and required data;
- supported nodes, relations, and grouping;
- layout and density constraints;
- semantic color tokens plus non-color status cues;
- reading order, keyboard behavior, live-region policy, and text alternatives;
- reduced-motion behavior and bidirectional-layout policy;
- renderer compatibility and output formats;
- semantic version and SHA-256 integrity.

Templates are declarative JSON. Renderers produce semantic HTML as the authority, an SVG projection when a relationship benefits from a diagram, and an ordered text or table equivalent.

## Commands

```sh
phasewire templates search "review findings"
phasewire templates create review-summary --kind list --name "Review summary" --description "Review evidence and findings"
phasewire templates validate ./review-summary.json
phasewire templates add ./review-summary.json
phasewire templates export phasewire.review-findings --output ./review.json
```

Composition merges compatible regions by stable node ID and revalidates the complete manifest. Installed versions are immutable. The lockfile pins version, integrity, and layer so a project template cannot silently shadow a trusted built-in.

## Built-in families

The initial catalog covers architecture, dependency maps, workflow state, harness handoffs, comparisons, decision records, execution reports, issue-resolution flows, review findings, validation matrices, timelines, and deployment readiness.

## Accessibility requirements

A template is invalid unless it defines a logical reading order, keyboard model, complete text equivalent, semantic status labels beyond color, contrast-safe token pairs, reduced-motion fallback, RTL behavior, zoom/reflow limits, and live-region policy.
