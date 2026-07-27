import { afterEach, describe, expect, it, vi } from 'vitest'

import { openWorkbench } from './ui-open.js'

const ensureService = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      origin: 'http://127.0.0.1:4317',
      token: 'secret-token',
    }),
  ),
)

const openBrowser = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)))

vi.mock('@phasewire/server/launcher', () => ({
  ensureService,
}))

vi.mock('open', () => ({
  default: openBrowser,
}))

describe('openWorkbench token redaction', () => {
  afterEach(() => {
    ensureService.mockClear()
    openBrowser.mockClear()
  })

  it('opens with a tokenized session URL but returns a redacted display URL', async () => {
    const result = await openWorkbench('/tmp/project', 'wf-1', true)
    expect(openBrowser).toHaveBeenCalledWith(
      'http://127.0.0.1:4317/session?token=secret-token&workflow=wf-1',
    )
    expect(result).toEqual({
      opened: true,
      url: 'http://127.0.0.1:4317/#workflow=wf-1',
    })
    expect(result.url).not.toContain('secret-token')
    expect(result.url).not.toContain('token=')
  })

  it('returns the full launch URL without opening when shouldOpen is false', async () => {
    const result = await openWorkbench('/tmp/project', undefined, false)
    expect(openBrowser).not.toHaveBeenCalled()
    expect(result.opened).toBe(false)
    expect(result.url).toContain('token=secret-token')
  })
})
