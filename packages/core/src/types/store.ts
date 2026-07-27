import type { ActorIdentity, EventInput } from './events.js'
import type { HandoffPacket } from './handoff.js'
import type { JsonObject, JsonValue } from './json.js'
import type { WorkflowProjection } from './workflow.js'

export type AdapterConfigScope = 'project' | 'user'

export interface PhasewireAdaptersConfig {
  readonly hosts: readonly string[]
  readonly scope: AdapterConfigScope
  readonly installedAt?: string
}

export interface PhasewireUiConfig {
  readonly autoOpenOnMutate: boolean
  readonly autoOpenOnStatusWithId: boolean
}

export interface PhasewireConfig {
  readonly schemaVersion: 2
  readonly projectId: string
  readonly defaultTemplateId: string
  readonly requiredValidations: readonly string[]
  readonly defaultHarness?: string
  readonly adapters?: PhasewireAdaptersConfig
  readonly ui?: PhasewireUiConfig
}

export interface InitOptions {
  readonly projectId?: string
  readonly defaultTemplateId?: string
  readonly requiredValidations?: readonly string[]
  readonly defaultHarness?: string
  readonly adapters?: PhasewireAdaptersConfig
  readonly ui?: PhasewireUiConfig
}

export interface WriteConfigInput {
  readonly projectId?: string
  readonly defaultTemplateId?: string
  readonly requiredValidations?: readonly string[]
  readonly defaultHarness?: string
  readonly adapters?: PhasewireAdaptersConfig
  readonly ui?: PhasewireUiConfig
}

export interface WorkflowStoreOptions {
  readonly now?: () => Date
}

export interface CreateWorkflowInput {
  readonly workflowId: string
  readonly title: string
  readonly actor: ActorIdentity
  readonly idempotencyKey: string
  readonly templateId?: string
  readonly requiredValidations?: readonly string[]
  readonly occurredAt?: string
}

export interface ClaimOptions {
  readonly idempotencyKey: string
  readonly ttlMs?: number
  /** @deprecated Lease time is derived from the trusted store clock. */
  readonly now?: string
}

export interface ReleaseClaimOptions {
  readonly idempotencyKey: string
  readonly claimId?: string
  readonly occurredAt?: string
}

export interface ReconciliationResolution {
  readonly strategy: 'select-parent'
  readonly selectedParent: string
  readonly rationale: string
}

export interface ReconcileOptions {
  readonly idempotencyKey: string
  readonly resolution?: ReconciliationResolution
  readonly note?: string
  readonly occurredAt?: string
}

export type DoctorSeverity = 'error' | 'warning' | 'info'

export interface DoctorIssue {
  readonly code: string
  readonly severity: DoctorSeverity
  readonly message: string
  readonly path?: string
  readonly workflowId?: string
  readonly remediation?: string
}

export interface DoctorReport {
  readonly ok: boolean
  readonly checkedAt: string
  readonly projectRoot: string
  readonly workflowCount: number
  readonly issues: readonly DoctorIssue[]
}

export interface MigrationResult {
  readonly fromVersion: number
  readonly toVersion: number
  readonly changed: boolean
  readonly readOnly: boolean
  readonly exportAvailable: boolean
  readonly diagnostics: DoctorReport
}

export interface ProjectExport {
  readonly schemaVersion: number
  readonly exportedAt: string
  readonly projectRoot: string
  readonly files: Readonly<Record<string, JsonValue>>
}

export interface HarnessContext {
  readonly projectRoot: string
  readonly projection: WorkflowProjection
  readonly handoff?: HandoffPacket
}

export interface HarnessAdapter {
  readonly id: string
  readonly displayName: string
  plan(context: HarnessContext): Promise<readonly EventInput[]>
  execute(context: HarnessContext): Promise<readonly EventInput[]>
  review(context: HarnessContext): Promise<readonly EventInput[]>
  resume(context: HarnessContext): Promise<readonly EventInput[]>
}

export interface LegacyConfigV0 extends JsonObject {
  readonly schemaVersion: 0
  readonly projectId: string
  readonly defaultTemplateId?: string
  readonly templateId?: string
  readonly requiredValidations?: readonly JsonValue[]
  readonly requiredChecks?: readonly JsonValue[]
}
