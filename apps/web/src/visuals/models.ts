import type {
  PhaseId,
  PhaseStatus,
  ReviewFinding,
  WorkflowEvent,
  WorkflowProjection,
} from '../types'
import type { GraphModel, RelationKind, VisualStatus } from './types'

function phaseStatus(status: PhaseStatus): VisualStatus {
  if (status === 'blocked') return 'blocked'
  if (status === 'complete') return 'complete'
  if (status === 'active') return 'active'
  if (status === 'ready') return 'ready'
  return 'queued'
}

export function workflowPhaseModel(workflow: WorkflowProjection): GraphModel {
  const nodes = workflow.phases.map((phase) => ({
    id: phase.id,
    label: phase.label,
    subtitle: phase.harness,
    status: phaseStatus(phase.status),
    kind: 'phase' as const,
    meta: phase.owner,
  }))

  const edges: GraphModel['edges'][number][] = workflow.phases.slice(0, -1).map((phase, index) => {
    const next = workflow.phases[index + 1]
    return {
      id: `seq-${phase.id}-${next?.id ?? 'end'}`,
      from: phase.id,
      to: next?.id ?? phase.id,
      kind: 'sequence' as const,
      label: 'then',
      animated: phase.id === workflow.currentPhase,
    }
  })

  const blockers = workflow.findings.filter((finding) => finding.classification === 'blocking')
  if (blockers.length > 0 && workflow.cycleCount > 1) {
    edges.push({
      id: 'return-review-plan',
      from: 'review',
      to: 'plan',
      kind: 'return',
      label: `cycle ${String(workflow.cycleCount).padStart(2, '0')}`,
      animated: true,
    })
  }

  return {
    nodes,
    edges,
    focusId: workflow.currentPhase,
  }
}

export function findingRelationModel(
  findings: readonly ReviewFinding[],
  currentPhase: PhaseId,
): GraphModel {
  const nodes = [
    {
      id: 'review-root',
      label: 'Review',
      subtitle: `${findings.length} findings`,
      status: findings.some((item) => item.classification === 'blocking')
        ? ('blocked' as const)
        : ('active' as const),
      kind: 'phase' as const,
    },
    ...findings.map((finding) => ({
      id: finding.id,
      label: finding.title,
      subtitle: finding.component,
      status:
        finding.classification === 'blocking'
          ? ('blocked' as const)
          : finding.classification === 'improvement'
            ? ('risk' as const)
            : ('unverified' as const),
      kind: 'finding' as const,
      meta: finding.severity,
    })),
    {
      id: 'remediation-plan',
      label: 'Remediation plan',
      subtitle: currentPhase === 'plan' ? 'Current' : 'Next loop',
      status: currentPhase === 'plan' ? ('active' as const) : ('queued' as const),
      kind: 'decision' as const,
    },
  ]

  const edges = findings.flatMap((finding) => {
    const links: {
      id: string
      from: string
      to: string
      kind: RelationKind
      label: string
      animated?: boolean
    }[] = [
      {
        id: `blocks-${finding.id}`,
        from: finding.id,
        to: 'remediation-plan',
        kind: finding.classification === 'blocking' ? 'blocks' : 'evidence-for',
        label: finding.classification === 'blocking' ? 'blocks' : 'informs',
        animated: finding.classification === 'blocking',
      },
      {
        id: `from-review-${finding.id}`,
        from: 'review-root',
        to: finding.id,
        kind: 'parent-child',
        label: finding.severity,
      },
    ]
    return links
  })

  return { nodes, edges, focusId: findings[0]?.id ?? 'review-root' }
}

export function eventRiverModel(events: readonly WorkflowEvent[]): GraphModel {
  const limited = events.slice(0, 8)
  const nodes = limited.map((event) => ({
    id: event.id,
    label: event.label,
    subtitle: `${event.phase} · ${event.harness}`,
    status: 'complete' as const,
    kind: 'event' as const,
    meta: event.at,
  }))
  const edges = limited.slice(0, -1).map((event, index) => {
    const next = limited[index + 1]
    return {
      id: `evt-${event.id}-${next?.id ?? 'end'}`,
      from: event.id,
      to: next?.id ?? event.id,
      kind: 'sequence' as const,
      label: 'next',
    }
  })
  const focusId = limited[limited.length - 1]?.id
  return focusId === undefined ? { nodes, edges } : { nodes, edges, focusId }
}

export function readinessModel(workflow: WorkflowProjection): GraphModel {
  const nodes = [
    {
      id: 'validations',
      label: 'Validations',
      subtitle: `${workflow.validations.filter((item) => item.status === 'passed').length}/${workflow.validations.length} passed`,
      status: workflow.validations.every((item) => item.status === 'passed')
        ? ('verified' as const)
        : ('risk' as const),
      kind: 'gate' as const,
    },
    {
      id: 'review-clear',
      label: 'Review clear',
      subtitle: `${workflow.findings.filter((item) => item.classification === 'blocking').length} blockers`,
      status: workflow.findings.some((item) => item.classification === 'blocking')
        ? ('blocked' as const)
        : ('verified' as const),
      kind: 'gate' as const,
    },
    {
      id: 'ready',
      label: 'Ready',
      subtitle: workflow.deploymentReady ? 'Derived ready' : 'Not ready',
      status: workflow.deploymentReady ? ('ready' as const) : ('queued' as const),
      kind: 'gate' as const,
    },
    {
      id: 'authorize',
      label: 'Authorize',
      subtitle: workflow.deploymentAuthorized ? 'Recorded' : 'Human only',
      status: workflow.deploymentAuthorized ? ('verified' as const) : ('queued' as const),
      kind: 'gate' as const,
    },
  ]

  return {
    nodes,
    edges: [
      {
        id: 'v-ready',
        from: 'validations',
        to: 'ready',
        kind: 'evidence-for',
        label: 'evidence',
      },
      {
        id: 'r-ready',
        from: 'review-clear',
        to: 'ready',
        kind: 'blocks',
        label: 'gates',
        animated: !workflow.deploymentReady,
      },
      {
        id: 'ready-auth',
        from: 'ready',
        to: 'authorize',
        kind: 'sequence',
        label: 'then human',
      },
    ],
    focusId: workflow.deploymentAuthorized ? 'authorize' : 'ready',
  }
}
