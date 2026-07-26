import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import Fastify from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'

import { registerStaticWorkbench } from './static-workbench.js'

const roots: string[] = []

const temporaryRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('static workbench boundary', () => {
  it('serves public assets but denies dotfiles', async () => {
    const root = await temporaryRoot('phasewire-static-')
    await writeFile(join(root, 'index.html'), '<h1>Workbench</h1>', 'utf8')
    await writeFile(join(root, 'app.js'), 'export {}', 'utf8')
    await writeFile(join(root, '.secret'), 'do not serve', 'utf8')
    const app = Fastify()
    await registerStaticWorkbench(app, root)
    try {
      expect((await app.inject({ method: 'GET', url: '/app.js' })).statusCode).toBe(200)
      const hidden = await app.inject({
        headers: { accept: 'text/plain' },
        method: 'GET',
        url: '/.secret',
      })
      expect(hidden.statusCode).toBe(404)
      expect(hidden.body).not.toContain('do not serve')
      const encodedHidden = await app.inject({
        headers: { accept: 'text/plain' },
        method: 'GET',
        url: '/%2esecret',
      })
      expect(encodedHidden.statusCode).toBeGreaterThanOrEqual(400)
      expect(encodedHidden.body).not.toContain('do not serve')
    } finally {
      await app.close()
    }
  })

  it('never follows a public symlink outside the real web root', async () => {
    const root = await temporaryRoot('phasewire-static-root-')
    const outside = await temporaryRoot('phasewire-static-outside-')
    await mkdir(join(root, 'assets'))
    await writeFile(join(root, 'index.html'), '<h1>Workbench</h1>', 'utf8')
    await writeFile(join(outside, 'secret.txt'), 'external secret', 'utf8')
    await symlink(join(outside, 'secret.txt'), join(root, 'assets', 'leak.txt'))
    const app = Fastify()
    await registerStaticWorkbench(app, root)
    try {
      const response = await app.inject({
        headers: { accept: 'text/plain' },
        method: 'GET',
        url: '/assets/leak.txt',
      })
      expect(response.statusCode).toBe(404)
      expect(response.body).not.toContain('external secret')
    } finally {
      await app.close()
    }
  })
})
