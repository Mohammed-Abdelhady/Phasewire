import { createHash, timingSafeEqual } from 'node:crypto'

import { IntegrityError } from './errors.js'
import type { ActorIdentity, EventEnvelopeInput, JsonObject, JsonValue, WorkflowEvent } from './types.js'

function isJsonArray(value: JsonValue): value is JsonValue[] {
  return Array.isArray(value)
}

function canonicalize(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not support non-finite numbers')
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value)
  }

  if (isJsonArray(value)) {
    return `[${value.map((entry) => canonicalize(entry)).join(',')}]`
  }

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(',')}}`
}

export function canonicalJson(value: JsonValue): string {
  return canonicalize(value)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function actorBody(actor: ActorIdentity): JsonObject {
  return {
    id: actor.id,
    kind: actor.kind,
    ...(actor.harness === undefined ? {} : { harness: actor.harness }),
    ...(actor.displayName === undefined ? {} : { displayName: actor.displayName }),
  }
}

function cloneAndFreeze(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value
  if (isJsonArray(value)) {
    const cloned = value.map((entry) => cloneAndFreeze(entry))
    Object.freeze(cloned)
    return cloned
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneAndFreeze(entry)]),
  ))
}

function eventBody(input: EventEnvelopeInput): JsonObject {
  return {
    schemaVersion: 1,
    workflowId: input.workflowId,
    type: input.type,
    phase: input.phase,
    actor: actorBody(input.actor),
    occurredAt: input.occurredAt,
    parents: [...input.parents].sort(),
    logicalClock: input.logicalClock,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
  }
}

export function createEventEnvelope(input: EventEnvelopeInput): WorkflowEvent {
  const body = eventBody(input)
  const eventId = `evt_${sha256(canonicalJson(body))}`
  const eventWithoutIntegrity: JsonValue = { ...body, eventId }
  const integrity = `sha256:${sha256(canonicalJson(eventWithoutIntegrity))}` as const

  const actor = Object.freeze({
    id: input.actor.id,
    kind: input.actor.kind,
    ...(input.actor.harness === undefined ? {} : { harness: input.actor.harness }),
    ...(input.actor.displayName === undefined ? {} : { displayName: input.actor.displayName }),
  })
  const payload = cloneAndFreeze(input.payload) as JsonObject
  return Object.freeze({
    schemaVersion: 1,
    workflowId: input.workflowId,
    eventId,
    type: input.type,
    phase: input.phase,
    actor,
    occurredAt: input.occurredAt,
    parents: Object.freeze([...input.parents].sort()),
    logicalClock: input.logicalClock,
    idempotencyKey: input.idempotencyKey,
    payload,
    integrity,
  })
}

export function computeEventIntegrity(event: Omit<WorkflowEvent, 'integrity'>): `sha256:${string}` {
  const value: JsonObject = {
    schemaVersion: event.schemaVersion,
    workflowId: event.workflowId,
    eventId: event.eventId,
    type: event.type,
    phase: event.phase,
    actor: actorBody(event.actor),
    occurredAt: event.occurredAt,
    parents: [...event.parents],
    logicalClock: event.logicalClock,
    idempotencyKey: event.idempotencyKey,
    payload: event.payload,
  }
  return `sha256:${sha256(canonicalJson(value))}`
}

export function verifyEventIntegrity(event: WorkflowEvent): boolean {
  const { integrity, ...withoutIntegrity } = event
  const expected = computeEventIntegrity(withoutIntegrity)
  const actualBuffer = Buffer.from(integrity)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function assertEventIntegrity(event: WorkflowEvent): void {
  if (!verifyEventIntegrity(event)) {
    throw new IntegrityError(`Integrity mismatch for event ${event.eventId}`)
  }

  const recreated = createEventEnvelope({
    workflowId: event.workflowId,
    type: event.type,
    phase: event.phase,
    actor: event.actor,
    occurredAt: event.occurredAt,
    parents: event.parents,
    logicalClock: event.logicalClock,
    idempotencyKey: event.idempotencyKey,
    payload: event.payload,
  })
  if (recreated.eventId !== event.eventId) {
    throw new IntegrityError(`Canonical event ID mismatch for event ${event.eventId}`)
  }
}
