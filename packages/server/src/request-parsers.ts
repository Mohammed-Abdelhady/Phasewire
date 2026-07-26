import { EVENT_TYPES, type ScaffoldVisualTemplateOptions, type VisualNodeKind } from '@phasewire/core'

import type { JsonValue, WorkflowActionInput, WorkflowEventInput } from './types.js'

export const actionNames = [
  'approve-plan',
  'claim',
  'release',
  'checkpoint',
  'start-execution',
  'complete-execution',
  'start-review',
  'request-review',
  'finding',
  'complete-review',
  'plan-remediation',
  'approve-remediation',
  'start-remediation',
  'complete-remediation',
  'validation',
  'decision',
  'record-decision',
  'annotation',
  'authorize-deployment',
  'record-authorization',
  'reconcile',
] as const

export const actionNameSet = new Set<string>(actionNames)
export const privilegedActions = new Set<string>([
  'approve-plan',
  'approve-remediation',
  'authorize-deployment',
  'record-authorization',
])
export const privilegedEventTypes = new Set<string>([
  'plan.approved',
  'remediation.plan-approved',
  'deployment.authorization-recorded',
])

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const eventTypeSet = new Set<string>(EVENT_TYPES)

export const asWorkflowEventInput = (value: unknown): WorkflowEventInput | undefined => {
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    !eventTypeSet.has(value.type) ||
    typeof value.actor !== 'string'
  ) {
    return undefined
  }
  if (value.payload !== undefined && !isRecord(value.payload)) return undefined
  if (value.idempotencyKey !== undefined && typeof value.idempotencyKey !== 'string') return undefined
  if (value.logicalClock !== undefined && typeof value.logicalClock !== 'number') return undefined
  if (value.occurredAt !== undefined && typeof value.occurredAt !== 'string') return undefined
  if (
    value.parents !== undefined &&
    (!Array.isArray(value.parents) || !value.parents.every((parent) => typeof parent === 'string'))
  ) {
    return undefined
  }
  if (
    value.phase !== undefined &&
    value.phase !== 'plan' &&
    value.phase !== 'execute' &&
    value.phase !== 'review' &&
    value.phase !== 'remediation'
  ) {
    return undefined
  }
  return {
    actor: value.actor,
    ...(typeof value.idempotencyKey === 'string' ? { idempotencyKey: value.idempotencyKey } : {}),
    ...(typeof value.logicalClock === 'number' ? { logicalClock: value.logicalClock } : {}),
    ...(typeof value.occurredAt === 'string' ? { occurredAt: value.occurredAt } : {}),
    ...(Array.isArray(value.parents) ? { parents: value.parents } : {}),
    ...(isRecord(value.payload)
      ? { payload: value.payload as Readonly<Record<string, JsonValue>> }
      : {}),
    ...(value.phase === 'plan' ||
    value.phase === 'execute' ||
    value.phase === 'review' ||
    value.phase === 'remediation'
      ? { phase: value.phase }
      : {}),
    type: value.type,
  }
}

export const asActionInput = (value: unknown): WorkflowActionInput | undefined => {
  if (value === undefined) return {}
  if (!isRecord(value)) return undefined
  if (value.actor !== undefined && typeof value.actor !== 'string') return undefined
  if (value.idempotencyKey !== undefined && typeof value.idempotencyKey !== 'string') return undefined
  if (value.payload !== undefined && !isRecord(value.payload)) return undefined
  return {
    ...(typeof value.actor === 'string' ? { actor: value.actor } : {}),
    ...(typeof value.idempotencyKey === 'string' ? { idempotencyKey: value.idempotencyKey } : {}),
    ...(isRecord(value.payload)
      ? { payload: value.payload as Readonly<Record<string, JsonValue>> }
      : {}),
  }
}

const nodeKinds = new Set<VisualNodeKind>([
  'section',
  'stack',
  'grid',
  'text',
  'metric',
  'list',
  'timeline',
  'evidence',
  'action',
])

export const asTemplateScaffoldInput = (
  value: unknown,
): ScaffoldVisualTemplateOptions | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.primaryBinding !== 'string'
  ) {
    return undefined
  }
  if (value.version !== undefined && typeof value.version !== 'string') return undefined
  if (
    value.primaryKind !== undefined &&
    (typeof value.primaryKind !== 'string' || !nodeKinds.has(value.primaryKind as VisualNodeKind))
  ) {
    return undefined
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    primaryBinding: value.primaryBinding,
    ...(typeof value.version === 'string' ? { version: value.version } : {}),
    ...(typeof value.primaryKind === 'string'
      ? { primaryKind: value.primaryKind as VisualNodeKind }
      : {}),
  }
}

export const hasRequiredAcknowledgement = (
  action: string,
  input: WorkflowActionInput,
): boolean => {
  if (action === 'approve-plan' || action === 'approve-remediation') {
    return input.payload?.acknowledgedMaterialDecisions === true
  }
  return input.payload?.acknowledgedReadiness === true
}
