import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import type { CoreGateway, WorkflowMutationResult } from './core-gateway.js'
import {
  actionNameSet,
  actionNames,
  asActionInput,
  asTemplateScaffoldInput,
  asWorkflowEventInput,
  hasRequiredAcknowledgement,
  isRecord,
  privilegedActions,
  privilegedEventTypes,
} from './request-parsers.js'
import { isInteractiveRequest } from './security.js'
import type { UpdateHub } from './update-hub.js'
import { STRUCTURAL_EVENT_TYPES } from './workflow-actions.js'

interface ApiRouteOptions {
  readonly core: CoreGateway
  readonly csrfToken: string
  readonly sessionToken: string
}

interface WorkflowParams {
  readonly workflowId: string
}

interface ActionParams extends WorkflowParams {
  readonly action: string
}

const reject = (reply: FastifyReply, statusCode: number, error: string): FastifyReply =>
  reply.code(statusCode).send({ error })

const publishMutation = (hub: UpdateHub, workflowId: string, mutation: WorkflowMutationResult): void => {
  hub.publish({ data: { workflowId, ...mutation }, event: 'workflow' })
}

const registerWorkflowRoutes = (
  app: FastifyInstance,
  options: ApiRouteOptions,
  hub: UpdateHub,
): void => {
  app.get('/api/workflows', async () => options.core.listWorkflows())
  app.get<{ Params: WorkflowParams }>('/api/workflows/:workflowId', async (request) =>
    options.core.loadWorkflow(request.params.workflowId),
  )
  app.post<{ Body: unknown; Params: WorkflowParams }>(
    '/api/workflows/:workflowId/events',
    async (request, reply) => {
      const input = asWorkflowEventInput(request.body)
      if (input === undefined) return reject(reply, 400, 'Event requires a supported type and string actor')
      if (STRUCTURAL_EVENT_TYPES.has(input.type)) {
        return reject(reply, 403, 'Structural events must use their dedicated API')
      }
      if (privilegedEventTypes.has(input.type)) {
        return reject(reply, 403, 'Privileged events must use the interactive action endpoint')
      }
      const mutation = await options.core.appendEvent(request.params.workflowId, input)
      publishMutation(hub, request.params.workflowId, mutation)
      return mutation
    },
  )
  app.get<{ Params: WorkflowParams }>('/api/workflows/:workflowId/actions', async (request) => ({
    actions: actionNames,
    workflow: await options.core.loadWorkflow(request.params.workflowId),
  }))
  app.post<{ Body: unknown; Params: ActionParams }>(
    '/api/workflows/:workflowId/actions/:action',
    async (request, reply) => {
      const action = request.params.action
      const input = asActionInput(request.body)
      if (input === undefined) return reject(reply, 400, 'Action body must contain actor and payload objects')
      if (!actionNameSet.has(action)) return reject(reply, 404, 'Unknown workflow action')

      const privileged = privilegedActions.has(action)
      if (privileged) {
        if (input.actor !== undefined) return reject(reply, 400, 'Privileged action actor is supplied by the service')
        if (!isInteractiveRequest(request, options.sessionToken, options.csrfToken)) {
          return reject(reply, 403, 'Interactive session, exact Origin, and CSRF capability required')
        }
        if (!hasRequiredAcknowledgement(action, input)) {
          return reject(reply, 400, 'Privileged action requires explicit acknowledgement')
        }
      } else if (input.actor === undefined) {
        return reject(reply, 400, 'Action requires an explicit actor')
      }

      const mutation = await options.core.performAction(
        request.params.workflowId,
        action,
        privileged ? { ...input, actor: 'user' } : input,
      )
      publishMutation(hub, request.params.workflowId, mutation)
      return mutation
    },
  )
}

const registerTemplateAndHandoffRoutes = (
  app: FastifyInstance,
  options: ApiRouteOptions,
  hub: UpdateHub,
): void => {
  app.get<{ Querystring: { q?: string } }>('/api/templates', async (request) =>
    options.core.searchTemplates(request.query.q),
  )
  app.post<{ Body: unknown }>('/api/templates/scaffold', async (request, reply) => {
    const input = asTemplateScaffoldInput(request.body)
    if (input === undefined) return reject(reply, 400, 'Template scaffold fields are invalid')
    const template = options.core.scaffoldTemplate(input)
    return { template }
  })
  app.get<{ Querystring: { workflowId?: string } }>('/api/handoffs', async (request) =>
    options.core.listHandoffs(request.query.workflowId),
  )
  app.post<{ Body: unknown }>('/api/handoffs', async (request, reply) => {
    if (!isRecord(request.body)) return reject(reply, 400, 'Handoff body must be an object')
    if (typeof request.body.workflowId !== 'string' || typeof request.body.createdBy !== 'string') {
      return reject(reply, 400, 'Handoff requires workflowId and createdBy')
    }
    const handoff = await options.core.createHandoff(request.body)
    hub.publish({ data: handoff, event: 'handoff' })
    return handoff
  })
}

export const registerApiRoutes = (
  app: FastifyInstance,
  options: ApiRouteOptions,
  hub: UpdateHub,
): void => {
  app.get('/api/health', () => ({ ok: true, pid: process.pid, version: 1 }))
  registerWorkflowRoutes(app, options, hub)
  registerTemplateAndHandoffRoutes(app, options, hub)
  app.get('/api/doctor', async () => options.core.doctor())

  const updatesHandler = (request: FastifyRequest, reply: FastifyReply): void => {
    reply.hijack()
    reply.raw.writeHead(200, {
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
      'x-accel-buffering': 'no',
    })
    const remove = hub.add(reply.raw)
    request.raw.once('close', remove)
  }
  app.get('/api/updates', updatesHandler)
  app.get('/api/events/stream', updatesHandler)
}
