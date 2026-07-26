import { assertEventIntegrity } from '../canonical.js'
import { ReplayError } from '../errors.js'
import type { ReplayResult, WorkflowEvent, WorkflowProjection } from '../types.js'
import { assertWorkflowEvent, isObject } from './event-validation.js'
import { deriveReadiness } from './readiness.js'
import { initialProjection, reduceWorkflow } from './reducer.js'

function equalSets(left: readonly string[], right: readonly string[]): boolean {
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.length === sortedRight.length && sortedLeft.every((entry, index) => entry === sortedRight[index])
}

function reconciliationParent(event: WorkflowEvent): string {
  const mergedHeads = event.payload.mergedHeads
  if (!Array.isArray(mergedHeads) || !mergedHeads.every((entry) => typeof entry === 'string') ||
    !equalSets(mergedHeads, event.parents)) {
    throw new ReplayError('workflow.reconciled payload.mergedHeads must exactly match its parent heads')
  }
  const resolution = event.payload.resolution
  if (!isObject(resolution) || resolution.strategy !== 'select-parent' ||
    !Object.keys(resolution).every((key) => ['strategy', 'selectedParent', 'rationale'].includes(key)) ||
    typeof resolution.selectedParent !== 'string' || !event.parents.includes(resolution.selectedParent) ||
    typeof resolution.rationale !== 'string' || resolution.rationale.trim().length === 0) {
    throw new ReplayError('workflow.reconciled requires an explicit select-parent resolution and rationale')
  }
  return resolution.selectedParent
}

function validateGraph(events: readonly WorkflowEvent[]): {
  readonly byId: ReadonlyMap<string, WorkflowEvent>
  readonly ordered: readonly WorkflowEvent[]
} {
  const byId = new Map<string, WorkflowEvent>()
  let workflowId: string | undefined
  for (const event of events) {
    assertWorkflowEvent(event, event.eventId)
    assertEventIntegrity(event)
    if (workflowId !== undefined && event.workflowId !== workflowId) throw new ReplayError('A replay cannot contain events from multiple workflows')
    workflowId = event.workflowId
    if (byId.has(event.eventId)) throw new ReplayError(`Duplicate event ID ${event.eventId}`)
    if (new Set(event.parents).size !== event.parents.length) throw new ReplayError(`Event ${event.eventId} contains duplicate parents`)
    byId.set(event.eventId, event)
  }

  const children = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  for (const event of events) {
    indegree.set(event.eventId, event.parents.length)
    for (const parent of event.parents) {
      if (!byId.has(parent)) throw new ReplayError(`Event ${event.eventId} references missing parent ${parent}`)
      children.set(parent, [...(children.get(parent) ?? []), event.eventId])
    }
  }
  const roots = events.filter((event) => event.parents.length === 0)
  if (roots.length !== 1 || roots[0]?.type !== 'workflow.created') {
    throw new ReplayError('A workflow DAG requires exactly one workflow.created root')
  }
  if (roots[0].logicalClock !== 0) throw new ReplayError('The workflow root logicalClock must be 0')

  const compare = (left: WorkflowEvent, right: WorkflowEvent): number =>
    left.logicalClock - right.logicalClock || left.eventId.localeCompare(right.eventId)
  const ready = events.filter((event) => indegree.get(event.eventId) === 0).sort(compare)
  const ordered: WorkflowEvent[] = []
  while (ready.length > 0) {
    const event = ready.shift()
    if (event === undefined) break
    ordered.push(event)
    for (const childId of children.get(event.eventId) ?? []) {
      const remaining = (indegree.get(childId) ?? 0) - 1
      indegree.set(childId, remaining)
      if (remaining === 0) {
        const child = byId.get(childId)
        if (child !== undefined) { ready.push(child); ready.sort(compare) }
      }
    }
  }
  if (ordered.length !== events.length) throw new ReplayError('Workflow event graph contains a cycle')
  for (const event of ordered.slice(1)) {
    const parentClocks = event.parents.map((parent) => byId.get(parent)?.logicalClock ?? -1)
    const expectedClock = Math.max(...parentClocks) + 1
    if (event.logicalClock !== expectedClock) throw new ReplayError(`Event ${event.eventId} has logicalClock ${event.logicalClock}; expected ${expectedClock}`)
    if (event.parents.length > 1 && event.type !== 'workflow.reconciled') throw new ReplayError('Only workflow.reconciled may merge multiple parent heads')
    if (event.type === 'workflow.reconciled') {
      if (event.parents.length < 2) throw new ReplayError('workflow.reconciled requires at least two parent heads')
      for (const parent of event.parents) {
        const otherParents = event.parents.filter((candidate) => candidate !== parent)
        if (otherParents.some((candidate) => ancestorsOf(candidate, byId).has(parent))) {
          throw new ReplayError('workflow.reconciled parents must be divergent heads, not ancestors')
        }
      }
      reconciliationParent(event)
    }
  }
  return { byId, ordered }
}

function ancestorsOf(head: string, byId: ReadonlyMap<string, WorkflowEvent>): Set<string> {
  const ancestors = new Set<string>()
  const pending = [head]
  while (pending.length > 0) {
    const id = pending.pop()
    if (id === undefined || ancestors.has(id)) continue
    ancestors.add(id)
    pending.push(...(byId.get(id)?.parents ?? []))
  }
  return ancestors
}

function commonAncestor(
  heads: readonly string[], byId: ReadonlyMap<string, WorkflowEvent>, projections: ReadonlyMap<string, WorkflowProjection>,
): WorkflowProjection {
  const common = heads.map((head) => ancestorsOf(head, byId)).reduce((left, right) =>
    new Set([...left].filter((id) => right.has(id))))
  const event = [...common].map((id) => byId.get(id)).filter((entry): entry is WorkflowEvent => entry !== undefined)
    .sort((left, right) => right.logicalClock - left.logicalClock)[0]
  const projection = event === undefined ? undefined : projections.get(event.eventId)
  if (projection === undefined) throw new ReplayError('Workflow branches have no common projection')
  return projection
}

export function replayWorkflow(events: readonly WorkflowEvent[]): WorkflowProjection {
  return replayWorkflowDetailed(events).projection
}

export function replayWorkflowDetailed(events: readonly WorkflowEvent[]): ReplayResult {
  if (events.length === 0) throw new ReplayError('Cannot replay an empty workflow')
  const { byId, ordered } = validateGraph(events)
  const projections = new Map<string, WorkflowProjection>()
  for (const event of ordered) {
    if (event.parents.length === 0) {
      projections.set(event.eventId, initialProjection(event))
      continue
    }
    const parentId = event.type === 'workflow.reconciled' ? reconciliationParent(event) : event.parents[0]
    const parent = parentId === undefined ? undefined : projections.get(parentId)
    if (parent === undefined) throw new ReplayError(`Missing parent projection for ${event.eventId}`)
    projections.set(event.eventId, reduceWorkflow(parent, event))
  }

  const parentIds = new Set(ordered.flatMap((event) => event.parents))
  const heads = ordered.filter((event) => !parentIds.has(event.eventId)).map((event) => event.eventId).sort()
  const conflicted = heads.length > 1
  const base = conflicted ? commonAncestor(heads, byId, projections) : projections.get(heads[0] ?? '')
  if (base === undefined) throw new ReplayError('Workflow has no final projection')
  const lastEvent = [...ordered].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0] as WorkflowEvent
  const projection = deriveReadiness({
    ...base,
    eventCount: ordered.length,
    lastEventAt: lastEvent.occurredAt,
    logicalClock: Math.max(...ordered.map((event) => event.logicalClock)),
    heads,
    conflicted,
    readOnly: conflicted,
    status: conflicted ? 'conflicted' : base.status,
  })
  return { events: ordered, projection }
}
