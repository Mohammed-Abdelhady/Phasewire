import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import {
  LOCK_HEARTBEAT_MS,
  LOCK_STALE_AFTER_MS,
  WorkflowStore,
  acquireDirectoryLock,
  assertHandoffPacket,
  createEventEnvelope,
  scaffoldVisualTemplate,
  replayWorkflow,
  validateVisualTemplate,
} from './index.js'
import type { ActorIdentity, EventInput, WorkflowEvent, WorkflowPhase } from './index.js'

const WORKER: ActorIdentity = { id: 'worker', kind: 'harness', harness: 'codex' }
const OTHER: ActorIdentity = { id: 'other', kind: 'harness', harness: 'other' }
const USER: ActorIdentity = { id: 'operator', kind: 'user' }
const roots: string[] = []

async function temporaryProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'phasewire-remediation-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

async function append(
  store: WorkflowStore,
  workflowId: string,
  type: EventInput['type'],
  phase: WorkflowPhase,
  payload: EventInput['payload'],
  clock: number,
  actor: ActorIdentity = WORKER,
): Promise<WorkflowEvent> {
  return store.append({
    workflowId, type, phase, payload, actor,
    idempotencyKey: `${type}-${clock}-${actor.id}`,
    occurredAt: new Date(Date.UTC(2026, 0, 2, 0, 0, clock)).toISOString(),
  })
}

async function reviewedWorkflow(requiredValidations: readonly string[] = []): Promise<{
  readonly store: WorkflowStore
  readonly workflowId: string
}> {
  const store = new WorkflowStore(await temporaryProject())
  const workflowId = `workflow-${roots.length}`
  await store.init({ requiredValidations })
  await store.createWorkflow({
    workflowId, title: 'Workflow', actor: WORKER, idempotencyKey: 'create',
    occurredAt: '2026-01-02T00:00:00.000Z',
  })
  await append(store, workflowId, 'plan.proposed', 'plan', {}, 1)
  await append(store, workflowId, 'plan.approved', 'plan', {}, 2, USER)
  await append(store, workflowId, 'execution.started', 'execute', {}, 3)
  await append(store, workflowId, 'execution.completed', 'execute', {}, 4)
  await append(store, workflowId, 'review.started', 'review', {}, 5)
  return { store, workflowId }
}

describe('remediation and readiness invariants', () => {
  it('requires an active remediation and the exact set of open blocker IDs before re-review', async () => {
    const { store, workflowId } = await reviewedWorkflow()
    await append(store, workflowId, 'review.finding', 'review', { findingId: 'one', title: 'One', severity: 'blocking' }, 6)
    await append(store, workflowId, 'review.finding', 'review', { findingId: 'two', title: 'Two', severity: 'blocking' }, 7)
    await append(store, workflowId, 'review.completed', 'review', {}, 8)
    const planning = await store.loadWorkflow(workflowId)
    expect(planning.currentPhase).toBe('remediation')
    expect(planning.remediation.started).toBe(false)

    await expect(append(store, workflowId, 'remediation.completed', 'remediation', {
      resolvedFindingIds: ['one', 'two'],
    }, 9)).rejects.toThrow('active remediation cycle')
    await append(store, workflowId, 'remediation.plan-proposed', 'remediation', {}, 10)
    const reset = await store.loadWorkflow(workflowId)
    expect(reset.execution).toEqual({ started: false, completed: false })
    expect(reset.review.completedByEventId).toBeUndefined()
    expect(reset.validations).toEqual([])
    await expect(append(store, workflowId, 'remediation.started', 'remediation', {}, 11))
      .rejects.toThrow('explicit approval')
    await append(store, workflowId, 'remediation.plan-approved', 'remediation', {}, 12, USER)
    await append(store, workflowId, 'remediation.started', 'remediation', {}, 13)
    await expect(append(store, workflowId, 'remediation.completed', 'remediation', {
      resolvedFindingIds: ['one'],
    }, 14)).rejects.toThrow('exactly every open blocking finding ID')
    await expect(append(store, workflowId, 'remediation.completed', 'remediation', {
      resolvedFindingIds: ['one', 'two', 'extra'],
    }, 15)).rejects.toThrow('exactly every open blocking finding ID')
    await append(store, workflowId, 'remediation.completed', 'remediation', {
      resolvedFindingIds: ['two', 'one'],
    }, 16)
    expect((await store.loadWorkflow(workflowId)).deploymentReadiness.ready).toBe(false)
    await append(store, workflowId, 'review.started', 'review', {}, 17)
    await append(store, workflowId, 'review.completed', 'review', {}, 18)
    expect((await store.loadWorkflow(workflowId)).deploymentReadiness.ready).toBe(true)
  })

  it('demotes readiness and clears stale deployment authorization', async () => {
    const { store, workflowId } = await reviewedWorkflow(['lint'])
    await append(store, workflowId, 'review.completed', 'review', {}, 6)
    await append(store, workflowId, 'validation.recorded', 'execute', { check: 'lint', status: 'passed' }, 7)
    await append(store, workflowId, 'deployment.authorization-recorded', 'review', {}, 8, USER)
    expect((await store.loadWorkflow(workflowId)).deploymentReadiness.authorizationRecorded).toBe(true)

    await append(store, workflowId, 'validation.recorded', 'execute', { check: 'lint', status: 'failed' }, 9)
    const demoted = await store.loadWorkflow(workflowId)
    expect(demoted.status).toBe('reviewing')
    expect(demoted.deploymentReadiness.ready).toBe(false)
    expect(demoted.deploymentReadiness.authorizationRecorded).toBe(false)
  })
})

describe('claim and lock recovery', () => {
  it('keeps claims out of workflow state and enforces the active owner while allowing expiry recovery', async () => {
    const root = await temporaryProject()
    let now = new Date('2026-01-02T00:00:00.000Z')
    const store = new WorkflowStore(root, { now: () => now })
    await store.init()
    await store.createWorkflow({ workflowId: 'claims', title: 'Claims', actor: WORKER, idempotencyKey: 'create' })
    await store.claimPhase('claims', 'plan', WORKER, {
      idempotencyKey: 'claim-worker', ttlMs: 1_000,
    })
    const claimed = await store.loadWorkflow('claims')
    expect([claimed.currentPhase, claimed.status]).toEqual(['plan', 'planning'])
    await expect(append(store, 'claims', 'annotation.recorded', 'plan', { body: 'blocked' }, 0, OTHER))
      .rejects.toThrow('requires ownership')

    now = new Date('2026-01-02T00:00:02.000Z')
    await store.claimPhase('claims', 'plan', OTHER, { idempotencyKey: 'claim-other', ttlMs: 1_000 })
    expect((await store.loadWorkflow('claims')).claims.plan?.owner.id).toBe('other')
  })

  it('persists owner heartbeats and recovers a stale lock directory', async () => {
    const root = await temporaryProject()
    const lockPath = join(root, 'runtime', 'locks', 'workflow.lock')
    const release = await acquireDirectoryLock(lockPath, { trustedRoot: root })
    const metadata = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8')) as Record<string, unknown>
    expect(metadata).toMatchObject({ schemaVersion: 1, pid: process.pid })
    expect(typeof metadata.ownerId).toBe('string')
    expect(LOCK_HEARTBEAT_MS).toBe(30_000)
    expect(LOCK_STALE_AFTER_MS).toBe(120_000)
    await release()

    await mkdir(lockPath, { recursive: true })
    await writeFile(join(lockPath, 'owner.json'), JSON.stringify({
      schemaVersion: 1, ownerId: 'abandoned', pid: 1, hostname: 'old',
      acquiredAt: '2026-01-01T00:00:00.000Z', heartbeatAt: '2026-01-01T00:00:00.000Z',
    }))
    const recovered = await acquireDirectoryLock(lockPath, {
      trustedRoot: root,
      now: () => new Date('2026-01-01T00:03:00.000Z'),
    })
    const replacement = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8')) as Record<string, unknown>
    expect(replacement.ownerId).not.toBe('abandoned')
    await recovered()
  })
})

describe('reconciliation, handoffs, templates, and migrations', () => {
  it('requires reconciliation parents and an explicit authoritative state choice', () => {
    const root = createEventEnvelope({
      workflowId: 'merge', type: 'workflow.created', phase: 'plan', actor: WORKER,
      occurredAt: '2026-01-02T00:00:00.000Z', parents: [], logicalClock: 0,
      idempotencyKey: 'root', payload: { title: 'Merge', requiredValidations: [] },
    })
    const branch = (key: string, artifactPath: string): WorkflowEvent => createEventEnvelope({
      workflowId: 'merge', type: 'plan.proposed', phase: 'plan', actor: WORKER,
      occurredAt: '2026-01-02T00:00:01.000Z', parents: [root.eventId], logicalClock: 1,
      idempotencyKey: key, payload: { artifactPath },
    })
    const left = branch('left', 'left.md')
    const right = branch('right', 'right.md')
    const invalid = createEventEnvelope({
      workflowId: 'merge', type: 'workflow.reconciled', phase: 'plan', actor: USER,
      occurredAt: '2026-01-02T00:00:02.000Z', parents: [left.eventId, right.eventId], logicalClock: 2,
      idempotencyKey: 'invalid', payload: { mergedHeads: [left.eventId, right.eventId] },
    })
    expect(() => replayWorkflow([root, left, right, invalid])).toThrow('explicit select-parent')
    const valid = createEventEnvelope({
      ...invalid,
      idempotencyKey: 'valid',
      payload: {
        mergedHeads: [left.eventId, right.eventId],
        resolution: { strategy: 'select-parent', selectedParent: right.eventId, rationale: 'Right has accepted state' },
      },
    })
    expect(replayWorkflow([root, left, right, valid]).plan.artifactPath).toBe('right.md')
  })

  it('validates handoff integrity and exposes schema-equivalent reusable template creation', async () => {
    const { store, workflowId } = await reviewedWorkflow()
    const packet = await store.createHandoff(workflowId, { createdBy: WORKER })
    expect(() => assertHandoffPacket(packet)).not.toThrow()
    expect(() => assertHandoffPacket({ ...packet, cycle: 99 })).toThrow('integrity')

    const template = scaffoldVisualTemplate({
      id: 'custom.template', name: 'Custom', description: 'Reusable template', primaryBinding: 'workflow.status',
    })
    expect(validateVisualTemplate(template)).toEqual([])
    expect(validateVisualTemplate({ ...template, extra: true })).toContain('template.extra is not allowed')
    expect(validateVisualTemplate({ ...template, layoutRules: { ...template.layoutRules, maximumColumns: 0 } }))
      .toContain('layoutRules.maximumColumns must be a positive integer')
  })

  it('migrates v0 config fixtures and keeps newer majors read-only but exportable', async () => {
    const legacyRoot = await temporaryProject()
    await mkdir(join(legacyRoot, '.phasewire'), { recursive: true })
    await writeFile(join(legacyRoot, '.phasewire', 'config.json'), JSON.stringify({
      schemaVersion: 0, projectId: 'legacy', templateId: 'phasewire.default', requiredChecks: ['lint', 'lint'],
    }))
    const legacyStore = new WorkflowStore(legacyRoot)
    const migration = await legacyStore.migrate()
    expect(migration).toMatchObject({ fromVersion: 0, toVersion: 1, changed: true, readOnly: false })
    expect(await legacyStore.readConfig()).toMatchObject({ schemaVersion: 1, requiredValidations: ['lint'] })

    const newerRoot = await temporaryProject()
    await mkdir(join(newerRoot, '.phasewire'), { recursive: true })
    await writeFile(join(newerRoot, '.phasewire', 'config.json'), JSON.stringify({ schemaVersion: 2, future: true }))
    const newerStore = new WorkflowStore(newerRoot)
    expect(await newerStore.migrate()).toMatchObject({ fromVersion: 2, changed: false, readOnly: true, exportAvailable: true })
    const exported = await newerStore.exportProject()
    expect(exported.projectRoot).toBe('.')
    expect(exported.files['.phasewire/config.json']).toEqual({ schemaVersion: 2, future: true })
    await expect(newerStore.createWorkflow({
      workflowId: 'blocked', title: 'Blocked', actor: WORKER, idempotencyKey: 'create',
    })).rejects.toMatchObject({ code: 'NEWER_SCHEMA_READ_ONLY' })
  })
})
