import { canonicalJson, sha256 } from './canonical.js'
import { PhasewireError } from './errors.js'
import { readJson, writeJsonImmutable } from './files.js'
import type { CreateHandoffOptions, HandoffPacket, JsonObject, WorkflowProjection } from './types.js'

const STATUSES = new Set(['planning', 'executing', 'reviewing', 'remediating', 'deployment-ready', 'conflicted'])
const PHASES = new Set(['plan', 'execute', 'review', 'remediation'])
const KEYS = new Set([
  'schemaVersion', 'handoffId', 'workflowId', 'createdAt', 'createdBy', 'intendedFor', 'note', 'heads',
  'logicalClock', 'status', 'currentPhase', 'cycle', 'readOnly', 'artifactPaths', 'openBlockingFindingIds',
  'requiredValidations', 'passedValidations', 'integrity',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toJsonObject(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function isUniqueStrings(value: unknown, nonEmpty = false): value is readonly string[] {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) &&
    value.every((entry) => typeof entry === 'string') && new Set(value).size === value.length
}

function validActor(value: unknown): boolean {
  if (!isObject(value) || !Object.keys(value).every((key) => ['id', 'kind', 'harness', 'displayName'].includes(key))) return false
  return typeof value.id === 'string' && value.id.length > 0 &&
    (value.kind === 'user' || value.kind === 'harness' || value.kind === 'system') &&
    (value.harness === undefined || typeof value.harness === 'string') &&
    (value.displayName === undefined || typeof value.displayName === 'string')
}

export function handoffBody(packet: Omit<HandoffPacket, 'integrity'>): JsonObject {
  return {
    schemaVersion: packet.schemaVersion,
    handoffId: packet.handoffId,
    workflowId: packet.workflowId,
    createdAt: packet.createdAt,
    createdBy: { ...packet.createdBy },
    ...(packet.intendedFor === undefined ? {} : { intendedFor: packet.intendedFor }),
    ...(packet.note === undefined ? {} : { note: packet.note }),
    heads: [...packet.heads], logicalClock: packet.logicalClock, status: packet.status,
    currentPhase: packet.currentPhase, cycle: packet.cycle, readOnly: packet.readOnly,
    artifactPaths: [...packet.artifactPaths],
    openBlockingFindingIds: [...packet.openBlockingFindingIds],
    requiredValidations: [...packet.requiredValidations], passedValidations: [...packet.passedValidations],
  }
}

export function handoffAsJson(packet: HandoffPacket): JsonObject {
  return { ...handoffBody(packet), integrity: packet.integrity }
}

export function validateHandoffPacket(value: unknown): readonly string[] {
  const errors: string[] = []
  if (!isObject(value)) return ['handoff must be an object']
  for (const key of Object.keys(value)) if (!KEYS.has(key)) errors.push(`handoff.${key} is not allowed`)
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (typeof value.handoffId !== 'string' || !/^handoff_[a-f0-9]{64}$/.test(value.handoffId)) errors.push('handoffId is invalid')
  if (typeof value.workflowId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.workflowId)) errors.push('workflowId is invalid')
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) errors.push('createdAt is invalid')
  if (!validActor(value.createdBy)) errors.push('createdBy is invalid')
  if (value.intendedFor !== undefined && typeof value.intendedFor !== 'string') errors.push('intendedFor is invalid')
  if (value.note !== undefined && typeof value.note !== 'string') errors.push('note is invalid')
  if (!isUniqueStrings(value.heads, true) || value.heads.some((id) => !/^evt_[a-f0-9]{64}$/.test(id))) errors.push('heads is invalid')
  if (!Number.isSafeInteger(value.logicalClock) || Number(value.logicalClock) < 0) errors.push('logicalClock is invalid')
  if (typeof value.status !== 'string' || !STATUSES.has(value.status)) errors.push('status is invalid')
  if (typeof value.currentPhase !== 'string' || !PHASES.has(value.currentPhase)) errors.push('currentPhase is invalid')
  if (!Number.isSafeInteger(value.cycle) || Number(value.cycle) < 0) errors.push('cycle is invalid')
  if (typeof value.readOnly !== 'boolean') errors.push('readOnly is invalid')
  for (const field of ['artifactPaths', 'openBlockingFindingIds', 'requiredValidations', 'passedValidations'] as const) {
    if (!isUniqueStrings(value[field])) errors.push(`${field} must contain unique strings`)
  }
  if (typeof value.integrity !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.integrity)) errors.push('integrity is invalid')
  return errors
}

export function verifyHandoffIntegrity(packet: HandoffPacket): boolean {
  const idBody: JsonObject = Object.fromEntries(Object.entries(handoffBody(packet)).filter(([key]) => key !== 'handoffId'))
  const actualId = `handoff_${sha256(canonicalJson(idBody))}`
  const expectedIntegrity = `sha256:${sha256(canonicalJson(handoffBody(packet)))}`
  return packet.handoffId === actualId && packet.integrity === expectedIntegrity
}

export function assertHandoffPacket(value: unknown): asserts value is HandoffPacket {
  const errors = validateHandoffPacket(value)
  if (errors.length > 0) throw new PhasewireError(`Invalid handoff packet: ${errors.join('; ')}`, 'INVALID_HANDOFF')
  const packet = value as HandoffPacket
  if (!verifyHandoffIntegrity(packet)) throw new PhasewireError('Handoff integrity mismatch', 'HANDOFF_INTEGRITY_ERROR')
}

export function createHandoffPacket(projection: WorkflowProjection, options: CreateHandoffOptions): HandoffPacket {
  const createdAt = options.createdAt ?? new Date().toISOString()
  if (!Number.isFinite(Date.parse(createdAt))) throw new PhasewireError('createdAt must be a valid ISO timestamp', 'INVALID_TIMESTAMP')
  const packetBase = {
    schemaVersion: 1 as const,
    workflowId: projection.workflowId,
    createdAt,
    createdBy: options.createdBy,
    ...(options.intendedFor === undefined ? {} : { intendedFor: options.intendedFor }),
    ...(options.note === undefined ? {} : { note: options.note }),
    heads: [...projection.heads], logicalClock: projection.logicalClock, status: projection.status,
    currentPhase: projection.currentPhase, cycle: projection.cycle, readOnly: projection.readOnly,
    artifactPaths: [...new Set(projection.artifacts.map((artifact) => artifact.path))].sort(),
    openBlockingFindingIds: projection.review.findings
      .filter((finding) => finding.severity === 'blocking' && finding.resolvedByEventId === undefined)
      .map((finding) => finding.id).sort(),
    requiredValidations: [...projection.deploymentReadiness.requiredValidations],
    passedValidations: [...projection.deploymentReadiness.passedValidations],
  }
  const idBody = toJsonObject(packetBase)
  const handoffId = `handoff_${sha256(canonicalJson(idBody))}`
  const withId = { ...packetBase, handoffId }
  const integrity = `sha256:${sha256(canonicalJson(toJsonObject(withId)))}` as const
  return { ...withId, integrity }
}

export async function readHandoffPacket(path: string, trustedRoot: string): Promise<HandoffPacket> {
  const value = await readJson(path, trustedRoot)
  assertHandoffPacket(value)
  return value
}

export async function writeHandoffPacketAtomic(path: string, packet: HandoffPacket, trustedRoot: string): Promise<void> {
  assertHandoffPacket(packet)
  await writeJsonImmutable(path, handoffAsJson(packet), trustedRoot)
}
