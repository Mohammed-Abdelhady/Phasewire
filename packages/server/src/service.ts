import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildServiceApp } from './app.js'
import { PhasewireCoreFacade } from './core-facade.js'
import { removeOwnedEndpoint, writeEndpoint } from './endpoint.js'
import { isLoopbackHostname } from './security.js'
import type { RunningService, ServiceOptions } from './types.js'

const moduleDirectory = (): string => dirname(fileURLToPath(import.meta.url))

/** Prefer env, then the shipped package web/ tree, then the monorepo Vite build output. */
const defaultWebRoot = (): string => {
  const fromEnv = process.env.PHASEWIRE_WEB_ROOT
  if (fromEnv !== undefined && fromEnv.trim() !== '') return resolve(fromEnv)

  const directory = moduleDirectory()
  const shipWebRoot = resolve(directory, '../../web')
  if (existsSync(shipWebRoot)) return shipWebRoot

  return resolve(directory, '../../../apps/web/dist')
}

export const startService = async (options: ServiceOptions): Promise<RunningService> => {
  const host = options.host ?? '127.0.0.1'
  if (!isLoopbackHostname(host)) throw new Error('Phasewire service may only bind to a loopback address')

  const token = options.token ?? randomBytes(32).toString('base64url')
  const core = new PhasewireCoreFacade(options.projectRoot)
  const app = await buildServiceApp({
    core,
    projectRoot: options.projectRoot,
    token,
    webRoot: options.webRoot ?? defaultWebRoot(),
  })

  await app.listen({ host, port: options.port ?? 0 })
  const address = app.server.address()
  if (address === null || typeof address === 'string') {
    await app.close()
    throw new Error('Phasewire service did not receive a TCP address')
  }

  const port = address.port
  const endpoint = {
    origin: `http://${host.includes(':') ? `[${host}]` : host}:${port}`,
    pid: process.pid,
    port,
    projectRoot: options.projectRoot,
    startedAt: new Date().toISOString(),
    token,
    version: 1 as const,
  }
  try {
    await writeEndpoint(endpoint)
  } catch (error: unknown) {
    await app.close()
    throw error
  }

  let closed = false
  return {
    endpoint,
    close: async () => {
      if (closed) return
      closed = true
      await app.close()
      await removeOwnedEndpoint(endpoint)
    },
  }
}
