import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react'

import { connectedIds, layoutGraph, neighborsOf } from './geometry'
import { StatusShape } from './status-shape'
import type { GraphModel, LayoutMode, RelationKind, VisualStatus } from './types'

interface InteractiveGraphProps {
  model: GraphModel
  mode?: LayoutMode
  title: string
  description: string
  selectedId?: string
  onSelect?: (id: string) => void
  testId?: string
}

const RELATION_LABEL: Record<RelationKind, string> = {
  sequence: 'then',
  'depends-on': 'depends on',
  blocks: 'blocks',
  resolves: 'resolves',
  'evidence-for': 'evidence',
  return: 'returns to',
  handoff: 'handoff',
  'parent-child': 'contains',
}

function statusLabel(status: VisualStatus): string {
  const labels: Record<VisualStatus, string> = {
    active: 'Active',
    blocked: 'Blocking',
    complete: 'Complete',
    queued: 'Queued',
    ready: 'Ready',
    risk: 'Risk',
    verified: 'Verified',
    unverified: 'Unverified',
  }
  return labels[status]
}

export function InteractiveGraph({
  model,
  mode = 'adaptive',
  title,
  description,
  selectedId,
  onSelect,
  testId = 'interactive-graph',
}: InteractiveGraphProps) {
  const titleId = useId()
  const descId = useId()
  const [internalFocus, setInternalFocus] = useState<string | undefined>(
    selectedId ?? model.focusId ?? model.nodes[0]?.id,
  )
  const focusId = selectedId ?? internalFocus
  const layout = useMemo(() => layoutGraph(model, mode), [model, mode])
  const linked = useMemo(() => connectedIds(model.edges, focusId), [model.edges, focusId])

  const select = useCallback(
    (id: string) => {
      setInternalFocus(id)
      onSelect?.(id)
    },
    [onSelect],
  )

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (focusId === undefined) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      const next = neighborsOf(model.edges, focusId, 'next')
      if (next !== undefined) {
        event.preventDefault()
        select(next)
      }
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      const prev = neighborsOf(model.edges, focusId, 'prev')
      if (prev !== undefined) {
        event.preventDefault()
        select(prev)
      }
    }
  }

  const orderedText = model.nodes
    .map((node) => {
      const outs = model.edges
        .filter((edge) => edge.from === node.id)
        .map((edge) => `${RELATION_LABEL[edge.kind]} ${edge.to}`)
        .join('; ')
      return `${node.label} (${statusLabel(node.status)}${outs ? `; ${outs}` : ''})`
    })
    .join('. ')

  return (
    <figure className="visual-diagram" data-testid={testId} aria-labelledby={titleId}>
      <div className="visual-diagram-heading">
        <div>
          <p className="section-kicker">Living map</p>
          <h2 id={titleId}>{title}</h2>
        </div>
        <p className="visual-diagram-hint">Arrow keys move along connections · click a node to focus</p>
      </div>
      <p id={descId} className="visual-diagram-description">
        {description}
      </p>
      <div className="visual-diagram-frame">
        <svg
          className="visual-graph-svg"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          tabIndex={0}
          aria-labelledby={`${titleId} ${descId}`}
          data-testid={`${testId}-svg`}
          onKeyDown={onKeyDown}
        >
          <defs>
            <marker
              id={`${testId}-arrow`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="visual-edge-marker" />
            </marker>
          </defs>
          {layout.edges.map((edge) => {
            const dimmed =
              focusId !== undefined && edge.from !== focusId && edge.to !== focusId
            return (
              <g
                key={edge.id}
                className={`visual-edge is-${edge.kind}${edge.animated === true ? ' is-animated' : ''}${dimmed ? ' is-dimmed' : ''}`}
              >
                <path
                  d={edge.path}
                  markerEnd={`url(#${testId}-arrow)`}
                  pathLength={1}
                />
                {edge.label !== undefined ? (
                  <text x={edge.labelPoint.x} y={edge.labelPoint.y} textAnchor="middle">
                    {edge.label}
                  </text>
                ) : null}
              </g>
            )
          })}
          {layout.nodes.map((node) => {
            const focused = node.id === focusId
            const linkedNode = linked.has(node.id)
            return (
              <g
                key={node.id}
                className={`visual-node is-${node.status}${focused ? ' is-focused' : ''}${linkedNode ? ' is-linked' : ''}`}
                transform={`translate(${node.x} ${node.y})`}
                data-testid={`graph-node-${node.id}`}
                onClick={() => {
                  select(node.id)
                }}
              >
                <title>
                  {node.label}. {statusLabel(node.status)}
                  {node.subtitle !== undefined ? `. ${node.subtitle}` : ''}
                </title>
                <rect
                  width={node.width}
                  height={node.height}
                  rx={10}
                  className="visual-node-surface"
                />
                <StatusShape status={node.status} x={16} y={22} />
                <text className="visual-node-label" x={28} y={26}>
                  {node.label}
                </text>
                <text className="visual-node-meta" x={28} y={44}>
                  {node.subtitle ?? statusLabel(node.status)}
                </text>
                {focused ? (
                  <rect
                    className="visual-node-focus-ring"
                    x={-3}
                    y={-3}
                    width={node.width + 6}
                    height={node.height + 6}
                    rx={12}
                  />
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="visual-diagram-caption">
        <ol className="visual-text-equivalent">
          {model.nodes.map((node, index) => (
            <li key={node.id}>
              <button
                type="button"
                className={node.id === focusId ? 'is-active' : undefined}
                data-testid={`graph-text-${node.id}`}
                onClick={() => {
                  select(node.id)
                }}
              >
                <span className="visual-text-index">{String(index + 1).padStart(2, '0')}</span>
                <strong>{node.label}</strong>
                <span>{statusLabel(node.status)}</span>
                {node.subtitle !== undefined ? <small>{node.subtitle}</small> : null}
              </button>
            </li>
          ))}
        </ol>
        <p className="sr-only" data-testid={`${testId}-text-alt`}>
          {orderedText}
        </p>
      </figcaption>
    </figure>
  )
}
