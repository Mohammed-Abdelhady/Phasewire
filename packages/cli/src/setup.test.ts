import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createProgram } from './index.js'
import { applySetup, resolveSetupAnswers } from './setup.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { force: true, recursive: true })))
})

const tempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'phasewire-setup-'))
  roots.push(root)
  return root
}

const runCli = async (argv: readonly string[]): Promise<void> => {
  await createProgram().parseAsync(['node', 'phasewire', ...argv])
}

describe('setup answers', () => {
  it('resolves non-interactive defaults with --yes', async () => {
    const root = await tempRoot()
    const answers = await resolveSetupAnswers(root, {
      yes: true,
      projectId: 'demo',
      defaultHarness: 'claude',
      hosts: 'codex',
      scope: 'project',
      noAdapters: false,
      autoOpen: true,
      validation: ['lint', 'test'],
    })
    expect(answers).toEqual({
      autoOpen: true,
      defaultHarness: 'claude',
      hosts: ['codex'],
      installAdapters: true,
      projectId: 'demo',
      scope: 'project',
      validations: ['lint', 'test'],
    })
  })

  it('skips adapters when --no-adapters', async () => {
    const root = await tempRoot()
    const answers = await resolveSetupAnswers(root, { yes: true, noAdapters: true })
    expect(answers.installAdapters).toBe(false)
    expect(answers.hosts).toEqual(['claude', 'codex', 'grok', 'agy'])
  })
})

describe('applySetup', () => {
  it('initializes config and installs adapters', async () => {
    const root = await tempRoot()
    const result = await applySetup(root, {
      autoOpen: true,
      defaultHarness: 'codex',
      hosts: ['claude'],
      installAdapters: true,
      projectId: 'apply-demo',
      scope: 'project',
      validations: ['lint', 'build'],
    })
    expect(result.initialized).toBe(true)
    expect(result.config.projectId).toBe('apply-demo')
    expect(result.config.defaultHarness).toBe('codex')
    expect(result.config.requiredValidations).toEqual(['lint', 'build'])
    expect(result.config.ui?.autoOpenOnMutate).toBe(true)
    expect(result.config.adapters?.hosts).toEqual(['claude'])
    expect(result.adapters?.files.length).toBeGreaterThan(0)

    const raw = JSON.parse(await readFile(join(root, '.phasewire', 'config.json'), 'utf8')) as {
      adapters?: { hosts?: string[] }
    }
    expect(raw.adapters?.hosts).toEqual(['claude'])
  })

  it('updates existing project without re-creating defaults blindly', async () => {
    const root = await tempRoot()
    await applySetup(root, {
      autoOpen: false,
      defaultHarness: 'user',
      hosts: ['claude'],
      installAdapters: false,
      projectId: 'first',
      scope: 'project',
      validations: ['lint'],
    })
    const second = await applySetup(root, {
      autoOpen: true,
      defaultHarness: 'agy',
      hosts: ['grok'],
      installAdapters: true,
      projectId: 'second',
      scope: 'project',
      validations: ['test'],
    })
    expect(second.initialized).toBe(false)
    expect(second.config.projectId).toBe('second')
    expect(second.config.defaultHarness).toBe('agy')
    expect(second.config.requiredValidations).toEqual(['test'])
    expect(second.config.adapters?.hosts).toEqual(['grok'])
  })
})

describe('init --yes CLI', () => {
  it('initializes a project non-interactively', async () => {
    const root = await tempRoot()
    await runCli([
      'init',
      root,
      '--yes',
      '--json',
      '--project-id',
      'cli-init',
      '--default-harness',
      'claude',
      '--hosts',
      'claude',
      '--no-auto-open',
      '--validation',
      'lint',
    ])
    const raw = JSON.parse(await readFile(join(root, '.phasewire', 'config.json'), 'utf8')) as {
      projectId: string
      defaultHarness?: string
      requiredValidations: string[]
      adapters?: { hosts: string[]; scope: string }
      ui?: { autoOpenOnMutate: boolean }
    }
    expect(raw.projectId).toBe('cli-init')
    expect(raw.defaultHarness).toBe('claude')
    expect(raw.requiredValidations).toEqual(['lint'])
    expect(raw.adapters?.hosts).toEqual(['claude'])
    expect(raw.ui?.autoOpenOnMutate).toBe(false)
  })

  it('supports setup and config show/set', async () => {
    const root = await tempRoot()
    await runCli(['init', root, '--yes', '--json', '--project-id', 'cfg', '--no-adapters'])
    await runCli([
      'setup',
      root,
      '--yes',
      '--json',
      '--default-harness',
      'codex',
      '--hosts',
      'codex',
      '--auto-open',
    ])
    await runCli([
      'config',
      'set',
      'defaultHarness',
      'agy',
      '--project-root',
      root,
      '--json',
    ])
    await runCli([
      'config',
      'set',
      'ui.autoOpenOnMutate',
      'true',
      '--project-root',
      root,
      '--json',
    ])
    const raw = JSON.parse(await readFile(join(root, '.phasewire', 'config.json'), 'utf8')) as {
      defaultHarness?: string
      adapters?: { hosts: string[] }
      ui?: { autoOpenOnMutate: boolean; autoOpenOnStatusWithId: boolean }
    }
    expect(raw.defaultHarness).toBe('agy')
    expect(raw.adapters?.hosts).toEqual(['codex'])
    expect(raw.ui?.autoOpenOnMutate).toBe(true)
    expect(raw.ui?.autoOpenOnStatusWithId).toBe(false)
  })
})
