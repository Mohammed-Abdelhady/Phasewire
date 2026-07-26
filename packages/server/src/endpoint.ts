import { constants, type Stats } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { EndpointDescriptor } from './types.js'
import { isLoopbackHostname } from './security.js'

export const endpointFilePath = (projectRoot: string): string =>
  join(projectRoot, '.phasewire', '.runtime', 'endpoint.json')

const isEndpointDescriptor = (value: unknown): value is EndpointDescriptor => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Readonly<Record<string, unknown>>
  const structurallyValid = (
    candidate.version === 1 &&
    typeof candidate.origin === 'string' &&
    typeof candidate.pid === 'number' &&
    typeof candidate.port === 'number' &&
    typeof candidate.projectRoot === 'string' &&
    typeof candidate.startedAt === 'string' &&
    typeof candidate.token === 'string'
  )
  if (!structurallyValid) return false
  const originValue = candidate.origin as string
  const portValue = candidate.port as number
  const pidValue = candidate.pid as number
  const tokenValue = candidate.token as string
  try {
    const origin = new URL(originValue)
    return (
      origin.protocol === 'http:' &&
      isLoopbackHostname(origin.hostname) &&
      Number(origin.port) === portValue &&
      Number.isSafeInteger(portValue) &&
      portValue > 0 &&
      portValue <= 65_535 &&
      Number.isSafeInteger(pidValue) &&
      pidValue > 0 &&
      tokenValue.length >= 16
    )
  } catch {
    return false
  }
}

export const readEndpoint = async (projectRoot: string): Promise<EndpointDescriptor | undefined> => {
  try {
    const resolvedRoot = await realpath(resolve(projectRoot))
    const runtimeRoot = await secureRuntimeDirectory(resolvedRoot)
    const destination = join(runtimeRoot, 'endpoint.json')
    const metadata = await lstat(destination)
    if (metadata.isSymbolicLink() || !metadata.isFile()) return undefined
    const handle = await open(destination, constants.O_NOFOLLOW | constants.O_RDONLY)
    let contents: string
    try {
      contents = await handle.readFile('utf8')
    } finally {
      await handle.close()
    }
    const parsed: unknown = JSON.parse(contents)
    return isEndpointDescriptor(parsed) && parsed.projectRoot === resolvedRoot ? parsed : undefined
  } catch {
    return undefined
  }
}

const secureRuntimeDirectory = async (projectRoot: string): Promise<string> => {
  const resolvedRoot = await realpath(resolve(projectRoot))
  if (resolvedRoot !== resolve(projectRoot)) {
    throw new Error('Endpoint project root must be a real path')
  }

  const phasewireRoot = join(resolvedRoot, '.phasewire')
  const runtimeRoot = join(phasewireRoot, '.runtime')
  for (const directory of [phasewireRoot, runtimeRoot]) {
    let metadata: Stats
    try {
      metadata = await lstat(directory)
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      await mkdir(directory, { mode: 0o700 })
      metadata = await lstat(directory)
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Endpoint directory must not be a symbolic link: ${directory}`)
    }
  }
  if ((await realpath(runtimeRoot)) !== runtimeRoot) {
    throw new Error('Endpoint runtime directory escapes the project root')
  }
  await chmod(runtimeRoot, 0o700)
  return runtimeRoot
}

export const writeEndpoint = async (endpoint: EndpointDescriptor): Promise<void> => {
  const runtimeRoot = await secureRuntimeDirectory(endpoint.projectRoot)
  const destination = join(runtimeRoot, 'endpoint.json')
  const temporary = join(runtimeRoot, `.endpoint-${randomUUID()}.tmp`)
  const handle = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY,
    0o600,
  )
  try {
    try {
      await handle.writeFile(`${JSON.stringify(endpoint, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, destination)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
}

export const removeOwnedEndpoint = async (endpoint: EndpointDescriptor): Promise<void> => {
  const current = await readEndpoint(endpoint.projectRoot)
  if (current?.pid !== endpoint.pid || current.token !== endpoint.token) return
  try {
    await unlink(endpointFilePath(endpoint.projectRoot))
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
}
