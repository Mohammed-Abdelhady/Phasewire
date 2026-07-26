import { useState, type FormEvent } from 'react'

import type { WorkflowAnnotation } from '../types'
import { errorMessage } from '../utils/errors'

interface AnnotationsProps {
  annotations: WorkflowAnnotation[]
  readOnly: boolean
  onSubmit: (body: string) => Promise<void>
}

export function Annotations({ annotations, readOnly, onSubmit }: AnnotationsProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = body.trim()
    if (value.length === 0) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(value)
      setBody('')
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="report-section" aria-labelledby="annotations-title">
      <div className="report-section-heading">
        <div>
          <p className="section-kicker">Human context</p>
          <h2 id="annotations-title">Annotations</h2>
        </div>
        <p>{annotations.length} recorded</p>
      </div>
      <ol className="annotation-list">
        {annotations.map((annotation) => (
          <li key={annotation.id}>
            <blockquote>{annotation.body}</blockquote>
            <p>
              <strong>{annotation.author}</strong>
              <span>{annotation.harness}</span>
              <time dateTime={annotation.createdAt}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(annotation.createdAt))}
              </time>
            </p>
          </li>
        ))}
      </ol>
      <form className="annotation-form" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="annotation-body">Add context for the next harness</label>
        <textarea
          id="annotation-body"
          rows={3}
          value={body}
          disabled={readOnly || submitting}
          aria-describedby={submitError === null ? undefined : 'annotation-error'}
          data-testid="annotation-input"
          onChange={(event) => {
            setBody(event.target.value)
          }}
        />
        {submitError === null ? null : (
          <p className="form-error" id="annotation-error" role="alert">
            Annotation was not added: {submitError}
          </p>
        )}
        <div>
          <p>{readOnly ? 'Connect the local service to persist annotations.' : 'Appended to workflow history.'}</p>
          <button
            className="secondary-button"
            type="submit"
            disabled={readOnly || submitting || body.trim().length === 0}
            data-testid="submit-annotation"
          >
            {submitting ? 'Adding…' : 'Add annotation'}
          </button>
        </div>
      </form>
    </section>
  )
}
