import { ReplayError } from '../errors.js'
import { EVENT_TYPES, WORKFLOW_PHASES } from '../types.js'
import type { ActorIdentity, JsonValue, WorkflowEvent } from '../types.js'

const EVENT_TYPE_SET = new Set<string>(EVENT_TYPES)
const PHASE_SET = new Set<string>(WORKFLOW_PHASES)

function typeMatchesPhase(type: string, phase: string): boolean {
  if (type === 'workflow.created') return phase === 'plan'
  if (type.startsWith('plan.')) return phase === 'plan'
  if (type.startsWith('execution.')) return phase === 'execute'
  if (type.startsWith('review.')) return phase === 'review'
  if (type.startsWith('remediation.')) return phase === 'remediation'
  if (type === 'validation.recorded') return phase === 'execute'
  if (type === 'deployment.authorization-recorded') return phase === 'review'
  return true
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isActor(value: unknown): value is ActorIdentity {
  if (!isObject(value)) return false
  const keys = Object.keys(value)
  return keys.every((key) => ['id', 'kind', 'harness', 'displayName'].includes(key)) &&
    typeof value.id === 'string' && value.id.length > 0 &&
    (value.kind === 'user' || value.kind === 'harness' || value.kind === 'system') &&
    (value.harness === undefined || (typeof value.harness === 'string' && value.harness.length > 0)) &&
    (value.displayName === undefined || (typeof value.displayName === 'string' && value.displayName.length > 0))
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry))
  return isObject(value) && Object.values(value).every((entry) => isJsonValue(entry))
}

export function assertWorkflowEvent(value: unknown, source = 'event'): asserts value is WorkflowEvent {
  if (!isObject(value)) throw new ReplayError(`${source} is not an object`)
  if (value.schemaVersion !== 1) throw new ReplayError(`${source} has an unsupported schemaVersion`)
  if (typeof value.workflowId !== 'string' || value.workflowId.length === 0) {
    throw new ReplayError(`${source} has an invalid workflowId`)
  }
  if (typeof value.eventId !== 'string' || !/^evt_[a-f0-9]{64}$/.test(value.eventId)) {
    throw new ReplayError(`${source} has an invalid eventId`)
  }
  if (typeof value.type !== 'string' || !EVENT_TYPE_SET.has(value.type)) {
    throw new ReplayError(`${source} has an invalid event type`)
  }
  if (typeof value.phase !== 'string' || !PHASE_SET.has(value.phase)) {
    throw new ReplayError(`${source} has an invalid phase`)
  }
  if (!typeMatchesPhase(value.type, value.phase)) {
    throw new ReplayError(`${source} type ${value.type} is incompatible with phase ${value.phase}`)
  }
  if (!isActor(value.actor)) throw new ReplayError(`${source} has an invalid actor`)
  if (typeof value.occurredAt !== 'string' || !Number.isFinite(Date.parse(value.occurredAt))) {
    throw new ReplayError(`${source} has an invalid occurredAt timestamp`)
  }
  if (!Array.isArray(value.parents) || !value.parents.every((parent) => typeof parent === 'string')) {
    throw new ReplayError(`${source} has invalid parents`)
  }
  if (!Number.isSafeInteger(value.logicalClock) || Number(value.logicalClock) < 0) {
    throw new ReplayError(`${source} has an invalid logicalClock`)
  }
  if (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.length === 0 || value.idempotencyKey.length > 256) {
    throw new ReplayError(`${source} has an invalid idempotencyKey`)
  }
  if (!isJsonValue(value.payload) || !isObject(value.payload)) {
    throw new ReplayError(`${source} has an invalid payload`)
  }
  if (typeof value.integrity !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.integrity)) {
    throw new ReplayError(`${source} has an invalid integrity digest`)
  }
}
