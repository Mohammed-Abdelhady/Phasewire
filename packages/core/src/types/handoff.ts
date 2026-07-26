import type { ActorIdentity } from './events.js'
import type { WorkflowPhase } from './events.js'
import type { WorkflowStatus } from './workflow.js'

export interface HandoffPacket {
  readonly schemaVersion: 1
  readonly handoffId: string
  readonly workflowId: string
  readonly createdAt: string
  readonly createdBy: ActorIdentity
  readonly intendedFor?: string
  readonly note?: string
  readonly heads: readonly string[]
  readonly logicalClock: number
  readonly status: WorkflowStatus
  readonly currentPhase: WorkflowPhase
  readonly cycle: number
  readonly readOnly: boolean
  readonly artifactPaths: readonly string[]
  readonly openBlockingFindingIds: readonly string[]
  readonly requiredValidations: readonly string[]
  readonly passedValidations: readonly string[]
  readonly integrity: `sha256:${string}`
}

export interface CreateHandoffOptions {
  readonly createdBy: ActorIdentity
  readonly intendedFor?: string
  readonly note?: string
  readonly createdAt?: string
}
