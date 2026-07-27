import { describe, expect, it } from 'vitest'

import { SEEDED_WORKFLOW } from '../fallback'
import {
  eventRiverModel,
  findingRelationModel,
  readinessModel,
  workflowPhaseModel,
} from './models'

describe('workflow graph models', () => {
  it('builds a phase constellation with remediation return', () => {
    const model = workflowPhaseModel(SEEDED_WORKFLOW)
    expect(model.nodes.map((node) => node.id)).toEqual(['plan', 'execute', 'review', 'ready'])
    expect(model.edges.some((edge) => edge.kind === 'return')).toBe(true)
    expect(model.focusId).toBe('plan')
  })

  it('links findings into remediation', () => {
    const model = findingRelationModel(SEEDED_WORKFLOW.findings, 'plan')
    expect(model.nodes.length).toBeGreaterThan(3)
    expect(model.edges.some((edge) => edge.kind === 'blocks')).toBe(true)
  })

  it('orders events and readiness evidence', () => {
    expect(eventRiverModel(SEEDED_WORKFLOW.events).edges.length).toBe(2)
    const ready = readinessModel(SEEDED_WORKFLOW)
    expect(ready.nodes.map((node) => node.id)).toEqual([
      'validations',
      'review-clear',
      'ready',
      'authorize',
    ])
  })
})
