import { canonicalJson } from './canonical.js'
import { PhasewireError } from './errors.js'
import type { EventInput, JsonObject, JsonValue, PhasewireConfig, WorkflowEvent } from './types.js'

export const PHASEWIRE_SCHEMA_VERSION = 1 as const
export const PHASEWIRE_DIRS = Object.freeze({
  root: '.phasewire', workflows: 'workflows', artifacts: 'artifacts', plans: 'artifacts/plans',
  decisions: 'artifacts/decisions', executions: 'artifacts/executions', reviews: 'artifacts/reviews',
  validations: 'artifacts/validations', handoffs: 'handoffs', templates: 'templates', runtime: '.runtime',
})
export const DEFAULT_VALIDATIONS = ['lint', 'typecheck', 'build', 'test'] as const
export const MAX_CLAIM_TTL_MS = 60 * 60 * 1000

export function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new PhasewireError(`${label} must be a portable identifier`, 'INVALID_IDENTIFIER')
  }
}

export function assertTimestamp(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new PhasewireError(`${label} must be a valid ISO timestamp`, 'INVALID_TIMESTAMP')
}

export function assertEventInput(input: EventInput): void {
  assertSafeIdentifier(input.workflowId, 'workflowId')
  if (input.idempotencyKey.trim().length === 0 || input.idempotencyKey.length > 256) {
    throw new PhasewireError('idempotencyKey is required and must not exceed 256 characters', 'INVALID_IDEMPOTENCY_KEY')
  }
  if (input.actor.id.trim().length === 0) throw new PhasewireError('actor.id is required', 'INVALID_ACTOR')
  if (input.occurredAt !== undefined) assertTimestamp(input.occurredAt, 'occurredAt')
}

export function jsonObject(value: Readonly<Record<string, JsonValue>>): JsonObject {
  return { ...value }
}

export function eventIntent(event: WorkflowEvent): string {
  return canonicalJson({
    workflowId: event.workflowId, type: event.type, phase: event.phase, actor: { ...event.actor },
    idempotencyKey: event.idempotencyKey, payload: event.payload,
  })
}

export function inputIntent(input: EventInput): string {
  return canonicalJson({
    workflowId: input.workflowId, type: input.type, phase: input.phase, actor: { ...input.actor },
    idempotencyKey: input.idempotencyKey, payload: input.payload,
  })
}

export function equalSets(left: readonly string[], right: readonly string[]): boolean {
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.length === sortedRight.length && sortedLeft.every((entry, index) => entry === sortedRight[index])
}

export function eventAsJson(event: WorkflowEvent): JsonObject {
  return {
    schemaVersion: event.schemaVersion, workflowId: event.workflowId, eventId: event.eventId,
    type: event.type, phase: event.phase, actor: { ...event.actor }, occurredAt: event.occurredAt,
    parents: [...event.parents], logicalClock: event.logicalClock, idempotencyKey: event.idempotencyKey,
    payload: event.payload, integrity: event.integrity,
  }
}

export function configAsJson(config: PhasewireConfig): JsonObject {
  return {
    schemaVersion: config.schemaVersion, projectId: config.projectId,
    defaultTemplateId: config.defaultTemplateId, requiredValidations: [...config.requiredValidations],
  }
}
