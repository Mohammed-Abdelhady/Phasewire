import type {
  FindingSeverity,
  PhaseId,
  PhaseRecord,
  ReviewFinding,
  ValidationResult,
  WorkflowArtifact,
  WorkflowDecision,
  WorkflowProjection,
} from '../types'
import { arrayValue, isRecord, numberValue, recordValue, stringValue } from './helpers'

function isWorkflowProjection(value: unknown): value is WorkflowProjection {
  return (
    isRecord(value) &&
    typeof value.workflowId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.currentPhase === 'string' &&
    Array.isArray(value.phases) &&
    Array.isArray(value.decisions) &&
    Array.isArray(value.findings) &&
    Array.isArray(value.events)
  )
}

function phaseId(value: string): PhaseId {
  if (value === 'execute' || value === 'review') return value
  if (value === 'deployment-ready') return 'ready'
  return 'plan'
}

function phaseOwner(claims: Record<string, unknown>, phase: string): { owner: string; harness: string } {
  const owner = recordValue(recordValue(claims, phase), 'owner')
  const harness = stringValue(owner, 'harness', stringValue(owner, 'id', 'Unclaimed'))
  return { harness, owner: stringValue(owner, 'displayName', harness) }
}

function normalizeFindings(review: Record<string, unknown>): ReviewFinding[] {
  return arrayValue(review, 'findings').flatMap((value) => {
    if (!isRecord(value)) return []
    const rawSeverity = stringValue(value, 'severity', 'info')
    const severity: FindingSeverity =
      rawSeverity === 'blocking' ? 'blocking' : rawSeverity === 'warning' ? 'medium' : 'info'
    const isResolved = typeof value.resolvedByEventId === 'string'
    return [{
      id: stringValue(value, 'id', stringValue(value, 'openedByEventId', 'finding')),
      title: stringValue(value, 'title', 'Untitled review finding'),
      severity,
      classification: rawSeverity === 'blocking' && !isResolved ? 'blocking' : 'non-blocking',
      evidence: stringValue(value, 'detail', `Recorded by event ${stringValue(value, 'openedByEventId')}.`),
      component: stringValue(value, 'artifactPath', 'Workflow implementation'),
      rootCause: 'Root-cause detail is not included in the current workflow projection.',
      resolution: isResolved
        ? `Resolved by event ${stringValue(value, 'resolvedByEventId')}.`
        : 'Resolution guidance has not been recorded.',
      requiresCycle: rawSeverity === 'blocking' && !isResolved,
    }]
  })
}

function normalizeValidations(record: Record<string, unknown>): ValidationResult[] {
  return arrayValue(record, 'validations').flatMap((value) => {
    if (!isRecord(value)) return []
    const rawStatus = stringValue(value, 'status', 'skipped')
    return [{
      id: stringValue(value, 'eventId', stringValue(value, 'check', 'validation')),
      label: stringValue(value, 'check', 'Unnamed validation'),
      status: rawStatus === 'passed' ? 'passed' : rawStatus === 'failed' ? 'failed' : 'unverified',
      detail: stringValue(value, 'summary', `Validation was recorded as ${rawStatus}.`),
    }]
  })
}

function normalizeDecisions(record: Record<string, unknown>): WorkflowDecision[] {
  return arrayValue(record, 'decisions').flatMap((value) => {
    if (!isRecord(value)) return []
    const outcome = stringValue(value, 'outcome', 'Recorded without an outcome label')
    return [{
      id: stringValue(value, 'id', stringValue(value, 'eventId', 'decision')),
      title: stringValue(value, 'title', 'Recorded decision'),
      context: `Persisted by event ${stringValue(value, 'eventId')}.`,
      options: [{ id: 'recorded-outcome', label: outcome, summary: 'Recorded workflow outcome.' }],
      selectedOptionId: 'recorded-outcome',
      requiresApproval: false,
    }]
  })
}

function normalizeArtifacts(record: Record<string, unknown>): WorkflowArtifact[] {
  return arrayValue(record, 'artifacts').flatMap((value) => {
    if (!isRecord(value)) return []
    const kind = stringValue(value, 'kind', 'artifact')
    return [{
      id: stringValue(value, 'eventId', `${kind}-${stringValue(value, 'path')}`),
      label: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} artifact`,
      path: stringValue(value, 'path', 'Artifact path unavailable'),
      kind,
      phase: kind === 'execution' || kind === 'validation' ? 'execute' : phaseId(kind),
    }]
  })
}

function normalizeCoreProjection(value: unknown): WorkflowProjection | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.plan)) return null

  const rawPhase = stringValue(value, 'currentPhase', 'plan')
  const currentPhase = rawPhase === 'remediation' ? 'plan' : phaseId(rawPhase)
  const status = stringValue(value, 'status', 'planning')
  const cycleCount = numberValue(value, 'cycle', 1)
  const plan = recordValue(value, 'plan')
  const execution = recordValue(value, 'execution')
  const review = recordValue(value, 'review')
  const remediation = recordValue(value, 'remediation')
  const readiness = recordValue(value, 'deploymentReadiness')
  const claims = recordValue(value, 'claims')
  const findings = normalizeFindings(review)
  const validations = normalizeValidations(value)
  const decisions = normalizeDecisions(value)
  const artifacts = normalizeArtifacts(value)
  const lastEventAt = stringValue(value, 'lastEventAt', new Date(0).toISOString())
  const eventCount = numberValue(value, 'eventCount', 0)
  const blockerCount = findings.filter((finding) => finding.classification === 'blocking').length
  const planOwner = phaseOwner(claims, rawPhase === 'remediation' ? 'remediation' : 'plan')
  const executeOwner = phaseOwner(claims, 'execute')
  const reviewOwner = phaseOwner(claims, 'review')
  const deploymentReady = readiness.ready === true
  const remediationPlanning = rawPhase === 'remediation'
  const currentPlanApproved = remediationPlanning ? remediation.approved === true : plan.approved === true
  const phases: PhaseRecord[] = [
    {
      id: 'plan', label: rawPhase === 'remediation' ? 'Remediation plan' : 'Plan',
      status: status === 'conflicted' ? 'blocked' : currentPhase === 'plan' ? 'active' : currentPlanApproved ? 'complete' : 'queued',
      owner: planOwner.owner, harness: planOwner.harness,
      summary: rawPhase === 'remediation'
        ? `${blockerCount} blocking findings returned the workflow to planning.`
        : plan.approved === true
          ? 'The current plan is approved and preserved in workflow history.'
          : 'The current plan is awaiting explicit approval.',
    },
    {
      id: 'execute', label: 'Execute',
      status: execution.completed === true ? 'complete' : currentPhase === 'execute' ? 'active' : 'queued',
      owner: executeOwner.owner, harness: executeOwner.harness,
      summary: execution.completed === true
        ? 'Execution completed with an immutable checkpoint.'
        : execution.started === true
          ? 'Execution is in progress and has not been completed.'
          : 'Execution begins only after plan approval.',
    },
    {
      id: 'review', label: 'Review',
      status: blockerCount > 0 ? 'blocked' : review.completed === true ? 'complete' : currentPhase === 'review' ? 'active' : 'queued',
      owner: reviewOwner.owner, harness: reviewOwner.harness,
      summary: blockerCount > 0
        ? `${blockerCount} blocking findings require another workflow cycle.`
        : review.completed === true
          ? 'Review completed without open blocking findings.'
          : 'Independent review has not been completed.',
    },
    {
      id: 'ready', label: 'Deploy gate', status: deploymentReady ? 'ready' : 'queued',
      owner: 'Project maintainer', harness: 'Human',
      summary: deploymentReady
        ? 'Required validation and review evidence satisfy the readiness policy.'
        : 'Readiness remains withheld until policy requirements are satisfied.',
    },
  ]
  const currentLabel = phases.find((phase) => phase.id === currentPhase)?.label ?? 'Plan'
  const next = currentPhase === 'plan'
    ? 'Approve the plan, then claim execution in the selected harness.'
    : currentPhase === 'execute'
      ? 'Checkpoint implementation evidence and complete execution.'
      : currentPhase === 'review'
        ? 'Record findings and complete review without deploying.'
        : 'A maintainer may record deployment authorization; Phasewire will not deploy.'

  return {
    workflowId: stringValue(value, 'workflowId', 'workflow'),
    title: stringValue(value, 'title', 'Untitled workflow'),
    objective: `Persistent workflow state for ${stringValue(value, 'title', 'this project')}.`,
    currentPhase, cycleCount, updatedAt: lastEventAt, phases,
    narratives: {
      plan: { now: phases[0]?.summary ?? 'Planning state is unavailable.', why: `${eventCount} immutable events currently support this projection.`, next },
      execute: { now: phases[1]?.summary ?? 'Execution state is unavailable.', why: 'Execution evidence is checkpointed independently of the harness session.', next },
      review: { now: phases[2]?.summary ?? 'Review state is unavailable.', why: 'Blocking findings must return the workflow to a remediation plan.', next },
      ready: { now: phases[3]?.summary ?? 'Readiness state is unavailable.', why: 'Readiness and user deployment authorization are separate persisted states.', next },
    },
    cycles: Array.from({ length: Math.max(cycleCount, 1) }, (_, index) => {
      const cycleNumber = cycleCount - index
      return {
        number: cycleNumber,
        label: cycleNumber === cycleCount ? `${currentLabel} cycle` : 'Previous cycle',
        status: cycleNumber === cycleCount ? 'active' : 'complete',
        summary: cycleNumber === cycleCount
          ? `Current projection at logical clock ${numberValue(value, 'logicalClock', 0)}.`
          : 'Detailed history remains available in the immutable event log.',
      }
    }),
    decisions,
    annotations: arrayValue(value, 'annotations').flatMap((annotation) => isRecord(annotation) ? [{
      id: stringValue(annotation, 'id', stringValue(annotation, 'eventId', 'annotation')),
      author: 'Workflow participant', harness: 'Project state',
      body: stringValue(annotation, 'body', 'Empty annotation'), createdAt: lastEventAt,
    }] : []),
    findings, validations, artifacts,
    events: [{
      id: arrayValue(value, 'heads').find((head): head is string => typeof head === 'string') ?? 'projection',
      label: `${eventCount} immutable events replayed`,
      description: `Projection is at logical clock ${numberValue(value, 'logicalClock', 0)}.`,
      at: lastEventAt, phase: currentPhase,
      harness: phases.find((phase) => phase.id === currentPhase)?.harness ?? 'Unclaimed',
    }],
    executionChanges: artifacts.filter((artifact) => artifact.phase === 'execute').map((artifact) => ({
      path: artifact.path, summary: `${artifact.kind} evidence recorded in workflow history.`, status: 'changed' as const,
    })),
    issueResolution: {
      problem: blockerCount > 0 ? `${blockerCount} blocking review findings remain open.` : 'No blocking finding is open.',
      rootCause: 'Root-cause detail is not included in the current projection.',
      candidates: decisions.map((decision) => decision.title),
      selected: decisions.at(-1)?.options[0]?.label ?? 'No remediation decision has been recorded.',
      why: 'Decision rationale remains in the referenced workflow artifacts.',
      implementation: stringValue(execution, 'artifactPath', 'Execution artifact has not been recorded.'),
      validation: `${validations.filter((validation) => validation.status === 'passed').length} validations passed.`,
    },
    planApproved: currentPlanApproved,
    planApprovalAction: remediationPlanning ? 'approve-remediation' : 'approve-plan',
    deploymentReady,
    deploymentAuthorized: readiness.authorizationRecorded === true,
  }
}

export function adaptWorkflowProjection(value: unknown): WorkflowProjection | null {
  if (isWorkflowProjection(value)) return value
  const normalized = normalizeCoreProjection(value)
  if (normalized !== null) return normalized
  if (!isRecord(value)) return null
  for (const candidate of [value.workflow, value.projection, value.data]) {
    const workflow = isWorkflowProjection(candidate) ? candidate : normalizeCoreProjection(candidate)
    if (workflow !== null) return workflow
  }
  return null
}

export function workflowCollection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  return isRecord(value) && Array.isArray(value.workflows) ? value.workflows : []
}

export function workflowId(value: unknown): string | null {
  if (!isRecord(value)) return null
  if (typeof value.workflowId === 'string') return value.workflowId
  return typeof value.id === 'string' ? value.id : null
}
