import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  BUILTIN_VISUAL_TEMPLATES,
  PhasewireError,
  WorkflowStore,
  createVisualTemplate,
} from './index.js'
import type { ActorIdentity, EventInput, WorkflowEvent, WorkflowPhase } from './index.js'

const OWNER: ActorIdentity = { id: 'owner', kind: 'harness', harness: 'codex' }
const OTHER: ActorIdentity = { id: 'other', kind: 'harness', harness: 'other' }
const USER: ActorIdentity = { id: 'operator', kind: 'user' }
const roots: string[] = []

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'phasewire-security-'))
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
  actor: ActorIdentity = OWNER,
): Promise<WorkflowEvent> {
  return store.append({
    actor,
    idempotencyKey: `${type}-${Math.random().toString(16).slice(2)}`,
    payload,
    phase,
    type,
    workflowId,
  })
}

async function readyWorkflow(store: WorkflowStore, workflowId: string): Promise<void> {
  await store.createWorkflow({ actor: OWNER, idempotencyKey: 'create', title: 'Ready', workflowId })
  await append(store, workflowId, 'plan.proposed', 'plan', {})
  await append(store, workflowId, 'plan.approved', 'plan', {}, USER)
  await append(store, workflowId, 'execution.started', 'execute', {})
  await append(store, workflowId, 'execution.completed', 'execute', {})
  await append(store, workflowId, 'review.started', 'review', {})
  await append(store, workflowId, 'review.completed', 'review', {})
}

describe('security invariants', () => {
  it('invalidates deployment authorization after every later mutation', async () => {
    const store = new WorkflowStore(await project())
    await store.init({ requiredValidations: [] })
    await readyWorkflow(store, 'authorization')
    await append(store, 'authorization', 'deployment.authorization-recorded', 'review', {}, USER)
    expect((await store.loadWorkflow('authorization')).deploymentReadiness.authorizationRecorded).toBe(true)

    await append(store, 'authorization', 'decision.recorded', 'review', {
      decisionId: 'after-authorization', title: 'Change', outcome: 'New evidence',
    })
    const changed = await store.loadWorkflow('authorization')
    expect(changed.deploymentReadiness.ready).toBe(true)
    expect(changed.deploymentReadiness.authorizationRecorded).toBe(false)
  })

  it('invalidates downstream evidence when a replacement plan is proposed', async () => {
    const store = new WorkflowStore(await project())
    await store.init({ requiredValidations: [] })
    await readyWorkflow(store, 'replacement-plan')
    expect((await store.loadWorkflow('replacement-plan')).deploymentReadiness.ready).toBe(true)

    await append(store, 'replacement-plan', 'plan.proposed', 'plan', { artifactPath: 'plans/v2.md' })
    await append(store, 'replacement-plan', 'plan.approved', 'plan', {}, USER)
    const replaced = await store.loadWorkflow('replacement-plan')
    expect(replaced.deploymentReadiness.ready).toBe(false)
    expect(replaced.execution.completed).toBe(false)
    expect(replaced.review.completed).toBe(false)
  })

  it('uses the trusted store clock for claim expiry and rejects timestamp jumps', async () => {
    let now = new Date('2026-07-26T00:00:00.000Z')
    const store = new WorkflowStore(await project(), { now: () => now })
    await store.init()
    await store.createWorkflow({ actor: OWNER, idempotencyKey: 'create', title: 'Claim', workflowId: 'claim-clock' })
    await store.claimPhase('claim-clock', 'plan', OWNER, { idempotencyKey: 'claim', ttlMs: 60_000 })

    await expect(store.append({
      actor: OTHER,
      idempotencyKey: 'future-spoof',
      occurredAt: '2100-01-01T00:00:00.000Z',
      payload: { body: 'spoof' },
      phase: 'plan',
      type: 'annotation.recorded',
      workflowId: 'claim-clock',
    })).rejects.toThrow('requires ownership')

    now = new Date('2026-07-26T00:02:00.000Z')
    await append(store, 'claim-clock', 'annotation.recorded', 'plan', { body: 'recovered' }, OTHER)
    expect((await store.loadWorkflow('claim-clock')).claims.plan?.interruptedAt).toBe(now.toISOString())
  })

  it('rejects generic claim events with forged timestamps or oversized leases', async () => {
    const now = new Date('2026-07-26T00:00:00.000Z')
    const store = new WorkflowStore(await project(), { now: () => now })
    await store.init()
    await store.createWorkflow({ actor: OWNER, idempotencyKey: 'create', title: 'Claim', workflowId: 'forged-claim' })

    await expect(store.append({
      actor: OWNER,
      idempotencyKey: 'forged',
      occurredAt: '2099-01-01T00:00:00.000Z',
      payload: { claimId: 'forged', leaseExpiresAt: '2100-01-01T00:00:00.000Z' },
      phase: 'plan',
      type: 'phase.claimed',
      workflowId: 'forged-claim',
    })).rejects.toMatchObject({ code: 'INVALID_CLAIM_TTL' })
  })

  it('does not let a caller relabel a fixed-phase event to evade a claim', async () => {
    const store = new WorkflowStore(await project())
    await store.init()
    await store.createWorkflow({ actor: OWNER, idempotencyKey: 'create', title: 'Phase', workflowId: 'phase-claim' })
    await append(store, 'phase-claim', 'plan.proposed', 'plan', {})
    await append(store, 'phase-claim', 'plan.approved', 'plan', {}, USER)
    await append(store, 'phase-claim', 'execution.started', 'execute', {})
    await store.claimPhase('phase-claim', 'execute', OWNER, { idempotencyKey: 'claim-execute' })

    await expect(store.append({
      actor: OTHER,
      idempotencyKey: 'wrong-phase',
      payload: { check: 'lint', status: 'passed' },
      phase: 'review',
      type: 'validation.recorded',
      workflowId: 'phase-claim',
    })).rejects.toThrow('incompatible with phase review')
  })

  it('rejects claim idempotency keys previously used by another event intent', async () => {
    const store = new WorkflowStore(await project())
    await store.init()
    await store.createWorkflow({ actor: OWNER, idempotencyKey: 'shared', title: 'Keys', workflowId: 'claim-key' })
    await expect(store.claimPhase('claim-key', 'plan', OWNER, { idempotencyKey: 'shared' }))
      .rejects.toBeInstanceOf(PhasewireError)
    expect((await store.loadWorkflow('claim-key')).claims.plan).toBeUndefined()
  })

  it('binds claim idempotency to the requested lease duration', async () => {
    const store = new WorkflowStore(await project())
    await store.init()
    await store.createWorkflow({ actor: OWNER, idempotencyKey: 'create', title: 'TTL', workflowId: 'claim-ttl' })
    await store.claimPhase('claim-ttl', 'plan', OWNER, { idempotencyKey: 'same-claim', ttlMs: 1_000 })
    await expect(store.claimPhase('claim-ttl', 'plan', OWNER, {
      idempotencyKey: 'same-claim', ttlMs: 3_600_000,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('resolves the exact pinned template layer and integrity', async () => {
    const store = new WorkflowStore(await project())
    await store.init()
    const builtin = BUILTIN_VISUAL_TEMPLATES[0]
    if (builtin === undefined) throw new Error('Missing built-in template')
    const { integrity: _integrity, ...body } = builtin
    void _integrity
    const shadow = createVisualTemplate({ ...body, name: 'Project shadow' })
    await store.templates.install(shadow, 'project')

    expect((await store.templates.resolve(builtin.id))?.name).toBe(builtin.name)
    expect((await store.templates.get(builtin.id, builtin.version))?.name).toBe(builtin.name)
    expect((await store.templates.list()).find((template) => template.id === builtin.id)?.name).toBe(builtin.name)
    await store.templates.pin(builtin.id, builtin.version)
    expect((await store.templates.resolve(builtin.id))?.name).toBe('Project shadow')
  })

  it('redacts absolute project paths from doctor output', async () => {
    const root = await project()
    const store = new WorkflowStore(root)
    await store.init()
    const report = await store.doctor()
    expect(report.projectRoot).toBe('.')
    expect(JSON.stringify(report)).not.toContain(root)
  })
})
