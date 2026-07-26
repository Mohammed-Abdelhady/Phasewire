import { randomBytes } from 'node:crypto'
import { watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'

import Fastify, { type FastifyInstance } from 'fastify'

import { registerApiRoutes } from './api-routes.js'
import type { CoreGateway } from './core-gateway.js'
import { actionNames } from './request-parsers.js'
import {
  isAllowedHostHeader,
  isAllowedOriginHeader,
  isAuthenticatedRequest,
  isHarnessAuthenticatedRequest,
  isInteractiveRequest,
  tokensMatch,
} from './security.js'
import { registerStaticWorkbench } from './static-workbench.js'
import { UpdateHub } from './update-hub.js'

interface BuildAppOptions {
  readonly core: CoreGateway
  readonly projectRoot?: string
  readonly token: string
  readonly webRoot?: string
}

const watchWorkflowEvents = (
  app: FastifyInstance,
  core: CoreGateway,
  hub: UpdateHub,
  projectRoot: string | undefined,
): void => {
  if (projectRoot === undefined) return
  let watcher: FSWatcher | undefined
  const pending = new Map<string, ReturnType<typeof setTimeout>>()
  try {
    watcher = watch(join(projectRoot, '.phasewire', 'workflows'), { recursive: true }, (_event, filename) => {
      if (filename === null) return
      const [workflowId, directory, eventFile] = filename.toString().split(/[\\/]/u)
      if (workflowId === undefined || directory !== 'events' || !eventFile?.endsWith('.json')) return
      const existing = pending.get(workflowId)
      if (existing !== undefined) clearTimeout(existing)
      pending.set(
        workflowId,
        setTimeout(() => {
          pending.delete(workflowId)
          void core
            .loadWorkflow(workflowId)
            .then((workflow) => {
              hub.publish({ data: { source: 'filesystem', workflow, workflowId }, event: 'workflow' })
            })
            .catch(() => undefined)
        }, 40),
      )
    })
  } catch {
    return
  }

  app.addHook('onClose', () => {
    watcher?.close()
    for (const timeout of pending.values()) clearTimeout(timeout)
    pending.clear()
  })
}

const registerErrorHandler = (app: FastifyInstance): void => {
  app.setErrorHandler((error, _request, reply) => {
    const errorValue: unknown = error
    const errorRecord =
      typeof errorValue === 'object' && errorValue !== null
        ? (errorValue as Readonly<Record<string, unknown>>)
        : undefined
    const code = typeof errorRecord?.code === 'string' ? errorRecord.code : 'INTERNAL_ERROR'
    const statusCode =
      code === 'WORKFLOW_NOT_FOUND' || code === 'TEMPLATE_NOT_FOUND'
        ? 404
        : code === 'ACTIVE_PHASE_CLAIM' ||
            code === 'STORE_BUSY' ||
            code === 'WORKFLOW_CONFLICT' ||
            code === 'ILLEGAL_TRANSITION' ||
            code === 'REPLAY_ERROR'
          ? 409
          : code.startsWith('INVALID_') || code.endsWith('_REQUIRED')
            ? 400
            : 500
    const nextCommand =
      typeof errorRecord?.nextCommand === 'string' ? errorRecord.nextCommand : undefined
    const message = errorValue instanceof Error ? errorValue.message : 'Unknown service error'
    void reply.code(statusCode).send({
      code,
      error: statusCode === 500 ? 'Phasewire service error' : message,
      ...(nextCommand === undefined ? {} : { nextCommand }),
    })
  })
}

const sessionCookies = (sessionToken: string, csrfToken: string): readonly string[] => [
  `phasewire_session=${encodeURIComponent(sessionToken)}; HttpOnly; SameSite=Strict; Path=/`,
  `phasewire_csrf=${encodeURIComponent(csrfToken)}; SameSite=Strict; Path=/`,
]

export const buildServiceApp = async (options: BuildAppOptions): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false, trustProxy: false })
  const hub = new UpdateHub()
  const csrfToken = randomBytes(32).toString('base64url')

  registerErrorHandler(app)
  app.addHook('onRequest', async (request, reply) => {
    if (!isAllowedHostHeader(request.headers.host)) {
      await reply.code(403).send({ error: 'Invalid Host header' })
      return
    }
    if (!isAllowedOriginHeader(request.headers.origin)) {
      await reply.code(403).send({ error: 'Invalid Origin header' })
      return
    }
    if (request.url.startsWith('/api/') && !isAuthenticatedRequest(request, options.token)) {
      await reply.header('www-authenticate', 'Bearer').code(401).send({ error: 'Authentication required' })
      return
    }
    if (
      request.url.startsWith('/api/') &&
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      request.method !== 'OPTIONS' &&
      !isHarnessAuthenticatedRequest(request, options.token) &&
      !isInteractiveRequest(request, options.token, csrfToken)
    ) {
      await reply.code(403).send({ error: 'Unsafe cookie request requires exact Origin and CSRF capability' })
    }
  })

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff')
    reply.header('referrer-policy', 'no-referrer')
    reply.header('cross-origin-resource-policy', 'same-origin')
    reply.header('x-frame-options', 'DENY')
    reply.header(
      'content-security-policy',
      "default-src 'self'; connect-src 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    )
    return payload
  })

  app.get<{ Querystring: { token?: string; workflow?: string } }>('/session', (request, reply) => {
    if (request.query.token === undefined || !tokensMatch(request.query.token, options.token)) {
      return reply.code(401).send({ error: 'Invalid session token' })
    }
    const fragment =
      request.query.workflow === undefined ? '' : `#workflow=${encodeURIComponent(request.query.workflow)}`
    return reply
      .header('set-cookie', sessionCookies(options.token, csrfToken))
      .header('cache-control', 'no-store')
      .redirect(`/${fragment}`)
  })

  registerApiRoutes(app, { core: options.core, csrfToken, sessionToken: options.token }, hub)
  app.addHook('onClose', () => hub.close())
  watchWorkflowEvents(app, options.core, hub, options.projectRoot)
  await registerStaticWorkbench(app, options.webRoot)
  return app
}

export { actionNames }
