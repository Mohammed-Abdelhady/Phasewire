import { describe, expect, it } from 'vitest'

import { extractWorkflowId, resolveHarness } from './runtime.js'
import { shouldOpenWorkbench } from './ui-open.js'

describe('resolveHarness', () => {
  it('prefers --harness over env and config', () => {
    expect(
      resolveHarness('codex', { PHASEWIRE_HARNESS: 'claude' }, { defaultHarness: 'grok' }),
    ).toBe('codex')
  })

  it('uses PHASEWIRE_HARNESS when flag is omitted', () => {
    expect(resolveHarness(undefined, { PHASEWIRE_HARNESS: 'claude' }, { defaultHarness: 'grok' })).toBe(
      'claude',
    )
  })

  it('uses config.defaultHarness when flag and env are empty', () => {
    expect(resolveHarness(undefined, {}, { defaultHarness: 'agy' })).toBe('agy')
    expect(resolveHarness('  ', { PHASEWIRE_HARNESS: '  ' }, { defaultHarness: 'agy' })).toBe('agy')
  })

  it('falls back to user', () => {
    expect(resolveHarness(undefined, {}, {})).toBe('user')
    expect(resolveHarness(undefined, { PHASEWIRE_HARNESS: '' }, { defaultHarness: '  ' })).toBe(
      'user',
    )
  })
})

describe('shouldOpenWorkbench policy', () => {
  const openUi = { autoOpenOnMutate: true, autoOpenOnStatusWithId: true }
  const closedUi = { autoOpenOnMutate: false, autoOpenOnStatusWithId: false }

  it('opens mutators when autoOpenOnMutate is true or unset', () => {
    expect(shouldOpenWorkbench({ kind: 'mutate', config: { ui: openUi } })).toBe(true)
    expect(shouldOpenWorkbench({ kind: 'mutate', config: {} })).toBe(true)
  })

  it('keeps mutators closed when autoOpenOnMutate is false', () => {
    expect(shouldOpenWorkbench({ kind: 'mutate', config: { ui: closedUi } })).toBe(false)
  })

  it('honors --no-open over mutate preference', () => {
    expect(
      shouldOpenWorkbench({ kind: 'mutate', openFlag: false, config: { ui: openUi } }),
    ).toBe(false)
  })

  it('opens status with id only when autoOpenOnStatusWithId is true', () => {
    expect(shouldOpenWorkbench({ kind: 'status', config: { ui: openUi } })).toBe(true)
    expect(shouldOpenWorkbench({ kind: 'status', config: { ui: closedUi } })).toBe(false)
    expect(shouldOpenWorkbench({ kind: 'status', config: {} })).toBe(false)
  })

  it('never opens never-kind commands and opens explicit open unless --no-open', () => {
    expect(shouldOpenWorkbench({ kind: 'never', config: { ui: openUi } })).toBe(false)
    expect(shouldOpenWorkbench({ kind: 'explicit', config: {} })).toBe(true)
    expect(shouldOpenWorkbench({ kind: 'explicit', openFlag: false, config: {} })).toBe(false)
  })

  it('does not treat --json as an open suppressor', () => {
    expect(
      shouldOpenWorkbench({ kind: 'mutate', json: true, config: { ui: openUi } }),
    ).toBe(true)
  })
})

describe('extractWorkflowId', () => {
  it('reads nested workflow ids and falls back', () => {
    expect(extractWorkflowId({ workflow: { workflowId: 'wf-1' } })).toBe('wf-1')
    expect(extractWorkflowId({ workflowId: 'wf-2' })).toBe('wf-2')
    expect(extractWorkflowId({}, 'wf-3')).toBe('wf-3')
    expect(extractWorkflowId(undefined)).toBeUndefined()
  })
})
