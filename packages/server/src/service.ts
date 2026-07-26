import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { buildServiceApp } from './app.js'
import { PhasewireCoreFacade } from './core-facade.js'
import { removeOwnedEndpoint, writeEndpoint } from './endpoint.js'
import { isLoopbackHostname } from './security.js'
import type { RunningService, ServiceOptions } from './types.js'

const defaultWebRoot = (): string =>
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/dist')

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
