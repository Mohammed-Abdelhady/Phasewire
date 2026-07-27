import { describe, expect, it } from 'vitest'

import { connectedIds, layoutGraph, neighborsOf, truncateLabel } from './geometry'
import type { GraphModel } from './types'

const sample: GraphModel = {
  nodes: [
    { id: 'plan', label: 'Plan', status: 'active' },
    { id: 'execute', label: 'Execute', status: 'queued' },
    { id: 'review', label: 'Review', status: 'blocked' },
  ],
  edges: [
    { id: 'a', from: 'plan', to: 'execute', kind: 'sequence' },
    { id: 'b', from: 'execute', to: 'review', kind: 'sequence' },
    { id: 'c', from: 'review', to: 'plan', kind: 'return', animated: true },
  ],
  focusId: 'plan',
}

describe('visual geometry', () => {
  it('lays out nodes and routes return loops', () => {
    const layout = layoutGraph(sample, 'horizontal')
    expect(layout.nodes).toHaveLength(3)
    expect(layout.edges).toHaveLength(3)
    expect(layout.edges.some((edge) => edge.kind === 'return')).toBe(true)
    expect(layout.width).toBeGreaterThan(300)
    expect(layout.height).toBeGreaterThan(100)
  })

  it('tracks focus neighbors for keyboard traversal', () => {
    expect(neighborsOf(sample.edges, 'plan', 'next')).toBe('execute')
    expect(neighborsOf(sample.edges, 'execute', 'prev')).toBe('plan')
    expect([...connectedIds(sample.edges, 'review')].sort()).toEqual(['execute', 'plan', 'review'])
  })

  it('truncates long labels for fixed SVG node width', () => {
    expect(truncateLabel('short')).toBe('short')
    expect(truncateLabel('this label is definitely too long for the node', 18)).toBe(
      'this label is def…',
    )
  })
})
