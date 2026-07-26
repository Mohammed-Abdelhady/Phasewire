import type { ActorIdentity, WorkflowEvent, WorkflowPhase } from './events.js'

export type WorkflowStatus =
  | 'planning'
  | 'executing'
  | 'reviewing'
  | 'remediating'
  | 'deployment-ready'
  | 'conflicted'

export interface ArtifactReference {
  readonly kind: 'plan' | 'decision' | 'execution' | 'review' | 'validation'
  readonly path: string
  readonly digest?: string
  readonly eventId: string
}

export interface ReviewFinding {
  readonly id: string
  readonly severity: 'blocking' | 'warning' | 'info'
  readonly title: string
  readonly detail?: string
  readonly artifactPath?: string
  readonly openedByEventId: string
  readonly resolvedByEventId?: string
}

export interface ValidationResult {
  readonly check: string
  readonly status: 'passed' | 'failed' | 'skipped'
  readonly summary?: string
  readonly artifactPath?: string
  readonly eventId: string
  readonly logicalClock: number
}

export interface PhaseClaim {
  readonly phase: WorkflowPhase
  readonly owner: ActorIdentity
  readonly claimId: string
  readonly claimedAt: string
  readonly leaseExpiresAt: string
  readonly eventId: string
  readonly releasedByEventId?: string
  readonly interruptedAt?: string
  readonly interruptedByEventId?: string
}

export interface DecisionRecord {
  readonly id: string
  readonly title: string
  readonly outcome: string
  readonly artifactPath?: string
  readonly eventId: string
}

export interface AnnotationRecord {
  readonly id: string
  readonly body: string
  readonly target?: string
  readonly eventId: string
}

export interface DeploymentReadiness {
  readonly ready: boolean
  readonly blockerCodes: readonly string[]
  readonly requiredValidations: readonly string[]
  readonly passedValidations: readonly string[]
  readonly authorizationRecorded: boolean
}

export interface WorkflowProjection {
  readonly schemaVersion: 1
  readonly workflowId: string
  readonly title: string
  readonly templateId: string
  readonly status: WorkflowStatus
  readonly currentPhase: WorkflowPhase
  readonly cycle: number
  readonly eventCount: number
  readonly lastEventAt: string
  readonly logicalClock: number
  readonly heads: readonly string[]
  readonly conflicted: boolean
  readonly readOnly: boolean
  readonly plan: {
    readonly proposed: boolean
    readonly approved: boolean
    readonly artifactPath?: string
    readonly approvedByEventId?: string
  }
  readonly execution: {
    readonly started: boolean
    readonly completed: boolean
    readonly artifactPath?: string
    readonly completedByEventId?: string
  }
  readonly review: {
    readonly started: boolean
    readonly completed: boolean
    readonly completedByEventId?: string
    readonly findings: readonly ReviewFinding[]
  }
  readonly remediation: {
    readonly proposed: boolean
    readonly approved: boolean
    readonly started: boolean
    readonly completed: boolean
    readonly findingIds: readonly string[]
    readonly artifactPath?: string
    readonly proposedByEventId?: string
    readonly approvedByEventId?: string
    readonly startedByEventId?: string
    readonly completedByEventId?: string
  }
  readonly validations: readonly ValidationResult[]
  readonly decisions: readonly DecisionRecord[]
  readonly annotations: readonly AnnotationRecord[]
  readonly artifacts: readonly ArtifactReference[]
  readonly claims: Readonly<Partial<Record<WorkflowPhase, PhaseClaim>>>
  readonly deploymentReadiness: DeploymentReadiness
}

export interface WorkflowSummary {
  readonly workflowId: string
  readonly title: string
  readonly status: WorkflowStatus
  readonly currentPhase: WorkflowPhase
  readonly cycle: number
  readonly lastEventAt: string
  readonly heads: readonly string[]
  readonly deploymentReady: boolean
}

export interface ReplayResult {
  readonly events: readonly WorkflowEvent[]
  readonly projection: WorkflowProjection
}
