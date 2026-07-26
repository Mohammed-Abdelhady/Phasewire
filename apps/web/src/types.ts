export type PhaseId = 'plan' | 'execute' | 'review' | 'ready'

export type PhaseStatus = 'active' | 'blocked' | 'complete' | 'queued' | 'ready'

export type ValidationStatus = 'passed' | 'failed' | 'pending' | 'unverified'

export type FindingSeverity = 'blocking' | 'high' | 'medium' | 'low' | 'info'

export interface PhaseRecord {
  id: PhaseId
  label: string
  status: PhaseStatus
  owner: string
  harness: string
  summary: string
}

export interface PhaseNarrative {
  now: string
  why: string
  next: string
}

export interface WorkflowCycle {
  number: number
  label: string
  status: 'active' | 'complete'
  summary: string
}

export interface DecisionOption {
  id: string
  label: string
  summary: string
}

export interface WorkflowDecision {
  id: string
  title: string
  context: string
  options: DecisionOption[]
  selectedOptionId: string | null
  requiresApproval: boolean
}

export interface WorkflowAnnotation {
  id: string
  author: string
  harness: string
  body: string
  createdAt: string
}

export interface ReviewFinding {
  id: string
  title: string
  severity: FindingSeverity
  classification: 'blocking' | 'non-blocking' | 'improvement'
  evidence: string
  component: string
  rootCause: string
  resolution: string
  requiresCycle: boolean
}

export interface ValidationResult {
  id: string
  label: string
  status: ValidationStatus
  detail: string
}

export interface WorkflowArtifact {
  id: string
  label: string
  path: string
  kind: string
  phase: PhaseId
}

export interface WorkflowEvent {
  id: string
  label: string
  description: string
  at: string
  phase: PhaseId
  harness: string
}

export interface ExecutionChange {
  path: string
  summary: string
  status: 'added' | 'changed' | 'removed'
}

export interface IssueResolution {
  problem: string
  rootCause: string
  candidates: string[]
  selected: string
  why: string
  implementation: string
  validation: string
}

export interface WorkflowProjection {
  workflowId: string
  title: string
  objective: string
  currentPhase: PhaseId
  cycleCount: number
  updatedAt: string
  phases: PhaseRecord[]
  narratives: Record<PhaseId, PhaseNarrative>
  cycles: WorkflowCycle[]
  decisions: WorkflowDecision[]
  annotations: WorkflowAnnotation[]
  findings: ReviewFinding[]
  validations: ValidationResult[]
  artifacts: WorkflowArtifact[]
  events: WorkflowEvent[]
  executionChanges: ExecutionChange[]
  issueResolution: IssueResolution
  planApproved: boolean
  planApprovalAction: 'approve-plan' | 'approve-remediation'
  deploymentReady: boolean
  deploymentAuthorized: boolean
}

export type ApiConnectionState = 'connecting' | 'live' | 'stale' | 'fallback'
