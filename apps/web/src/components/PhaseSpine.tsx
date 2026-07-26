import type { PhaseId, PhaseRecord } from '../types'
import { ReturnTrace } from './ReturnTrace'
import { StatusBadge } from './StatusBadge'

interface PhaseSpineProps {
  phases: PhaseRecord[]
  selectedPhase: PhaseId
  currentPhase: PhaseId
  cycleCount: number
  blockerCount: number
  onSelect: (phase: PhaseId) => void
}

export function PhaseSpine({
  phases,
  selectedPhase,
  currentPhase,
  cycleCount,
  blockerCount,
  onSelect,
}: PhaseSpineProps) {
  return (
    <nav className="phase-spine" aria-label="Workflow phases">
      <div className="phase-spine-heading">
        <p className="section-kicker">Workflow</p>
        <p className="cycle-number">Cycle {String(cycleCount).padStart(2, '0')}</p>
      </div>
      <ol className="phase-list">
        {phases.map((phase, index) => (
          <li key={phase.id} className="phase-item">
            <button
              className="phase-button"
              type="button"
              aria-current={currentPhase === phase.id ? 'step' : undefined}
              aria-pressed={selectedPhase === phase.id}
              aria-controls="main-report"
              data-testid={`phase-${phase.id}`}
              onClick={() => {
                onSelect(phase.id)
              }}
            >
              <span className="phase-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="phase-button-copy">
                <strong>{phase.label}</strong>
                <small>{phase.harness}</small>
              </span>
              <StatusBadge status={phase.status} />
            </button>
          </li>
        ))}
      </ol>
      <ReturnTrace cycleCount={cycleCount} blockerCount={blockerCount} />
    </nav>
  )
}
