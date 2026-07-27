import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { installAdapters, parseAdapterHosts } from './install.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { force: true, recursive: true })))
})

const tempRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'phasewire-adapters-'))
  roots.push(root)
  return root
}

const hasPath = (files: readonly string[], root: string, ...parts: string[]): boolean =>
  files.some((file) => file === join(root, ...parts))

describe('adapter install', () => {
  it('parses host selectors', () => {
    expect(parseAdapterHosts('all')).toEqual(['claude', 'codex', 'grok', 'agy'])
    expect(parseAdapterHosts('Claude')).toEqual(['claude'])
    expect(() => parseAdapterHosts('cursor')).toThrow(/Unknown harness/)
  })

  it('writes Claude project skills and slash commands', async () => {
    const root = await tempRoot()
    const result = await installAdapters({
      hosts: ['claude'],
      projectRoot: root,
      scope: 'project',
    })

    expect(hasPath(result.files, root, '.claude', 'skills', 'phasewire', 'SKILL.md')).toBe(true)
    expect(hasPath(result.files, root, '.claude', 'commands', 'phasewire.md')).toBe(true)
    expect(hasPath(result.files, root, '.claude', 'commands', 'phasewire', 'plan.md')).toBe(true)
    expect(
      hasPath(result.files, root, '.claude', 'plugins', 'phasewire', 'skills', 'plan', 'SKILL.md'),
    ).toBe(true)

    const hub = await readFile(join(root, '.claude', 'skills', 'phasewire', 'SKILL.md'), 'utf8')
    expect(hub).toMatch(/name:\s*"?phasewire"?/)
    expect(hub).toContain('/phasewire')
    expect(hub).toContain('never deploy')

    const plan = await readFile(
      join(root, '.claude', 'plugins', 'phasewire', 'skills', 'plan', 'SKILL.md'),
      'utf8',
    )
    expect(plan).toMatch(/name:\s*"?plan"?/)
    expect(plan).toContain('/phasewire:plan')
  })

  it('writes Codex, Grok, and Agy project adapters', async () => {
    const root = await tempRoot()
    const result = await installAdapters({
      hosts: ['codex', 'grok', 'agy'],
      projectRoot: root,
      scope: 'project',
    })

    expect(hasPath(result.files, root, '.codex', 'skills', 'phasewire-plan', 'SKILL.md')).toBe(true)
    expect(hasPath(result.files, root, '.grok', 'skills', 'phasewire', 'SKILL.md')).toBe(true)
    expect(hasPath(result.files, root, '.agent', 'skills', 'phasewire-resume', 'SKILL.md')).toBe(
      true,
    )
    expect(hasPath(result.files, root, '.agent', 'workflows', 'phasewire-open.md')).toBe(true)
    expect(hasPath(result.files, root, '.codex-plugin', 'plugin.json')).toBe(true)
  })
})
