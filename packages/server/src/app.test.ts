import { scaffoldVisualTemplate } from '@phasewire/core'
import { describe, expect, it, vi } from 'vitest'

import { buildServiceApp } from './app.js'
import type { CoreGateway } from './core-gateway.js'

const fakeCore = (
  performAction: CoreGateway['performAction'] = () =>
    Promise.resolve({ event: { type: 'annotation.recorded' }, workflow: { workflowId: 'wf-1' } }),
): CoreGateway => ({
  appendEvent: () =>
    Promise.resolve({ event: { type: 'annotation.recorded' }, workflow: { workflowId: 'wf-1' } }),
  createHandoff: () => Promise.resolve({ handoffId: 'handoff-1' }),
  doctor: () => Promise.resolve({ ok: true }),
  listHandoffs: () => Promise.resolve([]),
  listWorkflows: () => Promise.resolve([{ workflowId: 'wf-1' }]),
  loadWorkflow: (workflowId) => Promise.resolve({ workflowId }),
  performAction,
  scaffoldTemplate: scaffoldVisualTemplate,
  searchTemplates: () => Promise.resolve([]),
})

const session = async (app: Awaited<ReturnType<typeof buildServiceApp>>) => {
  const response = await app.inject({
    headers: { host: 'localhost:80' },
    method: 'GET',
    url: '/session?token=test-token&workflow=wf-1',
  })
  const setCookies = Array.isArray(response.headers['set-cookie'])
    ? response.headers['set-cookie']
    : [String(response.headers['set-cookie'])]
  const cookies = setCookies.map((cookie) => cookie.split(';', 1)[0]).join('; ')
  const csrfCookie = setCookies.find((cookie) => cookie.startsWith('phasewire_csrf='))
  const csrf = csrfCookie?.split('=', 2)[1]?.split(';', 1)[0]
  if (csrf === undefined) throw new Error('Missing test CSRF cookie')
  return { cookies, csrf, response }
}

describe('local API security', () => {
  it('requires authentication and rejects non-loopback Host headers', async () => {
    const app = await buildServiceApp({ core: fakeCore(), token: 'test-token' })
    try {
      expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(401)
      expect(
        (
          await app.inject({
            headers: { authorization: 'Bearer test-token' },
            method: 'GET',
            url: '/api/health',
          })
        ).statusCode,
      ).toBe(200)
      const secured = await app.inject({
        headers: { authorization: 'Bearer test-token' },
        method: 'GET',
        url: '/api/health',
      })
      expect(secured.headers['x-frame-options']).toBe('DENY')
      expect(secured.headers['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(
        (
          await app.inject({
            headers: { authorization: 'Bearer test-token', host: 'example.com' },
            method: 'GET',
            url: '/api/health',
          })
        ).statusCode,
      ).toBe(403)
    } finally {
      await app.close()
    }
  })

  it('exchanges a launch token for session and CSRF cookies', async () => {
    const app = await buildServiceApp({ core: fakeCore(), token: 'test-token' })
    try {
      const established = await session(app)
      expect(established.response.statusCode).toBe(302)
      expect(established.response.headers.location).toBe('/#workflow=wf-1')
      expect(established.cookies).toContain('phasewire_session=test-token')
      expect(established.cookies).toContain('phasewire_csrf=')
      expect(
        (
          await app.inject({
            headers: { cookie: established.cookies },
            method: 'GET',
            url: '/api/health',
          })
        ).statusCode,
      ).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('blocks cross-port CSRF and body-supplied user actors for approval', async () => {
    const action = vi.fn<CoreGateway['performAction']>(() =>
      Promise.resolve({ event: {}, workflow: { workflowId: 'wf-1' } }),
    )
    const app = await buildServiceApp({ core: fakeCore(action), token: 'test-token' })
    try {
      const established = await session(app)
      const body = { payload: { acknowledgedMaterialDecisions: true } }
      const crossPort = await app.inject({
        body,
        headers: {
          cookie: established.cookies,
          host: 'localhost:80',
          origin: 'http://localhost:9999',
          'x-phasewire-csrf': established.csrf,
        },
        method: 'POST',
        url: '/api/workflows/wf-1/actions/approve-plan',
      })
      expect(crossPort.statusCode).toBe(403)

      const forgedActor = await app.inject({
        body: { actor: 'user', ...body },
        headers: {
          cookie: established.cookies,
          host: 'localhost:80',
          origin: 'http://localhost:80',
          'x-phasewire-csrf': established.csrf,
        },
        method: 'POST',
        url: '/api/workflows/wf-1/actions/approve-plan',
      })
      expect(forgedActor.statusCode).toBe(400)
      expect(action).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('supplies the user actor only after interactive approval checks pass', async () => {
    const action = vi.fn<CoreGateway['performAction']>(() =>
      Promise.resolve({ event: {}, workflow: { workflowId: 'wf-1' } }),
    )
    const app = await buildServiceApp({ core: fakeCore(action), token: 'test-token' })
    try {
      const established = await session(app)
      const response = await app.inject({
        body: { payload: { acknowledgedMaterialDecisions: true } },
        headers: {
          cookie: established.cookies,
          host: 'localhost:80',
          origin: 'http://localhost:80',
          'x-phasewire-csrf': established.csrf,
        },
        method: 'POST',
        url: '/api/workflows/wf-1/actions/approve-plan',
      })
      expect(response.statusCode).toBe(200)
      expect(action).toHaveBeenCalledWith(
        'wf-1',
        'approve-plan',
        expect.objectContaining({ actor: 'user' }),
      )
    } finally {
      await app.close()
    }
  })

  it('rejects structural events on the generic event endpoint', async () => {
    const appendEvent = vi.fn<CoreGateway['appendEvent']>(() =>
      Promise.resolve({ event: {}, workflow: { workflowId: 'wf-1' } }),
    )
    const core = { ...fakeCore(), appendEvent }
    const app = await buildServiceApp({ core, token: 'test-token' })
    try {
      const response = await app.inject({
        body: { actor: 'other', payload: { handoffId: 'unsafe' }, type: 'handoff.created' },
        headers: { authorization: 'Bearer test-token' },
        method: 'POST',
        url: '/api/workflows/wf-1/events',
      })
      expect(response.statusCode).toBe(403)
      expect(appendEvent).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('exposes validated template scaffolding without writing an arbitrary path', async () => {
    const app = await buildServiceApp({ core: fakeCore(), token: 'test-token' })
    try {
      const response = await app.inject({
        body: {
          id: 'project.review',
          name: 'Project Review',
          description: 'Review evidence and findings.',
          primaryBinding: 'review.findings',
          primaryKind: 'list',
        },
        headers: { authorization: 'Bearer test-token' },
        method: 'POST',
        url: '/api/templates/scaffold',
      })
      expect(response.statusCode).toBe(200)
      const body: unknown = response.json()
      if (typeof body !== 'object' || body === null || !('template' in body)) {
        throw new Error('Template scaffold response is invalid')
      }
      const template = body.template
      if (typeof template !== 'object' || template === null) {
        throw new Error('Template scaffold is missing')
      }
      expect(template).toMatchObject({ id: 'project.review', version: '1.0.0' })
      expect('integrity' in template ? template.integrity : undefined).toMatch(
        /^sha256:[a-f0-9]{64}$/u,
      )
    } finally {
      await app.close()
    }
  })
})
