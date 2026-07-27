import type { PhaseId, WorkflowProjection } from '../types'
import { StatusShape } from './status-shape'
import type { VisualStatus } from './types'

interface OrientationMapProps {
  workflow: WorkflowProjection
  selectedPhase: PhaseId
  onSelect: (phase: PhaseId) => void
}

function mapStatus(status: WorkflowProjection['phases'][number]['status']): VisualStatus {
  if (status === 'blocked') return 'blocked'
  if (status === 'complete') return 'complete'
  if (status === 'active') return 'active'
  if (status === 'ready') return 'ready'
  return 'queued'
}

export function OrientationMap({ workflow, selectedPhase, onSelect }: OrientationMapProps) {
  const width = 280
  const height = 72
  const step = (width - 32) / Math.max(workflow.phases.length - 1, 1)

  return (
    <section className="orientation-map" aria-label="Workflow orientation" data-testid="orientation-map">
      <div className="orientation-map-copy">
        <p className="section-kicker">Orientation</p>
        <p>
          You are viewing <strong>{selectedPhase}</strong>. Live phase is{' '}
          <strong>{workflow.currentPhase}</strong> in cycle {String(workflow.cycleCount).padStart(2, '0')}.
        </p>
      </div>
      <div className="orientation-map-visual">
        <svg
          className="orientation-map-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-hidden="true"
          focusable="false"
          data-testid="orientation-map-svg"
        >
          <path
            className="orientation-spine"
            d={`M 16 ${height / 2} H ${width - 16}`}
            pathLength={1}
          />
          {workflow.cycleCount > 1 ? (
            <path
              className="orientation-return is-animated"
              d={`M ${16 + step * 2} ${height / 2} C ${16 + step * 2} 12, ${16} 12, 16 ${height / 2}`}
              pathLength={1}
            />
          ) : null}
          {workflow.phases.map((phase, index) => {
            const x = 16 + index * step
            const y = height / 2
            const selected = phase.id === selectedPhase
            const current = phase.id === workflow.currentPhase
            return (
              <g
                key={phase.id}
                className={`orientation-node${selected ? ' is-selected' : ''}${current ? ' is-current' : ''}`}
                transform={`translate(${x} ${y})`}
                data-testid={`orientation-node-${phase.id}`}
              >
                <circle className="orientation-hit" r={16} />
                <StatusShape status={mapStatus(phase.status)} x={0} y={0} size={14} />
                {selected ? <circle className="orientation-ring" r={11} /> : null}
              </g>
            )
          })}
        </svg>
        <div className="orientation-map-controls" role="radiogroup" aria-label="Select report phase">
          {workflow.phases.map((phase) => {
            const selected = phase.id === selectedPhase
            const current = phase.id === workflow.currentPhase
            return (
              <button
                key={phase.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`orientation-phase-button${selected ? ' is-selected' : ''}${current ? ' is-current' : ''}`}
                data-testid={`orientation-phase-${phase.id}`}
                onClick={() => {
                  onSelect(phase.id)
                }}
              >
                <span className="orientation-phase-label">{phase.label}</span>
                <span className="orientation-phase-meta">
                  {current ? 'current' : selected ? 'viewing' : mapStatus(phase.status)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
