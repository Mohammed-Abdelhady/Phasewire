import type { JsonObject } from './json.js'

export const WORKFLOW_PHASES = ['plan', 'execute', 'review', 'remediation'] as const
export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number]

export const EVENT_TYPES = [
  'workflow.created',
  'workflow.reconciled',
  'plan.proposed',
  'plan.approved',
  'phase.claimed',
  'phase.released',
  'execution.started',
  'execution.checkpointed',
  'execution.completed',
  'review.started',
  'review.finding',
  'review.completed',
  'remediation.plan-proposed',
  'remediation.plan-approved',
  'remediation.started',
  'remediation.completed',
  'validation.recorded',
  'decision.recorded',
  'handoff.created',
  'annotation.recorded',
  'deployment.authorization-recorded',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export interface ActorIdentity {
  readonly id: string
  readonly kind: 'user' | 'harness' | 'system'
  readonly harness?: string
  readonly displayName?: string
}

export interface WorkflowEvent {
  readonly schemaVersion: 1
  readonly workflowId: string
  readonly eventId: string
  readonly type: EventType
  readonly phase: WorkflowPhase
  readonly actor: ActorIdentity
  readonly occurredAt: string
  readonly parents: readonly string[]
  readonly logicalClock: number
  readonly idempotencyKey: string
  readonly payload: JsonObject
  readonly integrity: `sha256:${string}`
}

export interface EventInput {
  readonly workflowId: string
  readonly type: EventType
  readonly phase: WorkflowPhase
  readonly actor: ActorIdentity
  readonly idempotencyKey: string
  readonly payload: JsonObject
  readonly occurredAt?: string
  readonly parents?: readonly string[]
  readonly logicalClock?: number
}

export interface EventEnvelopeInput extends EventInput {
  readonly occurredAt: string
  readonly parents: readonly string[]
  readonly logicalClock: number
}
