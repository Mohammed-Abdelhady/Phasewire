import type { ExecutionChange, IssueResolution } from '../types'
import { StatusBadge } from './StatusBadge'

interface ExecutionReportProps {
  changes: ExecutionChange[]
  resolution: IssueResolution
}

export function ExecutionReport({ changes, resolution }: ExecutionReportProps) {
  const resolutionSteps = [
    { label: 'Problem', value: resolution.problem },
    { label: 'Root cause', value: resolution.rootCause },
    { label: 'Candidate solutions', value: resolution.candidates.join(' · ') },
    { label: 'Selected solution', value: resolution.selected },
    { label: 'Implementation', value: resolution.implementation },
    { label: 'Validation', value: resolution.validation },
  ]

  return (
    <>
      <section className="report-section" aria-labelledby="change-map-title">
        <div className="report-section-heading">
          <div>
            <p className="section-kicker">Execution report</p>
            <h2 id="change-map-title">Change map</h2>
          </div>
          <StatusBadge status="complete" label={`${changes.length} files recorded`} />
        </div>
        <ul className="change-map">
          {changes.map((change) => (
            <li key={change.path}>
              <code dir="ltr">{change.path}</code>
              <p>{change.summary}</p>
              <span className="change-kind">{change.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="report-section" aria-labelledby="resolution-title">
        <div className="report-section-heading">
          <div>
            <p className="section-kicker">Decision trail</p>
            <h2 id="resolution-title">Issue resolution</h2>
          </div>
        </div>
        <ol className="resolution-flow">
          {resolutionSteps.map((step, index) => (
            <li key={step.label}>
              <span className="flow-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{step.label}</h3>
                <p>{step.value}</p>
                {step.label === 'Selected solution' ? (
                  <small className="selection-rationale">Why: {resolution.why}</small>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
