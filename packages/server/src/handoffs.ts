import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  readHandoffPacket,
  WorkflowNotFoundError,
  type HandoffPacket,
  type WorkflowEvent,
  type WorkflowStore,
} from '@phasewire/core'

import { toActor } from './workflow-actions.js'

interface HandoffInput {
  readonly createdBy: string
  readonly intendedFor?: string
  readonly note?: string
  readonly workflowId: string
}

class HandoffIntegrityError extends Error {
  readonly code = 'HANDOFF_INTEGRITY_ERROR'

  constructor(message: string) {
    super(message)
    this.name = 'HandoffIntegrityError'
  }
}

const parseHandoffInput = (value: Readonly<Record<string, unknown>>): HandoffInput => {
  if (typeof value.workflowId !== 'string') throw new Error('Handoff requires workflowId')
  if (typeof value.createdBy !== 'string') throw new Error('Handoff requires createdBy')
  if (value.intendedFor !== undefined && typeof value.intendedFor !== 'string') {
    throw new Error('Handoff intendedFor must be a string')
  }
  if (value.note !== undefined && typeof value.note !== 'string') {
    throw new Error('Handoff note must be a string')
  }
  return {
    createdBy: value.createdBy,
    ...(typeof value.intendedFor === 'string' ? { intendedFor: value.intendedFor } : {}),
    ...(typeof value.note === 'string' ? { note: value.note } : {}),
    workflowId: value.workflowId,
  }
}

export const createHandoff = async (
  store: WorkflowStore,
  value: Readonly<Record<string, unknown>>,
): Promise<Readonly<{ packet: HandoffPacket; path: string }>> => {
  const input = parseHandoffInput(value)
  const actor = toActor(input.createdBy)
  const packet = await store.createHandoff(input.workflowId, {
    createdBy: actor,
    ...(input.intendedFor === undefined ? {} : { intendedFor: input.intendedFor }),
    ...(input.note === undefined ? {} : { note: input.note }),
  })
  const path = await store.writeHandoff(packet)
  const workflow = await store.loadWorkflow(input.workflowId)
  await store.append({
    actor,
    idempotencyKey: packet.handoffId,
    payload: {
      handoffId: packet.handoffId,
      integrity: packet.integrity,
      ...(input.intendedFor === undefined ? {} : { intendedFor: input.intendedFor }),
      ...(input.note === undefined ? {} : { note: input.note }),
    },
    parents: packet.heads,
    phase: workflow.currentPhase,
    type: 'handoff.created',
    workflowId: input.workflowId,
  })
  return { packet, path }
}

export const listHandoffs = async (
  store: WorkflowStore,
  workflowId?: string,
): Promise<readonly HandoffPacket[]> => {
  const directory = join(store.projectRoot, '.phasewire', 'handoffs')
  let names: readonly string[]
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }

  const eventsByWorkflow = new Map<string, readonly WorkflowEvent[]>()
  const committedPackets: HandoffPacket[] = []
  for (const name of names) {
    const path = join(directory, name)
    if ((await lstat(path)).isSymbolicLink()) {
      throw new HandoffIntegrityError(`Handoff packet must not be a symbolic link: ${name}`)
    }
    const packet = await readHandoffPacket(path, store.projectRoot)
    if (`${packet.handoffId}.json` !== name) {
      throw new HandoffIntegrityError('Handoff filename does not match its packet ID')
    }
    if (workflowId !== undefined && packet.workflowId !== workflowId) continue
    let events = eventsByWorkflow.get(packet.workflowId)
    if (events === undefined) {
      try {
        events = await store.loadEvents(packet.workflowId)
      } catch (error: unknown) {
        if (error instanceof WorkflowNotFoundError) continue
        throw error
      }
      eventsByWorkflow.set(packet.workflowId, events)
    }
    const committed = events.some((event) =>
      event.type === 'handoff.created' &&
      event.payload.handoffId === packet.handoffId &&
      event.payload.integrity === packet.integrity &&
      event.parents.length === packet.heads.length &&
      [...event.parents].sort().every((parent, index) => parent === [...packet.heads].sort()[index]),
    )
    if (committed) committedPackets.push(packet)
  }
  return committedPackets.sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.logicalClock - right.logicalClock ||
      left.handoffId.localeCompare(right.handoffId),
  )
}
