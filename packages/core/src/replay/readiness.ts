import type { ValidationResult, WorkflowPhase, WorkflowProjection, WorkflowStatus } from '../types.js'

export function statusForPhase(phase: WorkflowPhase): WorkflowStatus {
  if (phase === 'plan') return 'planning'
  if (phase === 'execute') return 'executing'
  if (phase === 'review') return 'reviewing'
  return 'remediating'
}

export function deriveReadiness(projection: WorkflowProjection): WorkflowProjection {
  const blockers: string[] = []
  if (!projection.plan.approved) blockers.push('PLAN_NOT_APPROVED')
  if (!projection.execution.completed) blockers.push('EXECUTION_NOT_COMPLETED')
  if (!projection.review.completed) blockers.push('REVIEW_NOT_COMPLETED')
  if (projection.remediation.started && !projection.remediation.completed) blockers.push('REMEDIATION_NOT_COMPLETED')
  if (projection.review.findings.some((finding) =>
    finding.severity === 'blocking' && finding.resolvedByEventId === undefined)) {
    blockers.push('OPEN_BLOCKING_FINDINGS')
  }

  const latestByCheck = new Map<string, ValidationResult>()
  for (const validation of projection.validations) latestByCheck.set(validation.check, validation)
  const passedValidations = [...latestByCheck.values()]
    .filter((validation) => validation.status === 'passed')
    .map((validation) => validation.check)
    .sort()
  for (const required of projection.deploymentReadiness.requiredValidations) {
    if (latestByCheck.get(required)?.status !== 'passed') blockers.push(`VALIDATION_REQUIRED:${required}`)
  }
  if (projection.conflicted) blockers.push('WORKFLOW_CONFLICT')

  const ready = blockers.length === 0
  return {
    ...projection,
    status: projection.conflicted ? 'conflicted' : ready ? 'deployment-ready' : statusForPhase(projection.currentPhase),
    deploymentReadiness: {
      ...projection.deploymentReadiness,
      ready,
      blockerCodes: blockers,
      passedValidations,
      authorizationRecorded: ready && projection.deploymentReadiness.authorizationRecorded,
    },
  }
}
