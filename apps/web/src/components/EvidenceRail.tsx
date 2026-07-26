import type { PhaseId, WorkflowProjection } from '../types'
import { StatusBadge } from './StatusBadge'

interface EvidenceRailProps {
  workflow: WorkflowProjection
  selectedPhase: PhaseId
}

export function EvidenceRail({ workflow, selectedPhase }: EvidenceRailProps) {
  const phase = workflow.phases.find((item) => item.id === selectedPhase) ?? workflow.phases[0]

  if (phase === undefined) {
    return null
  }

  return (
    <aside className="evidence-rail" aria-labelledby="evidence-title">
      <div className="evidence-heading">
        <div>
          <p className="section-kicker">Context rail</p>
          <h2 id="evidence-title">Evidence</h2>
        </div>
        <StatusBadge status={phase.status} />
      </div>

      <dl className="phase-properties">
        <div>
          <dt>Phase</dt>
          <dd>{phase.label}</dd>
        </div>
        <div>
          <dt>Harness</dt>
          <dd>{phase.harness}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{phase.owner}</dd>
        </div>
        <div>
          <dt>Cycle</dt>
          <dd>{String(workflow.cycleCount).padStart(2, '0')}</dd>
        </div>
      </dl>

      <div className="evidence-sections">
        <details open>
          <summary data-testid="disclosure-harness-handoff">Harness handoff</summary>
          <ol className="handoff-sequence">
            {workflow.phases.slice(0, 3).map((item) => (
              <li key={item.id}>
                <span>{item.label}</span>
                <strong>{item.harness}</strong>
              </li>
            ))}
          </ol>
        </details>

        <details open>
          <summary data-testid="disclosure-artifacts">Artifacts</summary>
          <ul className="artifact-list">
            {workflow.artifacts.map((artifact) => (
              <li key={artifact.id}>
                <strong>{artifact.label}</strong>
                <code dir="ltr">{artifact.path}</code>
                <small>{artifact.kind}</small>
              </li>
            ))}
          </ul>
        </details>

        <details>
          <summary data-testid="disclosure-validation">Validation</summary>
          <ul className="compact-status-list">
            {workflow.validations.map((validation) => (
              <li key={validation.id}>
                <StatusBadge status={validation.status} />
                <span>{validation.label}</span>
              </li>
            ))}
          </ul>
        </details>

        <details>
          <summary data-testid="disclosure-event-history">Event history</summary>
          <ol className="event-list">
            {workflow.events.map((event) => (
              <li key={event.id}>
                <span aria-hidden="true" />
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.description}</p>
                  <small>
                    {event.harness} ·{' '}
                    <time dateTime={event.at}>
                      {new Intl.DateTimeFormat(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(event.at))}
                    </time>
                  </small>
                </div>
              </li>
            ))}
          </ol>
        </details>
      </div>
    </aside>
  )
}
