import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  approvePlan,
  authorizeDeployment,
  loadCurrentWorkflow,
  submitAnnotation,
  submitDecision,
  subscribeToWorkflowUpdates,
} from './api'
import { EvidenceRail } from './components/EvidenceRail'
import { PhaseSpine } from './components/PhaseSpine'
import { ReportCanvas } from './components/ReportCanvas'
import { StatusBadge } from './components/StatusBadge'
import { SEEDED_WORKFLOW } from './fallback'
import type { ApiConnectionState, PhaseId, WorkflowProjection } from './types'

function connectionLabel(state: ApiConnectionState): string {
  const labels: Record<ApiConnectionState, string> = {
    connecting: 'Connecting',
    live: 'Live project state',
    stale: 'Live updates paused',
    fallback: 'Seeded offline view',
  }
  return labels[state]
}

export default function App() {
  const [workflow, setWorkflow] = useState<WorkflowProjection>(SEEDED_WORKFLOW)
  const [selectedPhase, setSelectedPhase] = useState<PhaseId>(SEEDED_WORKFLOW.currentPhase)
  const [connection, setConnection] = useState<ApiConnectionState>('connecting')
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('Connecting to the local Phasewire service.')

  const blockerCount = useMemo(
    () => workflow.findings.filter((finding) => finding.classification === 'blocking').length,
    [workflow.findings],
  )

  const connect = useCallback(async (signal?: AbortSignal) => {
    setConnection('connecting')
    try {
      const projection = await loadCurrentWorkflow(signal)
      setWorkflow(projection)
      setSelectedPhase(projection.currentPhase)
      setConnection('live')
      setActionError(null)
      setAnnouncement('Live project workflow loaded.')
      return projection
    } catch (error) {
      if (signal?.aborted === true) {
        return null
      }
      setWorkflow(SEEDED_WORKFLOW)
      setSelectedPhase(SEEDED_WORKFLOW.currentPhase)
      setConnection('fallback')
      setAnnouncement(
        `Local service unavailable. Showing a read-only seeded workflow. ${error instanceof Error ? error.message : ''}`,
      )
      return null
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let stream: EventSource | null = null

    void connect(controller.signal).then((projection) => {
      if (projection === null || controller.signal.aborted) {
        return
      }

      stream = subscribeToWorkflowUpdates(
        (updatedWorkflow) => {
          setWorkflow(updatedWorkflow)
          setConnection('live')
          setActionError(null)
          setAnnouncement('Workflow updated from the local service.')
        },
        () => {
          setConnection((current) => (current === 'fallback' ? current : 'stale'))
          setAnnouncement('Live workflow updates paused. Refresh to reconnect to the local service.')
        },
      )
    })

    return () => {
      controller.abort()
      stream?.close()
    }
  }, [connect])

  async function runAction(
    action: () => Promise<WorkflowProjection>,
    successMessage: string,
  ): Promise<WorkflowProjection> {
    setActionPending(true)
    setActionError(null)
    try {
      const projection = await action()
      setWorkflow(projection)
      setConnection('live')
      setAnnouncement(successMessage)
      return projection
    } catch (error) {
      const actionFailure = error instanceof Error ? error : new Error('The workflow action failed.')
      setActionError(actionFailure.message)
      setAnnouncement(`Workflow action failed. ${actionFailure.message}`)
      throw actionFailure
    } finally {
      setActionPending(false)
    }
  }

  async function handleDecision(decisionId: string, title: string, outcome: string) {
    await runAction(
      () => submitDecision(workflow.workflowId, decisionId, title, outcome),
      'Decision recorded in workflow history.',
    )
  }

  async function handleAnnotation(body: string) {
    await runAction(
      () => submitAnnotation(workflow.workflowId, body),
      'Annotation added for the next harness.',
    )
  }

  async function handleAuthorize() {
    await runAction(
      () => authorizeDeployment(workflow.workflowId),
      'Deployment authorization recorded. No deployment was started.',
    )
  }

  async function handleApprovePlan() {
    await runAction(
      () => approvePlan(workflow.workflowId, workflow.planApprovalAction),
      workflow.planApprovalAction === 'approve-remediation'
        ? 'Remediation plan approved. Remediation execution is now available.'
        : 'Plan approved. Execution is now available.',
    )
  }

  const readOnly = connection === 'fallback'

  const handleSelectPhase = useCallback((phase: PhaseId) => {
    setSelectedPhase(phase)
    const phaseLabel = workflow.phases.find((candidate) => candidate.id === phase)?.label ?? phase
    setAnnouncement(`Viewing ${phaseLabel} report.`)
    window.requestAnimationFrame(() => {
      document.getElementById('main-report')?.focus()
    })
  }, [workflow.phases])

  return (
    <div className="app-shell" dir={direction} data-testid="app-shell">
      <a className="skip-link" href="#main-report">
        Skip to report
      </a>
      <header className="app-header">
        <div className="brand-lockup" aria-label="Phasewire">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>Phasewire</strong>
        </div>
        <details className="workflow-title" data-testid="workflow-title-disclosure">
          <summary data-testid="workflow-title-toggle">
            <span>Active workflow</span>
            <strong>{workflow.title}</strong>
          </summary>
          <p>{workflow.objective}</p>
        </details>
        <div className="header-actions">
          <span className="connection-status" data-state={connection}>
            <span aria-hidden="true" />
            {connectionLabel(connection)}
          </span>
          <button
            className="text-button"
            type="button"
            data-testid="direction-toggle"
            aria-label={`Switch to ${direction === 'ltr' ? 'right-to-left' : 'left-to-right'} layout`}
            onClick={() => {
              setDirection((current) => (current === 'ltr' ? 'rtl' : 'ltr'))
            }}
          >
            {direction === 'ltr' ? 'RTL' : 'LTR'}
          </button>
          <button
            className="secondary-button refresh-button"
            type="button"
            data-testid="refresh-workflow"
            onClick={() => void connect()}
          >
            Refresh
          </button>
        </div>
      </header>

      {connection === 'fallback' ? (
        <div className="offline-banner" role="status" data-testid="offline-banner">
          <StatusBadge status="unverified" label="Seeded data" />
          <p>The local API is unavailable. This view is useful for orientation but cannot persist actions.</p>
        </div>
      ) : null}

      {connection === 'stale' ? (
        <div className="stale-banner" role="status" data-testid="stale-banner">
          Live updates paused. Refresh to reconnect; the last confirmed workflow remains visible.
        </div>
      ) : null}

      {actionError === null ? null : (
        <div className="action-error-banner" role="alert" data-testid="action-error">
          Action failed: {actionError}
        </div>
      )}

      <div className="workbench">
        <PhaseSpine
          phases={workflow.phases}
          selectedPhase={selectedPhase}
          currentPhase={workflow.currentPhase}
          cycleCount={workflow.cycleCount}
          blockerCount={blockerCount}
          onSelect={handleSelectPhase}
        />
        <main id="main-report" tabIndex={-1}>
          <ReportCanvas
            workflow={workflow}
            selectedPhase={selectedPhase}
            readOnly={readOnly}
            actionPending={actionPending}
            onDecision={handleDecision}
            onApprovePlan={handleApprovePlan}
            onAnnotation={handleAnnotation}
            onAuthorize={handleAuthorize}
          />
        </main>
        <EvidenceRail workflow={workflow} selectedPhase={selectedPhase} />
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true" data-testid="live-announcement">
        {announcement}
      </p>
    </div>
  )
}
