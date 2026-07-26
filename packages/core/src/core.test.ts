import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import {
  BUILTIN_VISUAL_TEMPLATES,
  ActiveClaimError,
  IntegrityError,
  ReplayError,
  WorkflowStore,
  canonicalJson,
  createEventEnvelope,
  replayWorkflow,
  verifyEventIntegrity,
} from './index.js'
import type { ActorIdentity, EventEnvelopeInput, EventInput, WorkflowEvent, WorkflowPhase } from './index.js'

const ACTOR: ActorIdentity = { id: 'codex-local', kind: 'harness', harness: 'codex' }
const USER: ActorIdentity = { id: 'operator', kind: 'user', displayName: 'Operator' }
const temporaryRoots: string[] = []

async function temporaryProject(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'phasewire-core-'))
  temporaryRoots.push(path)
  return path
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (path) => rm(path, { recursive: true, force: true })))
})

async function append(
  store: WorkflowStore,
  workflowId: string,
  type: EventInput['type'],
  phase: WorkflowPhase,
  payload: EventInput['payload'],
  clock: number,
): Promise<WorkflowEvent> {
  return store.append({
    workflowId,
    type,
    phase,
    actor: ACTOR,
    idempotencyKey: `${type}-${clock}`,
    occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
    payload,
  })
}

describe('canonical workflow events', () => {
  it('produces deterministic IDs and integrity regardless of payload key order', () => {
    const base: Omit<EventEnvelopeInput, 'payload'> = {
      workflowId: 'deterministic',
      type: 'workflow.created',
      phase: 'plan',
      actor: ACTOR,
      occurredAt: '2026-01-01T00:00:00.000Z',
      parents: [],
      logicalClock: 0,
      idempotencyKey: 'create-1',
    }
    const left = createEventEnvelope({ ...base, payload: { title: 'Test', alpha: 1, beta: 2 } })
    const right = createEventEnvelope({ ...base, payload: { beta: 2, alpha: 1, title: 'Test' } })

    expect(left.eventId).toBe(right.eventId)
    expect(left.integrity).toBe(right.integrity)
    expect(verifyEventIntegrity(left)).toBe(true)
    expect(canonicalJson({ z: 1, a: [true, null] })).toBe('{"a":[true,null],"z":1}')
  })

  it('rejects content tampering', () => {
    const event = createEventEnvelope({
      workflowId: 'tamper-test',
      type: 'workflow.created',
      phase: 'plan',
      actor: ACTOR,
      occurredAt: '2026-01-01T00:00:00.000Z',
      parents: [],
      logicalClock: 0,
      idempotencyKey: 'create-1',
      payload: { title: 'Original' },
    })
    const tampered: WorkflowEvent = { ...event, payload: { title: 'Changed' } }
    expect(() => replayWorkflow([tampered])).toThrow(IntegrityError)
  })
})

describe('workflow replay and remediation', () => {
  it('derives readiness only after a clean re-review and every required validation', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init({ requiredValidations: ['lint', 'test'] })
    await store.createWorkflow({
      workflowId: 'remediation-cycle',
      title: 'Remediation cycle',
      actor: ACTOR,
      idempotencyKey: 'create',
      occurredAt: '2026-01-01T00:00:00.000Z',
    })
    await append(store, 'remediation-cycle', 'plan.proposed', 'plan', { artifactPath: 'artifacts/plans/plan.md' }, 1)
    await store.append({
      workflowId: 'remediation-cycle',
      type: 'plan.approved',
      phase: 'plan',
      actor: USER,
      idempotencyKey: 'plan-approved-2',
      occurredAt: '2026-01-01T00:00:02.000Z',
      payload: {},
    })
    await append(store, 'remediation-cycle', 'execution.started', 'execute', {}, 3)
    await append(store, 'remediation-cycle', 'execution.completed', 'execute', {}, 4)
    await append(store, 'remediation-cycle', 'review.started', 'review', {}, 5)
    await append(store, 'remediation-cycle', 'review.finding', 'review', {
      findingId: 'finding-1', severity: 'blocking', title: 'Missing guard',
    }, 6)
    await append(store, 'remediation-cycle', 'review.completed', 'review', {}, 7)
    expect((await store.loadWorkflow('remediation-cycle')).status).toBe('remediating')

    await append(store, 'remediation-cycle', 'remediation.plan-proposed', 'remediation', {}, 8)
    await store.append({
      workflowId: 'remediation-cycle', type: 'remediation.plan-approved', phase: 'remediation', actor: USER,
      idempotencyKey: 'remediation-approved-9', occurredAt: '2026-01-01T00:00:09.000Z', payload: {},
    })
    await append(store, 'remediation-cycle', 'remediation.started', 'remediation', {}, 10)
    await append(store, 'remediation-cycle', 'remediation.completed', 'remediation', {
      resolvedFindingIds: ['finding-1'],
    }, 11)
    await append(store, 'remediation-cycle', 'review.started', 'review', {}, 12)
    await append(store, 'remediation-cycle', 'review.completed', 'review', {}, 13)
    await append(store, 'remediation-cycle', 'validation.recorded', 'execute', { check: 'lint', status: 'passed' }, 14)
    await append(store, 'remediation-cycle', 'validation.recorded', 'execute', { check: 'test', status: 'passed' }, 15)

    const ready = await store.loadWorkflow('remediation-cycle')
    expect(ready.cycle).toBe(1)
    expect(ready.status).toBe('deployment-ready')
    expect(ready.deploymentReadiness.ready).toBe(true)
    expect(ready.review.findings[0]?.resolvedByEventId).toBeDefined()

    await store.append({
      workflowId: 'remediation-cycle',
      type: 'deployment.authorization-recorded',
      phase: 'review',
      actor: USER,
      idempotencyKey: 'authorization-1',
      occurredAt: '2026-01-01T00:00:16.000Z',
      payload: { scope: 'readiness-only' },
    })
    expect((await store.loadWorkflow('remediation-cycle')).deploymentReadiness.authorizationRecorded).toBe(true)
  })

  it('validates a candidate before persisting its immutable event file', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    await store.createWorkflow({ workflowId: 'invalid-transition', title: 'Invalid', actor: ACTOR, idempotencyKey: 'create' })
    await expect(append(store, 'invalid-transition', 'plan.approved', 'plan', {}, 1)).rejects.toThrow(ReplayError)
    expect(await store.loadEvents('invalid-transition')).toHaveLength(1)
  })

  it('rejects plan approval from a harness actor', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    await store.createWorkflow({ workflowId: 'user-gate', title: 'User gate', actor: ACTOR, idempotencyKey: 'create' })
    await append(store, 'user-gate', 'plan.proposed', 'plan', {}, 1)
    await expect(append(store, 'user-gate', 'plan.approved', 'plan', {}, 2)).rejects.toThrow(
      'Plan approval must be recorded by a user actor',
    )
  })
})

describe('event DAG conflicts', () => {
  it('keeps concurrent heads read-only until an explicit merge event joins all heads', () => {
    const root = createEventEnvelope({
      workflowId: 'branching',
      type: 'workflow.created',
      phase: 'plan',
      actor: ACTOR,
      occurredAt: '2026-01-01T00:00:00.000Z',
      parents: [],
      logicalClock: 0,
      idempotencyKey: 'create',
      payload: { title: 'Branching', requiredValidations: [] },
    })
    const branch = (idempotencyKey: string, body: string): WorkflowEvent => createEventEnvelope({
      workflowId: 'branching',
      type: 'annotation.recorded',
      phase: 'plan',
      actor: ACTOR,
      occurredAt: '2026-01-01T00:00:01.000Z',
      parents: [root.eventId],
      logicalClock: 1,
      idempotencyKey,
      payload: { body },
    })
    const left = branch('left', 'left')
    const right = branch('right', 'right')
    const conflicted = replayWorkflow([right, root, left])
    expect(conflicted.heads).toEqual([left.eventId, right.eventId].sort())
    expect(conflicted.readOnly).toBe(true)
    expect(conflicted.status).toBe('conflicted')

    const reconciliation = createEventEnvelope({
      workflowId: 'branching',
      type: 'workflow.reconciled',
      phase: 'plan',
      actor: USER,
      occurredAt: '2026-01-01T00:00:02.000Z',
      parents: [left.eventId, right.eventId],
      logicalClock: 2,
      idempotencyKey: 'merge',
      payload: {
        mergedHeads: [left.eventId, right.eventId],
        resolution: { strategy: 'select-parent', selectedParent: left.eventId, rationale: 'Keep the left state' },
      },
    })
    const reconciled = replayWorkflow([right, reconciliation, root, left])
    expect(reconciled.heads).toEqual([reconciliation.eventId])
    expect(reconciled.readOnly).toBe(false)
  })
})

describe('store claims, handoffs, templates, diagnostics, and index', () => {
  it('rejects a project root that is itself a symbolic link', async () => {
    const target = await temporaryProject()
    const container = await temporaryProject()
    const linkedRoot = join(container, 'linked-project')
    await symlink(target, linkedRoot, 'dir')

    expect(() => new WorkflowStore(linkedRoot)).toThrowError(expect.objectContaining({ code: 'PATH_ESCAPE' }))
  })

  it('rejects a symlinked workflow path before an event can escape the project root', async () => {
    const root = await temporaryProject()
    const outside = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    const workflowsPath = join(root, '.phasewire', 'workflows')
    await rm(workflowsPath, { recursive: true })
    await mkdir(outside, { recursive: true })
    await symlink(outside, workflowsPath, 'dir')

    await expect(store.createWorkflow({
      workflowId: 'escaped',
      title: 'Escaped',
      actor: ACTOR,
      idempotencyKey: 'create',
    })).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
    await expect(readFile(join(outside, 'escaped', 'events'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a symlinked event file instead of reading content outside the project root', async () => {
    const root = await temporaryProject()
    const outside = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    await store.createWorkflow({ workflowId: 'event-link', title: 'Event link', actor: ACTOR, idempotencyKey: 'create' })
    const eventsPath = join(root, '.phasewire', 'workflows', 'event-link', 'events')
    const [eventFile] = await readdir(eventsPath)
    if (eventFile === undefined) throw new Error('Expected a persisted event fixture')
    const outsideFile = join(outside, 'stolen.json')
    await writeFile(outsideFile, '{}\n', 'utf8')
    await rm(join(eventsPath, eventFile))
    await symlink(outsideFile, join(eventsPath, eventFile), 'file')

    await expect(store.loadEvents('event-link')).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
  })

  it('creates the portable layout and releases mutation locks after every append', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    await store.createWorkflow({ workflowId: 'portable', title: 'Portable', actor: ACTOR, idempotencyKey: 'create' })
    await append(store, 'portable', 'plan.proposed', 'plan', {}, 1)
    expect(await readFile(join(root, '.phasewire', '.gitignore'), 'utf8')).toBe('.runtime/\n')
    expect(await store.loadEvents('portable')).toHaveLength(2)
  })

  it('enforces exclusive unexpired phase claims', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    await store.createWorkflow({ workflowId: 'claiming', title: 'Claiming', actor: ACTOR, idempotencyKey: 'create' })
    await store.claimPhase('claiming', 'plan', ACTOR, {
      idempotencyKey: 'claim-1', now: '2026-01-01T00:00:00.000Z', ttlMs: 60_000,
    })
    await expect(store.claimPhase('claiming', 'plan', USER, {
      idempotencyKey: 'claim-2', now: '2026-01-01T00:00:01.000Z', ttlMs: 60_000,
    })).rejects.toThrow(ActiveClaimError)
  })

  it('discovers the complete layered built-in catalog and rebuilds its disposable index', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    const catalog = await store.templates.discover()
    expect(BUILTIN_VISUAL_TEMPLATES).toHaveLength(12)
    expect(catalog.filter((entry) => entry.layer === 'builtin')).toHaveLength(12)
    expect(catalog.every((entry) => store.templates.validate(entry.template).length === 0)).toBe(true)

    await store.createWorkflow({ workflowId: 'indexed', title: 'Indexed', actor: ACTOR, idempotencyKey: 'create' })
    const result = await store.rebuildIndex()
    expect(result.workflowCount).toBe(1)
    expect(result.eventCount).toBe(1)
    expect(result.databasePath).toBe(join(root, '.phasewire', '.runtime', 'index.sqlite'))
  })

  it('writes integrity-protected neutral handoffs and reports a healthy project', async () => {
    const root = await temporaryProject()
    const store = new WorkflowStore(root)
    await store.init()
    await store.createWorkflow({ workflowId: 'handoff', title: 'Handoff', actor: ACTOR, idempotencyKey: 'create' })
    const packet = await store.createHandoff('handoff', { createdBy: ACTOR, intendedFor: 'another-harness' })
    const path = await store.writeHandoff(packet)
    expect(path).toBe(join(root, '.phasewire', 'handoffs', `${packet.handoffId}.json`))
    expect((await store.doctor()).ok).toBe(true)
  })
})
