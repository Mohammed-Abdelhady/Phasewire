import type { FindingSeverity, PhaseStatus, ValidationStatus } from '../types'

type StatusValue = FindingSeverity | PhaseStatus | ValidationStatus

const STATUS_LABELS: Record<StatusValue, string> = {
  active: 'Active',
  blocked: 'Blocked',
  blocking: 'Blocking',
  complete: 'Complete',
  failed: 'Failed',
  high: 'High',
  info: 'Information',
  low: 'Low',
  medium: 'Medium',
  passed: 'Passed',
  pending: 'Pending',
  queued: 'Queued',
  ready: 'Ready',
  unverified: 'Unverified',
}

function semanticTone(status: StatusValue): string {
  if (status === 'blocking' || status === 'blocked' || status === 'failed') {
    return 'blocking'
  }
  if (status === 'high' || status === 'medium' || status === 'pending') {
    return 'risk'
  }
  if (status === 'active') {
    return 'active'
  }
  if (status === 'complete' || status === 'passed' || status === 'ready') {
    return 'verified'
  }
  return 'neutral'
}

interface StatusBadgeProps {
  status: StatusValue
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const tone = semanticTone(status)

  return (
    <span className="status-badge" data-tone={tone}>
      <span className="status-shape" aria-hidden="true" />
      {label ?? STATUS_LABELS[status]}
    </span>
  )
}
