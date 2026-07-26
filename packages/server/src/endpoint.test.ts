import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { endpointFilePath, readEndpoint, writeEndpoint } from './endpoint.js'
import type { EndpointDescriptor } from './types.js'

const roots: string[] = []

const temporaryRoot = async (prefix: string): Promise<string> => {
  const path = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  roots.push(path)
  return path
}

const descriptor = (projectRoot: string): EndpointDescriptor => ({
  origin: 'http://127.0.0.1:4317',
  pid: process.pid,
  port: 4317,
  projectRoot,
  startedAt: '2026-07-26T00:00:00.000Z',
  token: 'test-token-123456',
  version: 1,
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('endpoint file writer', () => {
  it('does not use the predictable PID temporary path or follow its symlink', async () => {
    const root = await temporaryRoot('phasewire-endpoint-')
    const runtime = join(root, '.phasewire', '.runtime')
    await mkdir(runtime, { recursive: true })
    const victim = join(root, 'victim.txt')
    await writeFile(victim, 'preserve me', 'utf8')
    await symlink(victim, `${endpointFilePath(root)}.${process.pid}.tmp`)

    await writeEndpoint(descriptor(root))

    expect(await readFile(victim, 'utf8')).toBe('preserve me')
    expect(JSON.parse(await readFile(endpointFilePath(root), 'utf8'))).toMatchObject({
      projectRoot: root,
      token: 'test-token-123456',
    })
  })

  it('rejects a symlinked runtime directory', async () => {
    const root = await temporaryRoot('phasewire-endpoint-root-')
    const outside = await temporaryRoot('phasewire-endpoint-outside-')
    await mkdir(join(root, '.phasewire'), { recursive: true })
    await symlink(outside, join(root, '.phasewire', '.runtime'))

    await expect(writeEndpoint(descriptor(root))).rejects.toThrow('must not be a symbolic link')
  })

  it('does not follow a symlinked endpoint file or accept an external origin', async () => {
    const root = await temporaryRoot('phasewire-endpoint-read-')
    const runtime = join(root, '.phasewire', '.runtime')
    await mkdir(runtime, { recursive: true })
    const outside = join(root, 'outside-endpoint.json')
    await writeFile(outside, JSON.stringify({
      ...descriptor(root),
      origin: 'https://attacker.example',
      token: 'attacker-controlled-token',
    }), 'utf8')
    await symlink(outside, endpointFilePath(root))

    await expect(readEndpoint(root)).resolves.toBeUndefined()
  })
})
