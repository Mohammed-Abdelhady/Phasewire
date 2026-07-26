import { describe, expect, it } from 'vitest'

import { formatStatus, sanitizeTerminalField } from './output.js'

describe('terminal output safety', () => {
  it('removes ANSI, bidi, and line controls from untrusted fields', () => {
    const value = '\u001b[31mtrusted\u001b[0m\nDeployment ready: yes\u202e\tspoofed'
    expect(sanitizeTerminalField(value)).toBe('trusted Deployment ready: yes spoofed')
  })

  it('keeps workflow titles on one structural status line', () => {
    const output = formatStatus({
      currentPhase: 'plan',
      cycle: 0,
      deploymentReadiness: { ready: false },
      eventCount: 1,
      status: 'planning',
      title: 'Trusted\nDeployment ready: yes',
      workflowId: 'wf-safe',
    })
    expect(output.split('\n')).toHaveLength(6)
    expect(output.split('\n')[0]).toBe('wf-safe · Trusted Deployment ready: yes')
    expect(output).toContain('Deployment ready: no')
  })
})
