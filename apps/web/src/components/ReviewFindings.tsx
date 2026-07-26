import type { ReviewFinding } from '../types'
import { StatusBadge } from './StatusBadge'

interface FindingGroupProps {
  id: string
  title: string
  description: string
  findings: ReviewFinding[]
}

function FindingGroup({ id, title, description, findings }: FindingGroupProps) {
  return (
    <section className="finding-group" aria-labelledby={id}>
      <div className="finding-group-heading">
        <div>
          <h3 id={id}>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="finding-count" aria-label={`${findings.length} findings`}>
          {String(findings.length).padStart(2, '0')}
        </span>
      </div>
      {findings.length === 0 ? (
        <p className="empty-message">No findings in this category.</p>
      ) : (
        <div className="finding-list">
          {findings.map((finding) => (
            <details className="finding-card" key={finding.id} open={finding.severity === 'blocking'}>
              <summary data-testid={`disclosure-finding-${finding.id}`}>
                <span>
                  <strong>{finding.title}</strong>
                  <small>{finding.component}</small>
                </span>
                <StatusBadge status={finding.severity} />
              </summary>
              <dl className="finding-evidence">
                <div>
                  <dt>Evidence</dt>
                  <dd>{finding.evidence}</dd>
                </div>
                <div>
                  <dt>Root cause</dt>
                  <dd>{finding.rootCause}</dd>
                </div>
                <div>
                  <dt>Resolution</dt>
                  <dd>{finding.resolution}</dd>
                </div>
                <div>
                  <dt>Workflow impact</dt>
                  <dd>
                    {finding.requiresCycle
                      ? 'Requires another Plan → Execute → Review cycle.'
                      : 'Can be addressed without reopening the workflow loop.'}
                  </dd>
                </div>
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}

interface ReviewFindingsProps {
  findings: ReviewFinding[]
}

export function ReviewFindings({ findings }: ReviewFindingsProps) {
  const blocking = findings.filter((finding) => finding.classification === 'blocking')
  const nonBlocking = findings.filter((finding) => finding.classification === 'non-blocking')
  const improvements = findings.filter((finding) => finding.classification === 'improvement')

  return (
    <section className="report-section" aria-labelledby="review-findings-title">
      <div className="report-section-heading">
        <div>
          <p className="section-kicker">Review report</p>
          <h2 id="review-findings-title">Findings</h2>
        </div>
        <StatusBadge
          status={blocking.length > 0 ? 'blocking' : 'passed'}
          label={blocking.length > 0 ? `${blocking.length} blocking` : 'No blockers'}
        />
      </div>
      <div className="finding-groups">
        <FindingGroup
          id="blocking-findings"
          title="Blocking issues"
          description="Prevent readiness and open a remediation cycle."
          findings={blocking}
        />
        <FindingGroup
          id="non-blocking-findings"
          title="Non-blocking issues"
          description="Should be resolved, but do not stop the current gate."
          findings={nonBlocking}
        />
        <FindingGroup
          id="improvement-findings"
          title="Improvements"
          description="Useful follow-up work with no current gate impact."
          findings={improvements}
        />
      </div>
    </section>
  )
}
