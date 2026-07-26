import { afterEach, describe, expect, it, vi } from 'vitest'

import { adaptWorkflowProjection, approvePlan, authorizeDeployment, submitDecision } from './api'
import { SEEDED_WORKFLOW } from './fallback'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonRequestBody(request: RequestInit | undefined): unknown {
  if (typeof request?.body !== 'string') {
    throw new Error('Expected a JSON request body.')
  }
  return JSON.parse(request.body) as unknown
}

describe('workflow API projection adapter', () => {
  it('maps a core remediation projection into the visual report model', () => {
    const workflow = adaptWorkflowProjection({
      schemaVersion: 1,
      workflowId: 'wf-live',
      title: 'Repair interrupted ownership',
      templateId: 'software-delivery',
      status: 'remediating',
      currentPhase: 'remediation',
      cycle: 2,
      eventCount: 9,
      lastEventAt: '2026-07-26T12:00:00.000Z',
      logicalClock: 9,
      heads: ['event-9'],
      conflicted: false,
      readOnly: false,
      plan: { proposed: true, approved: true },
      remediation: { proposed: true, approved: true, started: false, completed: false, findingIds: ['finding-1'] },
      execution: { started: true, completed: true, artifactPath: 'reports/execution.md' },
      review: {
        started: true,
        completed: true,
        findings: [
          {
            id: 'finding-1',
            severity: 'blocking',
            title: 'Lease cannot recover',
            detail: 'Terminated owner remains active.',
            openedByEventId: 'event-8',
          },
        ],
      },
      validations: [
        {
          check: 'replay',
          status: 'passed',
          summary: 'Replay is deterministic.',
          eventId: 'event-7',
          logicalClock: 7,
        },
      ],
      decisions: [],
      annotations: [],
      artifacts: [
        { kind: 'execution', path: 'reports/execution.md', eventId: 'event-6' },
      ],
      claims: {
        remediation: {
          owner: { id: 'codex', kind: 'harness', harness: 'Codex' },
        },
      },
      deploymentReadiness: {
        ready: false,
        blockerCodes: ['OPEN_REVIEW_BLOCKERS'],
        requiredValidations: ['replay'],
        passedValidations: ['replay'],
        authorizationRecorded: false,
      },
    })

    expect(workflow).not.toBeNull()
    expect(workflow?.currentPhase).toBe('plan')
    expect(workflow?.cycleCount).toBe(2)
    expect(workflow?.findings[0]?.classification).toBe('blocking')
    expect(workflow?.phases[0]?.harness).toBe('Codex')
    expect(workflow?.validations[0]?.status).toBe('passed')
    expect(workflow?.planApproved).toBe(true)
    expect(workflow?.planApprovalAction).toBe('approve-remediation')
    expect(workflow?.deploymentReady).toBe(false)
  })

  it.each([
    ['approve-plan', approvePlan, { acknowledgedMaterialDecisions: true }],
    ['authorize-deployment', authorizeDeployment, { acknowledgedReadiness: true }],
  ])('sends CSRF and explicit acknowledgement without an actor for %s', async (action, submit, payload) => {
    vi.stubGlobal('document', { cookie: 'phasewire_csrf=csrf%20proof' })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ workflow: SEEDED_WORKFLOW }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await submit('wf-secure')

    const [url, request] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe(`/api/workflows/wf-secure/actions/${action}`)
    expect(new Headers(request?.headers).get('x-phasewire-csrf')).toBe('csrf proof')
    expect(jsonRequestBody(request)).toEqual({ payload })
  })

  it('identifies the web harness for non-privileged workflow actions', async () => {
    vi.stubGlobal('document', { cookie: 'phasewire_csrf=csrf-token' })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ workflow: SEEDED_WORKFLOW }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await submitDecision('wf-secure', 'decision-1', 'Storage', 'SQLite')

    const request = fetchMock.mock.calls[0]?.[1]
    expect(jsonRequestBody(request)).toEqual({
      actor: 'phasewire-web',
      payload: { decisionId: 'decision-1', outcome: 'SQLite', title: 'Storage' },
    })
  })
})
