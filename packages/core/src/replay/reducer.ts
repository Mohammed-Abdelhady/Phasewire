import { ReplayError } from '../errors.js'
import type { PhaseClaim, WorkflowEvent, WorkflowProjection } from '../types.js'
import { deriveReadiness } from './readiness.js'
import {
  annotationFrom, appendArtifact, artifactFrom, claimFrom, decisionFrom, findingFrom,
  stringList, stringValue, validationFrom,
} from './values.js'

function sameActor(left: WorkflowEvent['actor'], right: WorkflowEvent['actor']): boolean {
  return left.id === right.id && left.kind === right.kind && left.harness === right.harness
}

function interruptExpiredClaim(claim: PhaseClaim, event: WorkflowEvent): PhaseClaim {
  return {
    ...claim,
    interruptedAt: event.occurredAt,
    interruptedByEventId: event.eventId,
  }
}

function enforceClaim(projection: WorkflowProjection, event: WorkflowEvent): WorkflowProjection {
  const claim = projection.claims[event.phase]
  if (claim === undefined || claim.releasedByEventId !== undefined || claim.interruptedAt !== undefined) return projection
  if (event.type === 'phase.claimed') {
    if (Date.parse(claim.leaseExpiresAt) > Date.parse(event.occurredAt)) {
      throw new ReplayError(`Phase ${event.phase} already has an active claim`)
    }
    return { ...projection, claims: { ...projection.claims, [event.phase]: interruptExpiredClaim(claim, event) } }
  }
  if (Date.parse(claim.leaseExpiresAt) <= Date.parse(event.occurredAt)) {
    return { ...projection, claims: { ...projection.claims, [event.phase]: interruptExpiredClaim(claim, event) } }
  }
  if (!sameActor(claim.owner, event.actor)) {
    throw new ReplayError(`Mutation of phase ${event.phase} requires ownership of claim ${claim.claimId}`)
  }
  return projection
}

function baseUpdate(projection: WorkflowProjection, event: WorkflowEvent): WorkflowProjection {
  return {
    ...projection,
    eventCount: projection.eventCount + 1,
    lastEventAt: event.occurredAt,
    logicalClock: Math.max(projection.logicalClock, event.logicalClock),
    heads: [event.eventId],
  }
}

export function initialProjection(event: WorkflowEvent): WorkflowProjection {
  if (event.type !== 'workflow.created') throw new ReplayError('The root event must be workflow.created')
  const title = stringValue(event.payload, 'title')
  if (title === undefined || title.length === 0) throw new ReplayError('workflow.created requires payload.title')
  const requiredValidations = [...new Set(stringList(event.payload, 'requiredValidations'))].sort()
  return deriveReadiness({
    schemaVersion: 1,
    workflowId: event.workflowId,
    title,
    templateId: stringValue(event.payload, 'templateId') ?? 'phasewire.default',
    status: 'planning',
    currentPhase: 'plan',
    cycle: 0,
    eventCount: 1,
    lastEventAt: event.occurredAt,
    logicalClock: event.logicalClock,
    heads: [event.eventId],
    conflicted: false,
    readOnly: false,
    plan: { proposed: false, approved: false },
    execution: { started: false, completed: false },
    review: { started: false, completed: false, findings: [] },
    remediation: { proposed: false, approved: false, started: false, completed: false, findingIds: [] },
    validations: [], decisions: [], annotations: [], artifacts: [], claims: {},
    deploymentReadiness: {
      ready: false, blockerCodes: [], requiredValidations, passedValidations: [], authorizationRecorded: false,
    },
  })
}

function applyPlanAndExecution(next: WorkflowProjection, event: WorkflowEvent): WorkflowProjection | undefined {
  if (event.type === 'plan.proposed') {
    if (next.currentPhase === 'remediation' || next.review.findings.some((finding) =>
      finding.severity === 'blocking' && finding.resolvedByEventId === undefined)) {
      throw new ReplayError('Open blocking findings require the dedicated remediation planning cycle')
    }
    const artifact = artifactFrom(event, 'plan')
    return {
      ...next, currentPhase: 'plan',
      plan: { proposed: true, approved: false, ...(artifact === undefined ? {} : { artifactPath: artifact.path }) },
      execution: { started: false, completed: false },
      review: { started: false, completed: false, findings: [] },
      remediation: { proposed: false, approved: false, started: false, completed: false, findingIds: [] },
      validations: [],
      artifacts: appendArtifact(next.artifacts, artifact),
    }
  }
  if (event.type === 'plan.approved') {
    if (!next.plan.proposed) throw new ReplayError('A plan must be proposed before it can be approved')
    if (event.actor.kind !== 'user') throw new ReplayError('Plan approval must be recorded by a user actor')
    return { ...next, currentPhase: 'execute', plan: { ...next.plan, approved: true, approvedByEventId: event.eventId } }
  }
  if (event.type === 'execution.started') {
    if (!next.plan.approved) throw new ReplayError('Execution cannot start before plan approval')
    return {
      ...next, currentPhase: 'execute', execution: { started: true, completed: false },
      review: { started: false, completed: false, findings: next.review.findings },
      remediation: { proposed: false, approved: false, started: false, completed: false, findingIds: [] }, validations: [],
    }
  }
  if (event.type === 'execution.checkpointed') {
    if (!next.execution.started || next.execution.completed) throw new ReplayError('An active execution is required before a checkpoint')
    return { ...next, artifacts: appendArtifact(next.artifacts, artifactFrom(event, 'execution')) }
  }
  if (event.type === 'execution.completed') {
    if (!next.execution.started || next.execution.completed) throw new ReplayError('An active execution is required before completion')
    const artifact = artifactFrom(event, 'execution')
    return {
      ...next, currentPhase: 'review',
      execution: {
        started: true, completed: true, completedByEventId: event.eventId,
        ...(artifact === undefined ? {} : { artifactPath: artifact.path }),
      },
      artifacts: appendArtifact(next.artifacts, artifact),
    }
  }
  return undefined
}

function applyReview(next: WorkflowProjection, event: WorkflowEvent): WorkflowProjection | undefined {
  if (event.type === 'review.started') {
    if (!next.execution.completed) throw new ReplayError('Review cannot start before execution completion')
    if (next.review.started && !next.review.completed) throw new ReplayError('Review is already active')
    return { ...next, currentPhase: 'review', review: { ...next.review, started: true, completed: false } }
  }
  if (event.type === 'review.finding') {
    if (!next.review.started || next.review.completed) throw new ReplayError('An active review is required before recording a finding')
    const finding = findingFrom(event)
    if (next.review.findings.some((entry) => entry.id === finding.id && entry.resolvedByEventId === undefined)) {
      throw new ReplayError(`Finding ${finding.id} is already open`)
    }
    return { ...next, review: { ...next.review, findings: [...next.review.findings, finding] } }
  }
  if (event.type === 'review.completed') {
    if (!next.review.started || next.review.completed) throw new ReplayError('An active review is required before completion')
    const artifact = artifactFrom(event, 'review')
    const hasBlockers = next.review.findings.some((finding) =>
      finding.severity === 'blocking' && finding.resolvedByEventId === undefined)
    return {
      ...next,
      currentPhase: hasBlockers ? 'remediation' : 'review',
      review: { ...next.review, completed: true, completedByEventId: event.eventId },
      remediation: hasBlockers
        ? { proposed: false, approved: false, started: false, completed: false, findingIds: [] }
        : next.remediation,
      artifacts: appendArtifact(next.artifacts, artifact),
    }
  }
  return undefined
}

function applyRemediation(next: WorkflowProjection, event: WorkflowEvent): WorkflowProjection | undefined {
  const openIds = next.review.findings
    .filter((finding) => finding.severity === 'blocking' && finding.resolvedByEventId === undefined)
    .map((finding) => finding.id).sort()
  if (event.type === 'remediation.plan-proposed') {
    if (next.currentPhase !== 'remediation' || !next.review.completed || openIds.length === 0) {
      throw new ReplayError('A remediation plan can be proposed only after a completed review with blocking findings')
    }
    if (next.remediation.proposed && !next.remediation.completed) throw new ReplayError('A remediation plan is already active')
    const artifact = artifactFrom(event, 'plan')
    return {
      ...next,
      cycle: next.cycle + 1,
      execution: { started: false, completed: false },
      review: { started: false, completed: false, findings: next.review.findings },
      remediation: {
        proposed: true, approved: false, started: false, completed: false,
        findingIds: openIds, proposedByEventId: event.eventId,
        ...(artifact === undefined ? {} : { artifactPath: artifact.path }),
      },
      validations: [],
      artifacts: appendArtifact(next.artifacts, artifact),
    }
  }
  if (event.type === 'remediation.plan-approved') {
    if (!next.remediation.proposed || next.remediation.started || next.remediation.completed) {
      throw new ReplayError('An unstarted remediation plan must exist before approval')
    }
    if (event.actor.kind !== 'user') throw new ReplayError('Remediation plan approval must be recorded by a user actor')
    return {
      ...next,
      remediation: { ...next.remediation, approved: true, approvedByEventId: event.eventId },
    }
  }
  if (event.type === 'remediation.started') {
    if (next.currentPhase !== 'remediation' || !next.remediation.proposed || !next.remediation.approved ||
      openIds.length === 0) {
      throw new ReplayError('Remediation can start only after explicit approval of its plan')
    }
    if (next.remediation.started && !next.remediation.completed) throw new ReplayError('Remediation is already active')
    return {
      ...next,
      execution: { started: true, completed: false },
      review: { started: false, completed: false, findings: next.review.findings },
      remediation: { ...next.remediation, started: true, completed: false, startedByEventId: event.eventId },
      validations: [],
    }
  }
  if (event.type === 'remediation.completed') {
    if (next.currentPhase !== 'remediation' || !next.remediation.started || next.remediation.completed) {
      throw new ReplayError('remediation.completed requires an active remediation cycle')
    }
    const resolvedIds = stringList(event.payload, 'resolvedFindingIds')
    if (new Set(resolvedIds).size !== resolvedIds.length ||
      resolvedIds.length !== openIds.length || ![...resolvedIds].sort().every((id, index) => id === openIds[index])) {
      throw new ReplayError('remediation.completed must resolve exactly every open blocking finding ID')
    }
    const artifact = artifactFrom(event, 'execution')
    return {
      ...next, currentPhase: 'review',
      execution: {
        started: true, completed: true, completedByEventId: event.eventId,
        ...(artifact === undefined ? {} : { artifactPath: artifact.path }),
      },
      review: {
        ...next.review, started: false, completed: false,
        findings: next.review.findings.map((finding) =>
          resolvedIds.includes(finding.id) && finding.resolvedByEventId === undefined
            ? { ...finding, resolvedByEventId: event.eventId } : finding),
      },
      remediation: { ...next.remediation, completed: true, completedByEventId: event.eventId },
      artifacts: appendArtifact(next.artifacts, artifact),
    }
  }
  return undefined
}

export function reduceWorkflow(projection: WorkflowProjection, event: WorkflowEvent): WorkflowProjection {
  if (projection.workflowId !== event.workflowId) throw new ReplayError(`Event ${event.eventId} belongs to a different workflow`)
  if (event.type === 'workflow.created') throw new ReplayError('A workflow may contain only one workflow.created event')
  if ((event.type === 'decision.recorded' || event.type === 'annotation.recorded') &&
    event.phase !== projection.currentPhase) {
    throw new ReplayError(`${event.type} must be recorded against the current phase ${projection.currentPhase}`)
  }
  let next = baseUpdate(enforceClaim(projection, event), event)
  if (projection.deploymentReadiness.authorizationRecorded && event.type !== 'deployment.authorization-recorded') {
    next = {
      ...next,
      deploymentReadiness: { ...next.deploymentReadiness, authorizationRecorded: false },
    }
  }
  const phaseResult = applyPlanAndExecution(next, event) ?? applyReview(next, event) ?? applyRemediation(next, event)
  if (phaseResult !== undefined) return deriveReadiness(phaseResult)

  if (event.type === 'phase.claimed') {
    if (event.phase !== next.currentPhase) throw new ReplayError(`Only the current phase ${next.currentPhase} can be claimed`)
    next = { ...next, claims: { ...next.claims, [event.phase]: claimFrom(event) } }
  } else if (event.type === 'phase.released') {
    const existing = next.claims[event.phase]
    const claimId = stringValue(event.payload, 'claimId')
    if (existing === undefined || claimId !== existing.claimId) throw new ReplayError(`No matching claim exists for phase ${event.phase}`)
    if (!sameActor(existing.owner, event.actor)) throw new ReplayError(`Only claim owner ${existing.owner.id} can release ${claimId}`)
    next = { ...next, claims: { ...next.claims, [event.phase]: { ...existing, releasedByEventId: event.eventId } } }
  } else if (event.type === 'validation.recorded') {
    const validation = validationFrom(event)
    next = {
      ...next,
      validations: [...next.validations.filter((entry) => entry.check !== validation.check), validation],
      artifacts: appendArtifact(next.artifacts, artifactFrom(event, 'validation')),
    }
  } else if (event.type === 'decision.recorded') {
    const decision = decisionFrom(event)
    next = {
      ...next,
      decisions: [...next.decisions.filter((entry) => entry.id !== decision.id), decision],
      artifacts: appendArtifact(next.artifacts, artifactFrom(event, 'decision')),
    }
  } else if (event.type === 'annotation.recorded') {
    next = { ...next, annotations: [...next.annotations, annotationFrom(event)] }
  } else if (event.type === 'deployment.authorization-recorded') {
    if (event.actor.kind !== 'user') throw new ReplayError('Deployment authorization must be recorded by a user actor')
    if (!projection.deploymentReadiness.ready) throw new ReplayError('Deployment authorization requires deployment readiness')
    next = { ...next, deploymentReadiness: { ...next.deploymentReadiness, authorizationRecorded: true } }
  }
  return deriveReadiness(next)
}
