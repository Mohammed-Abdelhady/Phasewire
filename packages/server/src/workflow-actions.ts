import type { ActorIdentity, EventType, WorkflowPhase } from '@phasewire/core'

import type { JsonValue } from './types.js'

export const EVENT_ACTIONS: Readonly<
  Record<string, { readonly phase: WorkflowPhase; readonly type: EventType }>
> = {
  annotation: { phase: 'review', type: 'annotation.recorded' },
  'approve-plan': { phase: 'plan', type: 'plan.approved' },
  'authorize-deployment': { phase: 'review', type: 'deployment.authorization-recorded' },
  checkpoint: { phase: 'execute', type: 'execution.checkpointed' },
  'start-execution': { phase: 'execute', type: 'execution.started' },
  'complete-execution': { phase: 'execute', type: 'execution.completed' },
  'complete-review': { phase: 'review', type: 'review.completed' },
  decision: { phase: 'review', type: 'decision.recorded' },
  finding: { phase: 'review', type: 'review.finding' },
  'complete-remediation': { phase: 'remediation', type: 'remediation.completed' },
  'approve-remediation': { phase: 'remediation', type: 'remediation.plan-approved' },
  'plan-remediation': { phase: 'remediation', type: 'remediation.plan-proposed' },
  'record-authorization': { phase: 'review', type: 'deployment.authorization-recorded' },
  'record-decision': { phase: 'review', type: 'decision.recorded' },
  'request-review': { phase: 'review', type: 'review.started' },
  'start-remediation': { phase: 'remediation', type: 'remediation.started' },
  'start-review': { phase: 'review', type: 'review.started' },
  validation: { phase: 'execute', type: 'validation.recorded' },
}

export const STRUCTURAL_EVENT_TYPES = new Set<string>([
  'workflow.created',
  'workflow.reconciled',
  'phase.claimed',
  'phase.released',
  'handoff.created',
])

export const toActor = (name: string): ActorIdentity =>
  name === 'user'
    ? { id: 'user', kind: 'user' }
    : name === 'phasewire'
      ? { id: 'phasewire', kind: 'system' }
      : { harness: name, id: name, kind: 'harness' }

export const phaseFromPayload = (
  payload: Readonly<Record<string, JsonValue>> | undefined,
): WorkflowPhase => {
  const phase = payload?.phase
  if (phase === 'plan' || phase === 'execute' || phase === 'review' || phase === 'remediation') {
    return phase
  }
  throw new Error('Action payload requires phase: plan, execute, review, or remediation')
}

export const phaseForEvent = (type: string): WorkflowPhase => {
  if (type.startsWith('plan.')) return 'plan'
  if (type.startsWith('execution.') || type === 'validation.recorded') return 'execute'
  if (
    type.startsWith('review.') ||
    type === 'decision.recorded' ||
    type === 'annotation.recorded' ||
    type === 'deployment.authorization-recorded'
  ) {
    return 'review'
  }
  if (type.startsWith('remediation.')) return 'remediation'
  return 'plan'
}
