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

export const ensureService = async (
  projectRoot: string,
  options: EnsureServiceOptions = {},
): Promise<EndpointDescriptor> => {
  const current = await readEndpoint(projectRoot)
  if (current !== undefined && (await healthyEndpoint(current))) return current

  const entrypoint = fileURLToPath(new URL('./index.js', import.meta.url))
  const child = spawn(process.execPath, [entrypoint, '--project-root', projectRoot], {
    cwd: projectRoot,
    detached: true,
    env: { ...process.env, PHASEWIRE_PROJECT_ROOT: projectRoot },
    stdio: 'ignore',
  })
  child.unref()

  const deadline = Date.now() + (options.timeoutMs ?? defaultTimeoutMs)
  while (Date.now() < deadline) {
    const endpoint = await readEndpoint(projectRoot)
    if (endpoint !== undefined && (await healthyEndpoint(endpoint))) return endpoint
    await pause(100)
  }
  throw new Error('Phasewire service did not become ready before the launch timeout')
}
