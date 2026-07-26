import { useEffect, useState, type FormEvent } from 'react'

import type { WorkflowDecision } from '../types'
import { errorMessage } from '../utils/errors'
import { StatusBadge } from './StatusBadge'

interface DecisionCardProps {
  decision: WorkflowDecision
  readOnly: boolean
  onSubmit: (decisionId: string, title: string, outcome: string) => Promise<void>
}

function DecisionCard({ decision, readOnly, onSubmit }: DecisionCardProps) {
  const [selection, setSelection] = useState(decision.selectedOptionId ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const errorId = `decision-error-${decision.id}`

  useEffect(() => {
    setSelection(decision.selectedOptionId ?? '')
    setSubmitError(null)
  }, [decision.selectedOptionId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selection.length === 0) {
      return
    }
    const option = decision.options.find((candidate) => candidate.id === selection)
    if (option === undefined) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(decision.id, decision.title, option.label)
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="decision-card"
      data-testid={`decision-card-${decision.id}`}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <div className="report-section-heading">
        <div>
          <p className="section-kicker">Material decision</p>
          <h3>{decision.title}</h3>
        </div>
        {decision.selectedOptionId === null ? (
          <StatusBadge status="pending" label="Approval needed" />
        ) : (
          <StatusBadge status="complete" label="Recorded" />
        )}
      </div>
      <p className="decision-context">{decision.context}</p>
      <fieldset disabled={submitting || readOnly} aria-describedby={submitError === null ? undefined : errorId}>
        <legend className="sr-only">Select an option for {decision.title}</legend>
        <div className="decision-options">
          {decision.options.map((option) => (
            <label className="decision-option" key={option.id}>
              <input
                type="radio"
                name={decision.id}
                value={option.id}
                checked={selection === option.id}
                data-testid={`decision-${decision.id}-${option.id}`}
                onChange={() => {
                  setSelection(option.id)
                }}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.summary}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {submitError === null ? null : (
        <p className="form-error" id={errorId} role="alert">
          Decision was not recorded: {submitError}
        </p>
      )}
      <div className="decision-actions">
        <p>
          {readOnly
            ? 'Connect the local service to persist this decision.'
            : 'The selected option is appended to the workflow event history.'}
        </p>
        <button
          className="primary-button"
          type="submit"
          disabled={selection.length === 0 || submitting || readOnly}
          data-testid={`submit-decision-${decision.id}`}
        >
          {submitting ? 'Recording…' : 'Record decision'}
        </button>
      </div>
    </form>
  )
}

interface DecisionComposerProps {
  readOnly: boolean
  onSubmit: (decisionId: string, title: string, outcome: string) => Promise<void>
}

function DecisionComposer({ readOnly, onSubmit }: DecisionComposerProps) {
  const [title, setTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const errorId = 'decision-composer-error'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanTitle = title.trim()
    const cleanOutcome = outcome.trim()
    if (cleanTitle.length === 0 || cleanOutcome.length === 0) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(crypto.randomUUID(), cleanTitle, cleanOutcome)
      setTitle('')
      setOutcome('')
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="decision-composer" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="section-kicker">Record an outcome</p>
        <h3>Add decision</h3>
      </div>
      <label htmlFor="decision-title">
        Decision
        <input
          id="decision-title"
          type="text"
          value={title}
          disabled={readOnly || submitting}
          aria-describedby={submitError === null ? undefined : errorId}
          data-testid="decision-title-input"
          onChange={(event) => {
            setTitle(event.target.value)
          }}
        />
      </label>
      <label htmlFor="decision-outcome">
        Recorded outcome
        <textarea
          id="decision-outcome"
          rows={3}
          value={outcome}
          disabled={readOnly || submitting}
          aria-describedby={submitError === null ? undefined : errorId}
          data-testid="decision-outcome-input"
          onChange={(event) => {
            setOutcome(event.target.value)
          }}
        />
      </label>
      {submitError === null ? null : (
        <p className="form-error" id={errorId} role="alert">
          Decision was not recorded: {submitError}
        </p>
      )}
      <div className="decision-actions">
        <p>
          {readOnly
            ? 'Connect the local service to record a decision.'
            : 'The outcome is appended to the portable workflow history.'}
        </p>
        <button
          className="primary-button"
          type="submit"
          disabled={readOnly || submitting || title.trim().length === 0 || outcome.trim().length === 0}
          data-testid="record-new-decision"
        >
          {submitting ? 'Recording…' : 'Record outcome'}
        </button>
      </div>
    </form>
  )
}

interface DecisionPanelProps {
  decisions: WorkflowDecision[]
  planApproved: boolean
  readOnly: boolean
  actionPending: boolean
  onSubmit: (decisionId: string, title: string, outcome: string) => Promise<void>
  onApprove: () => Promise<void>
}

export function DecisionPanel({
  decisions,
  planApproved,
  readOnly,
  actionPending,
  onSubmit,
  onApprove,
}: DecisionPanelProps) {
  const openDecisionCount = decisions.filter((decision) => decision.selectedOptionId === null).length
  const [approvalError, setApprovalError] = useState<string | null>(null)

  async function handleApprove() {
    setApprovalError(null)
    try {
      await onApprove()
    } catch (error) {
      setApprovalError(errorMessage(error))
    }
  }

  return (
    <section className="report-section" aria-labelledby="decisions-title">
      <div className="report-section-heading">
        <div>
          <p className="section-kicker">Plan evidence</p>
          <h2 id="decisions-title">Decisions</h2>
        </div>
        <p>{openDecisionCount} open</p>
      </div>
      <div className="decision-list">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            readOnly={readOnly}
            onSubmit={onSubmit}
          />
        ))}
        <DecisionComposer readOnly={readOnly} onSubmit={onSubmit} />
      </div>
      <div className="plan-approval-gate" aria-labelledby="plan-approval-title">
        <div>
          <p className="section-kicker">Explicit gate</p>
          <h3 id="plan-approval-title">
            {planApproved ? 'Plan approved' : 'Approve the complete plan'}
          </h3>
          <p>
            {planApproved
              ? 'Approval is preserved in the immutable workflow history.'
              : openDecisionCount > 0
                ? 'Resolve every material decision before approving this plan.'
                : 'Approval unlocks execution but does not start it.'}
          </p>
          {approvalError === null ? null : (
            <p className="form-error" id="plan-approval-error" role="alert">
              Plan approval failed: {approvalError}
            </p>
          )}
        </div>
        <button
          className="primary-button"
          type="button"
          data-testid="approve-plan"
          aria-describedby={approvalError === null ? undefined : 'plan-approval-error'}
          disabled={readOnly || actionPending || planApproved || openDecisionCount > 0}
          onClick={() => void handleApprove()}
        >
          {planApproved ? 'Approved' : actionPending ? 'Recording…' : 'Approve plan'}
        </button>
      </div>
    </section>
  )
}
