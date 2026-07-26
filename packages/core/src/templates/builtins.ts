import { createVisualTemplate, scaffoldVisualTemplate } from './factory.js'
import type { VisualNodeKind, VisualTemplate } from '../types.js'

interface TemplateSeed {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly intendedUse: readonly string[]
  readonly excludedUses: readonly string[]
  readonly primaryKind: VisualNodeKind
  readonly primaryBinding: string
  readonly relations: VisualTemplate['supportedRelations']
  readonly preferredFlow: VisualTemplate['layoutRules']['preferredFlow']
}

function makeTemplate(seed: TemplateSeed): VisualTemplate {
  const scaffold = scaffoldVisualTemplate(seed)
  const { integrity: _integrity, ...input } = scaffold
  void _integrity
  return createVisualTemplate({
    ...input,
    intendedUse: seed.intendedUse,
    excludedUses: seed.excludedUses,
    supportedRelations: seed.relations,
    layoutRules: {
      ...input.layoutRules,
      preferredFlow: seed.preferredFlow,
      maximumColumns: seed.preferredFlow === 'horizontal' ? 4 : 2,
      rtlMirrored: seed.preferredFlow === 'horizontal',
    },
  })
}

const TEMPLATE_SEEDS: readonly TemplateSeed[] = [
  {
    id: 'phasewire.default', name: 'Workflow Control Surface',
    description: 'Phase spine, workflow report, evidence, and readiness in one semantic surface.',
    intendedUse: ['General workflow inspection', 'Cross-harness resume'],
    excludedUses: ['Source-code rendering', 'Deployment execution'], primaryKind: 'section',
    primaryBinding: 'status', relations: ['sequence', 'evidence-for'], preferredFlow: 'adaptive',
  },
  {
    id: 'phasewire.architecture', name: 'Architecture Map',
    description: 'System boundaries and parent-child or dependency relationships.',
    intendedUse: ['Architecture decisions', 'Component boundaries'],
    excludedUses: ['Event chronology', 'Dense source trees'], primaryKind: 'grid',
    primaryBinding: 'architecture.nodes', relations: ['depends-on', 'parent-child'], preferredFlow: 'adaptive',
  },
  {
    id: 'phasewire.state-machine', name: 'State Machine',
    description: 'States, transitions, guards, and terminal outcomes.',
    intendedUse: ['Workflow state analysis', 'Transition validation'],
    excludedUses: ['Unordered comparisons', 'Free-form prose'], primaryKind: 'timeline',
    primaryBinding: 'stateMachine.states', relations: ['sequence', 'blocks'], preferredFlow: 'horizontal',
  },
  {
    id: 'phasewire.sequence-handoff', name: 'Sequence and Handoff',
    description: 'Ordered actor interactions and neutral handoff boundaries.',
    intendedUse: ['Harness handoffs', 'Actor sequences'], excludedUses: ['Static inventory', 'Deployment automation'],
    primaryKind: 'timeline', primaryBinding: 'handoffs', relations: ['sequence', 'evidence-for'], preferredFlow: 'horizontal',
  },
  {
    id: 'phasewire.comparison', name: 'Comparison Matrix',
    description: 'Comparable options with explicit criteria and trade-offs.',
    intendedUse: ['Option analysis', 'Alternative evaluation'], excludedUses: ['Single option reports', 'Chronological logs'],
    primaryKind: 'grid', primaryBinding: 'comparisons', relations: ['parent-child'], preferredFlow: 'horizontal',
  },
  {
    id: 'phasewire.review-findings', name: 'Review Findings',
    description: 'Severity-aware findings, evidence, and remediation state.',
    intendedUse: ['Code review', 'Security findings', 'Quality gates'], excludedUses: ['Unverified ideas', 'Deployment execution'],
    primaryKind: 'list', primaryBinding: 'review.findings', relations: ['blocks', 'resolves', 'evidence-for'], preferredFlow: 'vertical',
  },
  {
    id: 'phasewire.execution-report', name: 'Execution Report',
    description: 'Implementation checkpoints, changed artifacts, and validation evidence.',
    intendedUse: ['Implementation progress', 'Validation summaries'], excludedUses: ['Raw logs', 'Secret-bearing output'],
    primaryKind: 'evidence', primaryBinding: 'artifacts', relations: ['sequence', 'evidence-for'], preferredFlow: 'vertical',
  },
  {
    id: 'phasewire.issue-resolution', name: 'Issue Resolution',
    description: 'Blocking issue lineage from detection through remediation and re-review.',
    intendedUse: ['Remediation cycles', 'Root-cause resolution'], excludedUses: ['Backlog prioritization', 'Unrelated task lists'],
    primaryKind: 'timeline', primaryBinding: 'review.findings', relations: ['blocks', 'resolves', 'sequence'], preferredFlow: 'vertical',
  },
  {
    id: 'phasewire.dependency-map', name: 'Dependency Map',
    description: 'Dependency direction, ownership, and blocking relationships.',
    intendedUse: ['Task dependencies', 'Package dependencies'], excludedUses: ['Runtime tracing', 'Unbounded graphs'],
    primaryKind: 'grid', primaryBinding: 'dependencies', relations: ['depends-on', 'blocks', 'parent-child'], preferredFlow: 'adaptive',
  },
  {
    id: 'phasewire.readiness', name: 'Deployment Readiness',
    description: 'Read-only readiness evidence without deployment capability.',
    intendedUse: ['Pre-deployment assessment', 'Validation coverage'], excludedUses: ['Deployment execution', 'Environment mutation'],
    primaryKind: 'stack', primaryBinding: 'deploymentReadiness', relations: ['blocks', 'evidence-for'], preferredFlow: 'vertical',
  },
  {
    id: 'phasewire.decision', name: 'Decision Record',
    description: 'Decision context, outcome, alternatives, and evidence.',
    intendedUse: ['Architecture decisions', 'Scope decisions'], excludedUses: ['Transient chat', 'Unapproved instructions'],
    primaryKind: 'section', primaryBinding: 'decisions', relations: ['evidence-for', 'parent-child'], preferredFlow: 'vertical',
  },
  {
    id: 'phasewire.timeline-progress', name: 'Timeline and Progress',
    description: 'Logical event chronology, phases, and progress markers.',
    intendedUse: ['Workflow history', 'Phase progress'], excludedUses: ['Wall-clock performance claims', 'Raw conversation history'],
    primaryKind: 'timeline', primaryBinding: 'events', relations: ['sequence'], preferredFlow: 'horizontal',
  },
]

export const BUILTIN_VISUAL_TEMPLATES: readonly VisualTemplate[] = Object.freeze(TEMPLATE_SEEDS.map(makeTemplate))
export const DEFAULT_VISUAL_TEMPLATE = BUILTIN_VISUAL_TEMPLATES[0] as VisualTemplate
