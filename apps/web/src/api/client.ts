import type { WorkflowProjection } from '../types'
import {
  apiHeaders,
  apiPath,
  apiToken,
  isRecord,
  parseJson,
  requestedWorkflowId,
} from './helpers'
import { adaptWorkflowProjection, workflowCollection, workflowId } from './projection'

interface ActionResponse {
  workflow: WorkflowProjection
}

export async function loadCurrentWorkflow(signal?: AbortSignal): Promise<WorkflowProjection> {
  if (requestedWorkflowId !== null) {
    const response = await fetch(apiPath(`/workflows/${encodeURIComponent(requestedWorkflowId)}`), {
      headers: apiHeaders(),
      ...(signal === undefined ? {} : { signal }),
    })
    const selected = adaptWorkflowProjection(await parseJson(response))
    if (selected === null) throw new Error('Phasewire API returned an incompatible workflow projection.')
    return selected
  }

  const listResponse = await fetch(apiPath('/workflows'), {
    headers: apiHeaders(),
    ...(signal === undefined ? {} : { signal }),
  })
  const listing = await parseJson(listResponse)
  const directProjection = adaptWorkflowProjection(listing)
  if (directProjection !== null) return directProjection

  const id = workflowId(workflowCollection(listing)[0])
  if (id === null) throw new Error('Phasewire API returned no active workflows.')
  const workflowResponse = await fetch(apiPath(`/workflows/${encodeURIComponent(id)}`), {
    headers: apiHeaders(),
    ...(signal === undefined ? {} : { signal }),
  })
  const projection = adaptWorkflowProjection(await parseJson(workflowResponse))
  if (projection === null) throw new Error('Phasewire API returned an incompatible workflow projection.')
  return projection
}

async function postAction(
  workflowIdValue: string,
  action: string,
  payload: Record<string, unknown>,
  actor?: string,
): Promise<WorkflowProjection> {
  const response = await fetch(
    apiPath(`/workflows/${encodeURIComponent(workflowIdValue)}/actions/${action}`),
    {
      method: 'POST',
      headers: apiHeaders({ json: true, mutation: true }),
      body: JSON.stringify({ ...(actor === undefined ? {} : { actor }), payload }),
    },
  )
  const body = await parseJson(response)
  if (!isRecord(body)) throw new Error('Phasewire API returned an invalid action response.')
  const updatedWorkflow = adaptWorkflowProjection(body.workflow)
  const result: ActionResponse | null = updatedWorkflow === null ? null : { workflow: updatedWorkflow }
  if (result === null) throw new Error('Phasewire API did not return the updated workflow.')
  return result.workflow
}

export function submitDecision(
  workflowIdValue: string,
  decisionId: string,
  title: string,
  outcome: string,
): Promise<WorkflowProjection> {
  return postAction(workflowIdValue, 'decision', { decisionId, outcome, title }, 'phasewire-web')
}

export function submitAnnotation(workflowIdValue: string, body: string): Promise<WorkflowProjection> {
  return postAction(workflowIdValue, 'annotation', { body }, 'phasewire-web')
}

export function authorizeDeployment(workflowIdValue: string): Promise<WorkflowProjection> {
  return postAction(workflowIdValue, 'authorize-deployment', { acknowledgedReadiness: true })
}

export function approvePlan(
  workflowIdValue: string,
  action: 'approve-plan' | 'approve-remediation' = 'approve-plan',
): Promise<WorkflowProjection> {
  return postAction(workflowIdValue, action, { acknowledgedMaterialDecisions: true })
}

export function subscribeToWorkflowUpdates(
  onWorkflow: (workflow: WorkflowProjection) => void,
  onDisconnect: () => void,
): EventSource {
  const search = new URLSearchParams()
  if (apiToken !== null) search.set('token', apiToken)
  const stream = new EventSource(apiPath(`/updates${search.size === 0 ? '' : `?${search.toString()}`}`))
  stream.addEventListener('workflow', (event) => {
    if (!(event instanceof MessageEvent) || typeof event.data !== 'string') return
    try {
      const workflow = adaptWorkflowProjection(JSON.parse(event.data) as unknown)
      if (workflow !== null) onWorkflow(workflow)
    } catch {
      onDisconnect()
    }
  })
  stream.onerror = onDisconnect
  return stream
}
