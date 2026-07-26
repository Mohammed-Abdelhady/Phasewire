import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  WorkflowStore,
  type EventInput,
  type WorkflowEvent,
} from '@phasewire/core'

import { PhasewireCoreFacade } from './core-facade.js'
import { createHandoff, listHandoffs } from './handoffs.js'

const roots: string[] = []
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

const temporaryRoot = async (): Promise<string> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'phasewire-handoff-')))
  roots.push(root)
  return root
}

class HandoffAppendFailureStore extends WorkflowStore {
  public override append(input: EventInput): Promise<WorkflowEvent> {
    if (input.type === 'handoff.created') return Promise.reject(new Error('forced append failure'))
    return super.append(input)
  }
}

class HandoffRaceStore extends WorkflowStore {
  public override async writeHandoff(packet: Parameters<WorkflowStore['writeHandoff']>[0]): Promise<string> {
    const path = await super.writeHandoff(packet)
    await this.append({
      actor: { harness: 'codex', id: 'codex', kind: 'harness' },
      idempotencyKey: 'race-mutation',
      payload: { body: 'Mutation after packet snapshot' },
      phase: 'plan',
      type: 'annotation.recorded',
      workflowId: packet.workflowId,
    })
    return path
  }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('handoff packet consistency', () => {
  it('writes a validated packet before recording an event that references it', async () => {
    const root = await temporaryRoot()
    const core = new PhasewireCoreFacade(root)
    await core.initialize({ projectId: 'handoff-test' })
    await core.createWorkflow({ actor: 'codex', title: 'Portable handoff', workflowId: 'wf-handoff' })

    const created = await core.createHandoff({
      createdBy: 'codex',
      intendedFor: 'grok',
      note: 'Continue the verified plan.',
      workflowId: 'wf-handoff',
    })
    if (typeof created !== 'object' || created === null || !('packet' in created)) {
      throw new Error('Handoff creation returned an invalid result')
    }
    const packets = await core.listHandoffs('wf-handoff')
    expect(packets).toHaveLength(1)
    expect(packets[0]).toEqual(created.packet)

    const eventDirectory = join(root, '.phasewire', 'workflows', 'wf-handoff', 'events')
    const events = await Promise.all(
      (await readdir(eventDirectory)).map(async (name) =>
        JSON.parse(await readFile(join(eventDirectory, name), 'utf8')) as unknown,
      ),
    )
    const event = events.find((value) => isRecord(value) && value.type === 'handoff.created')
    if (!isRecord(event) || !isRecord(event.payload)) throw new Error('Missing handoff event payload')
    expect(event.payload.handoffId).toBe(packets[0]?.handoffId)
    expect(event.payload.integrity).toBe(packets[0]?.integrity)
  })

  it('rejects a handoff whose packet content no longer matches its integrity', async () => {
    const root = await temporaryRoot()
    const core = new PhasewireCoreFacade(root)
    await core.initialize({ projectId: 'handoff-integrity-test' })
    await core.createWorkflow({ actor: 'codex', title: 'Integrity', workflowId: 'wf-integrity' })
    await core.createHandoff({
      createdBy: 'codex',
      intendedFor: 'grok',
      workflowId: 'wf-integrity',
    })
    const packet = (await core.listHandoffs('wf-integrity'))[0]
    if (packet === undefined) throw new Error('Expected a handoff packet')
    const path = join(root, '.phasewire', 'handoffs', `${packet.handoffId}.json`)
    await writeFile(path, `${JSON.stringify({ ...packet, note: 'tampered' })}\n`, 'utf8')

    await expect(core.listHandoffs('wf-integrity')).rejects.toThrow('integrity mismatch')
  })

  it('does not expose a prepared packet when its commit event append fails', async () => {
    const root = await temporaryRoot()
    const store = new HandoffAppendFailureStore(root)
    await store.init({ projectId: 'handoff-append-failure' })
    await store.createWorkflow({
      actor: { harness: 'codex', id: 'codex', kind: 'harness' },
      idempotencyKey: 'create-failure-workflow',
      title: 'Append failure',
      workflowId: 'wf-append-failure',
    })

    await expect(createHandoff(store, {
      createdBy: 'codex',
      workflowId: 'wf-append-failure',
    })).rejects.toThrow('forced append failure')
    expect(await listHandoffs(store, 'wf-append-failure')).toEqual([])
  })

  it('does not expose an orphan packet without a matching commit event', async () => {
    const root = await temporaryRoot()
    const store = new WorkflowStore(root)
    await store.init({ projectId: 'handoff-orphan' })
    await store.createWorkflow({
      actor: { harness: 'codex', id: 'codex', kind: 'harness' },
      idempotencyKey: 'create-orphan-workflow',
      title: 'Orphan packet',
      workflowId: 'wf-orphan',
    })
    const packet = await store.createHandoff('wf-orphan', {
      createdBy: { harness: 'codex', id: 'codex', kind: 'harness' },
    })
    await store.writeHandoff(packet)

    expect(await listHandoffs(store, 'wf-orphan')).toEqual([])
  })

  it('rejects a handoff when workflow heads change after its snapshot', async () => {
    const root = await temporaryRoot()
    const store = new HandoffRaceStore(root)
    await store.init({ projectId: 'handoff-race' })
    await store.createWorkflow({
      actor: { harness: 'codex', id: 'codex', kind: 'harness' },
      idempotencyKey: 'create-race-workflow',
      title: 'Race packet',
      workflowId: 'wf-race',
    })

    await expect(createHandoff(store, {
      createdBy: 'codex', workflowId: 'wf-race',
    })).rejects.toMatchObject({ code: 'STALE_EVENT_PARENTS' })
    expect(await listHandoffs(store, 'wf-race')).toEqual([])
  })
})
