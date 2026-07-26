import { useState } from 'react'

import type { ValidationResult } from '../types'
import { errorMessage } from '../utils/errors'
import { StatusBadge } from './StatusBadge'

interface DeploymentGateProps {
  ready: boolean
  authorized: boolean
  validations: ValidationResult[]
  readOnly: boolean
  actionPending: boolean
  onAuthorize: () => Promise<void>
}

export function DeploymentGate({
  ready,
  authorized,
  validations,
  readOnly,
  actionPending,
  onAuthorize,
}: DeploymentGateProps) {
  const blockerCount = validations.filter((validation) => validation.status === 'failed').length
  const [authorizationError, setAuthorizationError] = useState<string | null>(null)

  async function handleAuthorize() {
    setAuthorizationError(null)
    try {
      await onAuthorize()
    } catch (error) {
      setAuthorizationError(errorMessage(error))
    }
  }

  return (
    <section className="report-section deployment-gate" aria-labelledby="deployment-gate-title">
      <div className="gate-summary">
        <div>
          <p className="section-kicker">Explicit user gate</p>
          <h2 id="deployment-gate-title">
            {authorized
              ? 'Deployment authorized'
              : ready
                ? 'Ready for authorization'
                : 'Deployment readiness withheld'}
          </h2>
          <p>
            {ready
              ? 'Review is clear and required validations passed. Authorization records intent; it does not deploy.'
              : `${blockerCount} failed validations and unresolved review evidence prevent readiness.`}
          </p>
        </div>
        <StatusBadge
          status={authorized || ready ? 'ready' : 'blocked'}
          label={authorized ? 'Authorized' : ready ? 'Ready' : 'Not ready'}
        />
      </div>

      <ul className="readiness-checks" aria-label="Deployment readiness checks">
        {validations.map((validation) => (
          <li key={validation.id}>
            <StatusBadge status={validation.status} />
            <span>
              <strong>{validation.label}</strong>
              <small>{validation.detail}</small>
            </span>
          </li>
        ))}
      </ul>

      <div className="gate-action">
        <p>
          Phasewire never runs a deployment from this gate. It appends a user-controlled authorization event only.
        </p>
        {authorizationError === null ? null : (
          <p className="form-error" id="deployment-authorization-error" role="alert">
            Authorization failed: {authorizationError}
          </p>
        )}
        <button
          className="primary-button"
          type="button"
          disabled={!ready || authorized || readOnly || actionPending}
          data-testid="authorize-deployment"
          aria-describedby={authorizationError === null ? undefined : 'deployment-authorization-error'}
          onClick={() => void handleAuthorize()}
        >
          {authorized ? 'Authorization recorded' : actionPending ? 'Recording…' : 'Authorize deployment'}
        </button>
      </div>
    </section>
  )
}
