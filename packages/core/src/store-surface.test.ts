import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it } from 'vitest'

import {
  ActiveClaimError,
  BUILTIN_VISUAL_TEMPLATES,
  WorkflowStore,
} from './index.js'
import type { ActorIdentity, EventInput, WorkflowPhase } from './index.js'

const ACTOR: ActorIdentity = { id: 'codex-local', kind: 'harness', harness: 'codex' }
const USER: ActorIdentity = { id: 'operator', kind: 'user', displayName: 'Operator' }
const temporaryRoots: string[] = []

async function temporaryProject(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'phasewire-store-surface-'))
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
): Promise<void> {
  await store.append({
    workflowId,
    type,
    phase,
    payload,
    actor: ACTOR,
    idempotencyKey: `${type}-${clock}`,
    occurredAt: new Date(Date.UTC(2026, 0, 1, 0, 0, clock)).toISOString(),
  })
}

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
    expect(BUILTIN_VISUAL_TEMPLATES).toHaveLength(19)
    expect(catalog.filter((entry) => entry.layer === 'builtin')).toHaveLength(19)
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
