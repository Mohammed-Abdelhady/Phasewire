import type { VisualStatus } from './types'

interface StatusShapeProps {
  status: VisualStatus
  x: number
  y: number
  size?: number
}

/** Non-color status cue shapes required by the report design system. */
export function StatusShape({ status, x, y, size = 12 }: StatusShapeProps) {
  const r = size / 2
  switch (status) {
    case 'blocked':
      return (
        <polygon
          className="visual-status-shape is-blocked"
          points={`${x},${y - r} ${x + r},${y - r / 2} ${x + r},${y + r / 2} ${x},${y + r} ${x - r},${y + r / 2} ${x - r},${y - r / 2}`}
        />
      )
    case 'risk':
      return (
        <polygon
          className="visual-status-shape is-risk"
          points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`}
        />
      )
    case 'complete':
    case 'verified':
    case 'ready':
      return (
        <g className={`visual-status-shape is-${status}`}>
          <circle cx={x} cy={y} r={r} />
          <path d={`M ${x - 3} ${y} L ${x - 1} ${y + 2.5} L ${x + 3.5} ${y - 2}`} />
        </g>
      )
    case 'active':
      return <circle className="visual-status-shape is-active" cx={x} cy={y} r={r} />
    default:
      return (
        <rect
          className="visual-status-shape is-queued"
          x={x - r}
          y={y - r}
          width={size}
          height={size}
          rx={2}
        />
      )
  }
}
