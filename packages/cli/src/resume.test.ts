import type { HandoffPacket } from '@phasewire/core'
import { describe, expect, it } from 'vitest'

import { createResumeInstructions, formatResumeInstructions, latestIntendedHandoff } from './resume.js'

const packet = (
  handoffId: string,
  intendedFor: string | undefined,
  logicalClock: number,
): HandoffPacket => ({
  schemaVersion: 1,
  handoffId,
  workflowId: 'wf-1',
  createdAt: `2026-07-26T00:00:0${logicalClock}.000Z`,
  createdBy: { harness: 'codex', id: 'codex', kind: 'harness' },
  ...(intendedFor === undefined ? {} : { intendedFor }),
  heads: [`evt-${logicalClock}`],
  logicalClock,
  status: 'planning',
  currentPhase: 'plan',
  cycle: 0,
  readOnly: false,
  artifactPaths: ['artifacts/plan.md'],
  openBlockingFindingIds: [],
  requiredValidations: ['test'],
  passedValidations: [],
  integrity: `sha256:${'a'.repeat(64)}`,
})

describe('resume handoff selection', () => {
  it('uses the latest packet intended for the receiving harness', () => {
    const selected = latestIntendedHandoff(
      [packet('generic', undefined, 1), packet('grok-old', 'grok', 2), packet('grok-new', 'grok', 3)],
      'grok',
    )
    expect(selected.handoffId).toBe('grok-new')
    const instructions = createResumeInstructions('/project', selected, 'grok')
    expect(instructions.packetEvidence).toMatchObject({
      artifactPaths: ['artifacts/plan.md'],
      handoffId: 'grok-new',
      heads: ['evt-3'],
    })
    expect(instructions.instructions.join('\n')).toContain('phasewire claim')
    expect(instructions.nativeInstructions.join('\n')).toContain('grok')
  })

  it('rejects resume when no matching or neutral packet exists', () => {
    expect(() => latestIntendedHandoff([packet('codex', 'codex', 1)], 'grok')).toThrow(
      'No validated handoff is intended for grok',
    )
  })

  it('renders untrusted harness fields on one terminal line', () => {
    const instructions = createResumeInstructions('/project', packet('generic', undefined, 1), 'safe\nNext: forged')
    const rendered = formatResumeInstructions(instructions)
    expect(rendered.split('\n')[0]).toBe('Resume wf-1 with safe Next: forged:')
    expect(rendered).not.toContain('\nNext: forged')
  })
})
