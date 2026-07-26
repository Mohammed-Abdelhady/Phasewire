import { describe, expect, it } from 'vitest'

import { createProgram } from './index.js'

describe('CLI namespace', () => {
  it('registers only the phasewire command tree', () => {
    const program = createProgram()
    expect(program.name()).toBe('phasewire')
    expect(program.commands.map((command) => command.name())).toEqual([
      'init',
      'plan',
      'approve-plan',
      'execute',
      'review',
      'status',
      'open',
      'resume',
      'complete-execution',
      'finding',
      'validate',
      'complete-review',
      'plan-remediation',
      'approve-remediation',
      'start-remediation',
      'complete-remediation',
      'handoff',
      'claim',
      'checkpoint',
      'release',
      'doctor',
      'rebuild',
      'migrate',
      'export',
      'reconcile',
      'templates',
      'authorize-deployment',
      'adapters',
    ])
    expect(program.commands.some((command) => command.name() === 'deploy')).toBe(false)
    const adapters = program.commands.find((command) => command.name() === 'adapters')
    expect(adapters?.commands.map((command) => command.name())).toEqual(['install'])
  })

  it('exposes the exact nested handoff and template commands', () => {
    const program = createProgram()
    const handoff = program.commands.find((command) => command.name() === 'handoff')
    const templates = program.commands.find((command) => command.name() === 'templates')
    expect(handoff?.commands.map((command) => command.name())).toEqual(['create'])
    expect(templates?.commands.map((command) => command.name())).toEqual([
      'create',
      'search',
      'add',
      'validate',
      'compose',
      'export',
    ])
    for (const name of ['claim', 'checkpoint', 'release', 'approve-plan']) {
      expect(program.commands.filter((command) => command.name() === name)).toHaveLength(1)
    }
  })

  it('documents the required workflow progress options', () => {
    const program = createProgram()
    const helpFor = (name: string): string => {
      const command = program.commands.find((candidate) => candidate.name() === name)
      if (command === undefined) throw new Error(`Missing ${name} command`)
      return command.helpInformation()
    }

    expect(helpFor('complete-execution')).toContain('--harness <harness>')
    expect(helpFor('finding')).toContain('--severity <severity>')
    expect(helpFor('finding')).toContain('--root-cause <text>')
    expect(helpFor('validate')).toContain('--status <status>')
    expect(helpFor('complete-review')).toContain('--artifact <path>')
    expect(helpFor('plan-remediation')).toContain('--harness <harness>')
    expect(helpFor('start-remediation')).toContain('--harness <harness>')
    expect(helpFor('complete-remediation')).toContain('--resolved <finding-id>')
  })

  it('requires at least one resolved finding when completing remediation', () => {
    const command = createProgram().commands.find(
      (candidate) => candidate.name() === 'complete-remediation',
    )
    const resolved = command?.options.find((option) => option.long === '--resolved')
    expect(resolved?.mandatory).toBe(true)
    expect(resolved?.defaultValue).toBeUndefined()
  })
})
