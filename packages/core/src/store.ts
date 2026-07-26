import { join } from 'node:path'

import { doctorProject } from './doctor.js'
import { ActiveClaimError, PhasewireError } from './errors.js'
import { createHandoffPacket, writeHandoffPacketAtomic } from './handoffs.js'
import { exportProject, migrateProject } from './migrations.js'
import { replayWorkflow } from './replay.js'
import { WorkflowStoreBase } from './store-base.js'
import { MAX_CLAIM_TTL_MS, PHASEWIRE_DIRS, assertTimestamp, jsonObject } from './store-helpers.js'
import type { IndexRebuildResult } from './indexer.js'
import type {
  ActorIdentity, ClaimOptions, CreateHandoffOptions, DoctorReport, HandoffPacket, MigrationResult, ProjectExport,
  ReconcileOptions, ReleaseClaimOptions, WorkflowEvent, WorkflowPhase,
} from './types.js'

export { MAX_CLAIM_TTL_MS, PHASEWIRE_DIRS, PHASEWIRE_SCHEMA_VERSION } from './store-helpers.js'

export class WorkflowStore extends WorkflowStoreBase {
  public async claimPhase(
    workflowId: string,
    phase: WorkflowPhase,
    actor: ActorIdentity,
    options: ClaimOptions,
  ): Promise<WorkflowEvent> {
    const events = await this.loadEvents(workflowId)
    const ttlMs = options.ttlMs ?? 15 * 60 * 1000
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_CLAIM_TTL_MS) {
      throw new PhasewireError(`Claim ttlMs must be between 1 and ${String(MAX_CLAIM_TTL_MS)}`, 'INVALID_CLAIM_TTL')
    }
    const duplicate = events.find((event) => event.idempotencyKey === options.idempotencyKey)
    if (duplicate !== undefined) {
      const recordedExpiry = duplicate.payload.leaseExpiresAt
      const recordedTtl = typeof duplicate.payload.ttlMs === 'number'
        ? duplicate.payload.ttlMs
        : typeof recordedExpiry === 'string'
          ? Date.parse(recordedExpiry) - Date.parse(duplicate.occurredAt)
          : Number.NaN
      if (duplicate.type !== 'phase.claimed' || duplicate.phase !== phase ||
        duplicate.actor.id !== actor.id || duplicate.actor.kind !== actor.kind ||
        duplicate.actor.harness !== actor.harness || recordedTtl !== ttlMs) {
        throw new PhasewireError(
          `Idempotency key ${options.idempotencyKey} was already used for a different event`,
          'IDEMPOTENCY_CONFLICT',
        )
      }
      return duplicate
    }
    const projection = replayWorkflow(events)
    const now = this.trustedTimestamp()
    assertTimestamp(now, 'now')
    const existing = projection.claims[phase]
    if (existing !== undefined && existing.releasedByEventId === undefined && existing.interruptedAt === undefined &&
      Date.parse(existing.leaseExpiresAt) > Date.parse(now)) throw new ActiveClaimError(workflowId, phase)
    const { sha256 } = await import('./canonical.js')
    const claimId = `claim_${sha256(`${workflowId}:${phase}:${actor.id}:${options.idempotencyKey}`).slice(0, 24)}`
    return this.append({
      workflowId, type: 'phase.claimed', phase, actor, idempotencyKey: options.idempotencyKey, occurredAt: now,
      payload: jsonObject({ claimId, leaseExpiresAt: new Date(Date.parse(now) + ttlMs).toISOString(), ttlMs }),
    })
  }

  public async releasePhase(
    workflowId: string,
    phase: WorkflowPhase,
    actor: ActorIdentity,
    options: ReleaseClaimOptions,
  ): Promise<WorkflowEvent> {
    const projection = await this.loadWorkflow(workflowId)
    const claimId = options.claimId ?? projection.claims[phase]?.claimId
    if (claimId === undefined) throw new PhasewireError(`No claim exists for phase ${phase}`, 'CLAIM_NOT_FOUND')
    return this.append({
      workflowId, type: 'phase.released', phase, actor, idempotencyKey: options.idempotencyKey,
      payload: { claimId }, ...(options.occurredAt === undefined ? {} : { occurredAt: options.occurredAt }),
    })
  }

  public async reconcile(
    workflowId: string,
    actor: ActorIdentity,
    options: ReconcileOptions,
  ): Promise<WorkflowEvent> {
    const projection = await this.loadWorkflow(workflowId)
    if (!projection.conflicted) throw new PhasewireError(`Workflow ${workflowId} is not conflicted`, 'RECONCILIATION_NOT_REQUIRED')
    if (options.resolution === undefined || !projection.heads.includes(options.resolution.selectedParent) ||
      options.resolution.rationale.trim().length === 0) {
      throw new PhasewireError('Reconciliation requires an explicit current-head resolution and rationale', 'INVALID_RECONCILIATION')
    }
    return this.append({
      workflowId, type: 'workflow.reconciled', phase: projection.currentPhase, actor,
      idempotencyKey: options.idempotencyKey, parents: projection.heads,
      payload: {
        mergedHeads: [...projection.heads],
        resolution: { ...options.resolution },
        ...(options.note === undefined ? {} : { note: options.note }),
      },
      ...(options.occurredAt === undefined ? {} : { occurredAt: options.occurredAt }),
    })
  }

  public async createHandoff(workflowId: string, options: CreateHandoffOptions): Promise<HandoffPacket> {
    return createHandoffPacket(await this.loadWorkflow(workflowId), options)
  }

  public async writeHandoff(packet: HandoffPacket): Promise<string> {
    const path = join(this.phasewireRoot, PHASEWIRE_DIRS.handoffs, `${packet.handoffId}.json`)
    await this.assertSecureStorePath(path)
    await writeHandoffPacketAtomic(path, packet, this.projectRoot)
    return path
  }

  public async doctor(): Promise<DoctorReport> {
    return doctorProject(this.projectRoot)
  }

  public async rebuildIndex(): Promise<IndexRebuildResult> {
    const { rebuildIndex } = await import('./indexer.js')
    return rebuildIndex(this.projectRoot)
  }

  public async migrate(): Promise<MigrationResult> {
    return migrateProject(this.projectRoot, async () => this.init())
  }

  public async exportProject(): Promise<ProjectExport> {
    return exportProject(this.projectRoot)
  }
}

export function createWorkflowStore(projectRoot: string): WorkflowStore {
  return new WorkflowStore(projectRoot)
}

export async function doctor(projectRoot: string): Promise<DoctorReport> {
  return doctorProject(projectRoot)
}
