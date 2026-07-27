import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { readEndpoint } from './endpoint.js'
import type { EndpointDescriptor, EnsureServiceOptions } from './types.js'

const defaultTimeoutMs = 8_000

const healthyEndpoint = async (endpoint: EndpointDescriptor): Promise<boolean> => {
  try {
    const response = await fetch(`${endpoint.origin}/api/health`, {
      headers: { authorization: `Bearer ${endpoint.token}` },
      signal: AbortSignal.timeout(750),
    })
    if (!response.ok) return false
    const body: unknown = await response.json()
    return (
      typeof body === 'object' &&
      body !== null &&
      'ok' in body &&
      body.ok === true &&
      'pid' in body &&
      body.pid === endpoint.pid
    )
  } catch {
    return false
  }
}

const pause = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })

/** Resolve the service entry relative to this module so monorepo and ship layouts both work. */
const serviceEntrypoint = (): string => fileURLToPath(new URL('./index.js', import.meta.url))

export const ensureService = async (
  projectRoot: string,
  options: EnsureServiceOptions = {},
): Promise<EndpointDescriptor> => {
  const current = await readEndpoint(projectRoot)
  if (current !== undefined && (await healthyEndpoint(current))) return current

  const entrypoint = serviceEntrypoint()
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
  const child = spawn(process.execPath, [entrypoint, '--project-root', projectRoot], {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, PHASEWIRE_PROJECT_ROOT: projectRoot },
    stdio: 'ignore',
  })
  child.unref()

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const endpoint = await readEndpoint(projectRoot)
    if (endpoint !== undefined && (await healthyEndpoint(endpoint))) return endpoint
    await pause(100)
  }

  throw new Error(
    `Phasewire service did not become ready within ${String(timeoutMs)}ms (entry=${entrypoint}, project=${projectRoot})`,
  )
}
