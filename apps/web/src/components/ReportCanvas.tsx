import type { PhaseId, WorkflowProjection } from '../types'
import { OrientationMap, WorkflowDiagrams } from '../visuals'
import { Annotations } from './Annotations'
import { DecisionPanel } from './DecisionPanel'
import { DeploymentGate } from './DeploymentGate'
import { ExecutionReport } from './ExecutionReport'
import { ReviewFindings } from './ReviewFindings'
import { StatusBadge } from './StatusBadge'

interface ReportCanvasProps {
  workflow: WorkflowProjection
  selectedPhase: PhaseId
  readOnly: boolean
  actionPending: boolean
  onDecision: (decisionId: string, title: string, outcome: string) => Promise<void>
  onApprovePlan: () => Promise<void>
  onAnnotation: (body: string) => Promise<void>
  onAuthorize: () => Promise<void>
  onSelectPhase: (phase: PhaseId) => void
}

export function ReportCanvas({
  workflow,
  selectedPhase,
  readOnly,
  actionPending,
  onDecision,
  onApprovePlan,
  onAnnotation,
  onAuthorize,
  onSelectPhase,
}: ReportCanvasProps) {
  const phase = workflow.phases.find((item) => item.id === selectedPhase) ?? workflow.phases[0]
  const narrative = workflow.narratives[selectedPhase]

  if (phase === undefined) {
    return null
  }

  return (
    <article className="report-canvas" aria-labelledby="report-title" data-testid="report-canvas">
      <header className="report-header">
        <div className="report-identity">
          <p className="report-breadcrumb" dir="ltr">
            <bdi dir="ltr">{workflow.workflowId}</bdi>
            <span aria-hidden="true">/</span>
            <bdi dir="ltr">cycle-{String(workflow.cycleCount).padStart(2, '0')}</bdi>
            <span aria-hidden="true">/</span>
            <bdi dir="ltr">{selectedPhase}</bdi>
          </p>
          <h1 id="report-title" data-testid="report-title">
            {phase.label} report
          </h1>
          <p className="report-summary">{phase.summary}</p>
        </div>
        <StatusBadge status={phase.status} />
      </header>

      <OrientationMap
        workflow={workflow}
        selectedPhase={selectedPhase}
        onSelect={onSelectPhase}
      />

      <section className="now-why-next" aria-labelledby="phase-summary-title">
        <h2 id="phase-summary-title" className="sr-only">
          Phase summary
        </h2>
        <div>
          <span className="summary-index" aria-hidden="true">
            01
          </span>
          <h3>Now</h3>
          <p>{narrative.now}</p>
        </div>
        <div>
          <span className="summary-index" aria-hidden="true">
            02
          </span>
          <h3>Why</h3>
          <p>{narrative.why}</p>
        </div>
        <div>
          <span className="summary-index" aria-hidden="true">
            03
          </span>
          <h3>Next</h3>
          <p>{narrative.next}</p>
        </div>
      </section>

      <WorkflowDiagrams
        workflow={workflow}
        selectedPhase={selectedPhase}
        onSelectPhase={onSelectPhase}
      />

      <section className="report-section" aria-labelledby="cycle-history-title">
        <div className="report-section-heading">
          <div>
            <p className="section-kicker">Persistent history</p>
            <h2 id="cycle-history-title">Cycle history</h2>
          </div>
          <p>{workflow.cycles.length} cycles</p>
        </div>
        <ol className="cycle-history">
          {workflow.cycles.map((cycle) => (
            <li key={cycle.number} data-state={cycle.status}>
              <span className="cycle-index">{String(cycle.number).padStart(2, '0')}</span>
              <div>
                <strong>{cycle.label}</strong>
                <p>{cycle.summary}</p>
              </div>
              <StatusBadge status={cycle.status === 'active' ? 'active' : 'complete'} />
            </li>
          ))}
        </ol>
      </section>

      {selectedPhase === 'plan' ? (
        <DecisionPanel
          decisions={workflow.decisions}
          planApproved={workflow.planApproved}
          readOnly={readOnly}
          actionPending={actionPending}
          onSubmit={onDecision}
          onApprove={onApprovePlan}
        />
      ) : null}

      {selectedPhase === 'execute' ? (
        <ExecutionReport changes={workflow.executionChanges} resolution={workflow.issueResolution} />
      ) : null}

      {selectedPhase === 'review' ? <ReviewFindings findings={workflow.findings} /> : null}

      {selectedPhase === 'ready' ? (
        <DeploymentGate
          ready={workflow.deploymentReady}
          authorized={workflow.deploymentAuthorized}
          validations={workflow.validations}
          readOnly={readOnly}
          actionPending={actionPending}
          onAuthorize={onAuthorize}
        />
      ) : null}

      <Annotations annotations={workflow.annotations} readOnly={readOnly} onSubmit={onAnnotation} />
    </article>
  )
}
