import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveTemplateInput, writeTemplateOutput } from './template-files.js'

const roots: string[] = []

const temporaryRoot = async (prefix: string): Promise<string> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('template file boundary', () => {
  it('confines imports and exports to the project root', async () => {
    const root = await temporaryRoot('phasewire-template-root-')
    const outside = await temporaryRoot('phasewire-template-outside-')
    const external = join(outside, 'template.json')
    await writeFile(external, '{}', 'utf8')

    await expect(resolveTemplateInput(root, external)).rejects.toThrow('inside the project root')
    await expect(
      writeTemplateOutput(root, join(outside, 'export.json'), '{}\n', false),
    ).rejects.toThrow('inside the project root')
  })

  it('requires explicit force before replacing an existing output', async () => {
    const root = await temporaryRoot('phasewire-template-write-')
    const destination = join(root, 'templates', 'draft.json')
    await writeTemplateOutput(root, destination, '{"version":1}\n', false)
    await expect(writeTemplateOutput(root, destination, '{"version":2}\n', false)).rejects.toThrow(
      'pass --force',
    )
    await writeTemplateOutput(root, destination, '{"version":2}\n', true)
    expect(await readFile(destination, 'utf8')).toBe('{"version":2}\n')
  })
})
