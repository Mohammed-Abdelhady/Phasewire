import { posix, win32 } from 'node:path'

import { ReplayError } from '../errors.js'
import type {
  AnnotationRecord, ArtifactReference, DecisionRecord, JsonObject, PhaseClaim,
  ReviewFinding, ValidationResult, WorkflowEvent,
} from '../types.js'

export function stringValue(payload: JsonObject, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

export function stringList(payload: JsonObject, key: string): readonly string[] {
  const value = payload[key]
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function safeArtifactPath(event: WorkflowEvent): string | undefined {
  const path = stringValue(event.payload, 'artifactPath')
  if (path === undefined) return undefined
  const hasUnsafeControl = [...path].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code < 32 || (code >= 127 && code <= 159) || code === 0x61c || code === 0x200e ||
      code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
  })
  if (path.trim().length === 0 || posix.isAbsolute(path) || win32.parse(path).root !== '' ||
    path.split(/[\\/]/u).includes('..') || hasUnsafeControl) {
    throw new ReplayError(`${event.type} payload.artifactPath must be project-relative`)
  }
  return path
}

export function artifactFrom(event: WorkflowEvent, kind: ArtifactReference['kind']): ArtifactReference | undefined {
  const path = safeArtifactPath(event)
  if (path === undefined) return undefined
  const digest = stringValue(event.payload, 'artifactDigest')
  return { kind, path, eventId: event.eventId, ...(digest === undefined ? {} : { digest }) }
}

export function appendArtifact(
  artifacts: readonly ArtifactReference[], artifact: ArtifactReference | undefined,
): readonly ArtifactReference[] {
  return artifact === undefined ? artifacts : [...artifacts, artifact]
}

export function findingFrom(event: WorkflowEvent): ReviewFinding {
  const id = stringValue(event.payload, 'findingId') ?? event.eventId
  const severityValue = stringValue(event.payload, 'severity')
  const severity = severityValue === 'warning' || severityValue === 'info' || severityValue === 'blocking'
    ? severityValue : 'blocking'
  const title = stringValue(event.payload, 'title')
  if (title === undefined || title.length === 0) throw new ReplayError('review.finding requires payload.title')
  const detail = stringValue(event.payload, 'detail')
  const artifactPath = safeArtifactPath(event)
  return {
    id, severity, title, openedByEventId: event.eventId,
    ...(detail === undefined ? {} : { detail }),
    ...(artifactPath === undefined ? {} : { artifactPath }),
  }
}

export function validationFrom(event: WorkflowEvent): ValidationResult {
  const check = stringValue(event.payload, 'check')
  const status = stringValue(event.payload, 'status')
  if (check === undefined || check.length === 0) throw new ReplayError('validation.recorded requires payload.check')
  if (status !== 'passed' && status !== 'failed' && status !== 'skipped') {
    throw new ReplayError('validation.recorded requires a passed, failed, or skipped payload.status')
  }
  const summary = stringValue(event.payload, 'summary')
  const artifactPath = safeArtifactPath(event)
  return {
    check, status, eventId: event.eventId, logicalClock: event.logicalClock,
    ...(summary === undefined ? {} : { summary }),
    ...(artifactPath === undefined ? {} : { artifactPath }),
  }
}

export function claimFrom(event: WorkflowEvent): PhaseClaim {
  const claimId = stringValue(event.payload, 'claimId')
  const leaseExpiresAt = stringValue(event.payload, 'leaseExpiresAt')
  if (claimId === undefined || leaseExpiresAt === undefined || !Number.isFinite(Date.parse(leaseExpiresAt))) {
    throw new ReplayError('phase.claimed requires payload.claimId and a valid payload.leaseExpiresAt')
  }
  if (Date.parse(leaseExpiresAt) <= Date.parse(event.occurredAt)) {
    throw new ReplayError('phase.claimed lease must expire after the claim timestamp')
  }
  return { phase: event.phase, owner: event.actor, claimId, claimedAt: event.occurredAt, leaseExpiresAt, eventId: event.eventId }
}

export function decisionFrom(event: WorkflowEvent): DecisionRecord {
  const title = stringValue(event.payload, 'title')
  const outcome = stringValue(event.payload, 'outcome')
  if (title === undefined || outcome === undefined) {
    throw new ReplayError('decision.recorded requires payload.title and payload.outcome')
  }
  const artifactPath = safeArtifactPath(event)
  return {
    id: stringValue(event.payload, 'decisionId') ?? event.eventId, title, outcome, eventId: event.eventId,
    ...(artifactPath === undefined ? {} : { artifactPath }),
  }
}

export function annotationFrom(event: WorkflowEvent): AnnotationRecord {
  const body = stringValue(event.payload, 'body')
  if (body === undefined) throw new ReplayError('annotation.recorded requires payload.body')
  const target = stringValue(event.payload, 'target')
  return {
    id: stringValue(event.payload, 'annotationId') ?? event.eventId, body, eventId: event.eventId,
    ...(target === undefined ? {} : { target }),
  }
}
