import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SEEDED_WORKFLOW } from '../fallback'
import { PhaseSpine } from './PhaseSpine'
import { ReportCanvas } from './ReportCanvas'

const resolveAction = () => Promise.resolve()

describe('Phasewire workbench reports', () => {
  it('renders the semantic planning authority and Return Trace', () => {
    const phaseMarkup = renderToStaticMarkup(
      <PhaseSpine
        phases={SEEDED_WORKFLOW.phases}
        selectedPhase="plan"
        currentPhase={SEEDED_WORKFLOW.currentPhase}
        cycleCount={SEEDED_WORKFLOW.cycleCount}
        blockerCount={2}
        onSelect={() => undefined}
      />,
    )
    const reportMarkup = renderToStaticMarkup(
      <ReportCanvas
        workflow={SEEDED_WORKFLOW}
        selectedPhase="plan"
        readOnly
        actionPending={false}
        onDecision={resolveAction}
        onApprovePlan={resolveAction}
        onAnnotation={resolveAction}
        onAuthorize={resolveAction}
      />,
    )

    expect(phaseMarkup).toContain('aria-label="Workflow phases"')
    expect(phaseMarkup).toContain('Review returned to Plan')
    expect(phaseMarkup).toContain('<svg')
    expect(phaseMarkup).toContain('aria-current="step"')
    expect(phaseMarkup).toContain('aria-pressed="true"')
    expect(phaseMarkup).toContain('aria-controls="main-report"')
    expect(reportMarkup).toContain('Now')
    expect(reportMarkup).toContain('Why')
    expect(reportMarkup).toContain('Next')
    expect(reportMarkup).toContain('Material decision')
    expect(reportMarkup).toContain('Human context')
    expect(reportMarkup).toContain('data-testid="approve-plan"')
    expect(reportMarkup).toContain('<bdi dir="ltr"')
    expect(reportMarkup).toContain('Resolve every material decision before approving this plan.')
  })

  it('distinguishes blocking review evidence from improvements', () => {
    const markup = renderToStaticMarkup(
      <ReportCanvas
        workflow={SEEDED_WORKFLOW}
        selectedPhase="review"
        readOnly
        actionPending={false}
        onDecision={resolveAction}
        onApprovePlan={resolveAction}
        onAnnotation={resolveAction}
        onAuthorize={resolveAction}
      />,
    )

    expect(markup).toContain('Blocking issues')
    expect(markup).toContain('Non-blocking issues')
    expect(markup).toContain('Improvements')
    expect(markup).toContain('Requires another Plan → Execute → Review cycle.')
  })

  it('keeps deployment authorization separate and unavailable before readiness', () => {
    const markup = renderToStaticMarkup(
      <ReportCanvas
        workflow={SEEDED_WORKFLOW}
        selectedPhase="ready"
        readOnly
        actionPending={false}
        onDecision={resolveAction}
        onApprovePlan={resolveAction}
        onAnnotation={resolveAction}
        onAuthorize={resolveAction}
      />,
    )

    expect(markup).toContain('Deployment readiness withheld')
    expect(markup).toContain('Phasewire never runs a deployment from this gate.')
    expect(markup).toContain('data-testid="authorize-deployment"')
    expect(markup).toContain('disabled=""')
  })
})
