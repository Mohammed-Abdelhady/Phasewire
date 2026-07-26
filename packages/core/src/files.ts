import { constants } from 'node:fs'
import { access, link, lstat, mkdir, open, rename, rm, rmdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'

import { canonicalJson } from './canonical.js'
import { assertSecurePath } from './paths.js'
import type { JsonValue } from './types.js'

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function readTextFile(path: string, trustedRoot?: string): Promise<string> {
  if (trustedRoot !== undefined) await assertSecurePath(trustedRoot, path)
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    return await handle.readFile('utf8')
  } finally {
    await handle.close()
  }
}

export async function readJson(path: string, trustedRoot?: string): Promise<unknown> {
  return JSON.parse(await readTextFile(path, trustedRoot)) as unknown
}

async function writeAndSync(path: string, contents: string): Promise<void> {
  const handle = await open(path, 'wx', 0o644)
  try {
    await handle.writeFile(contents, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export async function writeJsonImmutable(path: string, value: JsonValue, trustedRoot?: string): Promise<void> {
  return writeTextImmutable(path, `${canonicalJson(value)}\n`, trustedRoot)
}

export async function writeTextImmutable(path: string, contents: string, trustedRoot?: string): Promise<void> {
  if (trustedRoot !== undefined) await assertSecurePath(trustedRoot, path)
  await mkdir(dirname(path), { recursive: true })
  if (trustedRoot !== undefined) await assertSecurePath(trustedRoot, dirname(path))
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    await writeAndSync(temporaryPath, contents)
    await link(temporaryPath, path)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}

export async function writeJsonReplace(path: string, value: JsonValue, trustedRoot?: string): Promise<void> {
  if (trustedRoot !== undefined) await assertSecurePath(trustedRoot, path)
  await mkdir(dirname(path), { recursive: true })
  if (trustedRoot !== undefined) await assertSecurePath(trustedRoot, dirname(path))
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    await writeAndSync(temporaryPath, `${canonicalJson(value)}\n`)
    await rename(temporaryPath, path)
  } finally {
    await unlink(temporaryPath).catch(() => undefined)
  }
}

export const LOCK_HEARTBEAT_MS = 30_000
export const LOCK_STALE_AFTER_MS = 120_000

export interface DirectoryLockMetadata {
  readonly schemaVersion: 1
  readonly ownerId: string
  readonly pid: number
  readonly hostname: string
  readonly acquiredAt: string
  readonly heartbeatAt: string
}

export interface DirectoryLockOptions {
  readonly trustedRoot?: string
  readonly heartbeatMs?: number
  readonly staleAfterMs?: number
  readonly now?: () => Date
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST'
}

function isLockMetadata(value: unknown): value is DirectoryLockMetadata {
  return typeof value === 'object' && value !== null &&
    'schemaVersion' in value && value.schemaVersion === 1 &&
    'ownerId' in value && typeof value.ownerId === 'string' &&
    'pid' in value && typeof value.pid === 'number' &&
    'hostname' in value && typeof value.hostname === 'string' &&
    'acquiredAt' in value && typeof value.acquiredAt === 'string' &&
    'heartbeatAt' in value && typeof value.heartbeatAt === 'string'
}

async function lockTimestamp(lockPath: string, metadataPath: string, trustedRoot?: string): Promise<number> {
  try {
    const metadata = await readJson(metadataPath, trustedRoot)
    if (isLockMetadata(metadata)) return Date.parse(metadata.heartbeatAt)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PATH_ESCAPE') throw error
  }
  return (await lstat(lockPath)).mtimeMs
}

async function recoverStaleLock(
  lockPath: string,
  metadataPath: string,
  staleAfterMs: number,
  now: Date,
  trustedRoot?: string,
): Promise<boolean> {
  const timestamp = await lockTimestamp(lockPath, metadataPath, trustedRoot)
  if (!Number.isFinite(timestamp) || now.getTime() - timestamp < staleAfterMs) return false
  const stalePath = `${lockPath}.stale-${randomUUID()}`
  if (trustedRoot !== undefined) await assertSecurePath(trustedRoot, lockPath)
  try {
    await rename(lockPath, stalePath)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return true
    throw error
  }
  await rm(stalePath, { recursive: true })
  return true
}

export async function acquireDirectoryLock(
  lockPath: string,
  options: DirectoryLockOptions = {},
): Promise<() => Promise<void>> {
  const heartbeatMs = options.heartbeatMs ?? LOCK_HEARTBEAT_MS
  const staleAfterMs = options.staleAfterMs ?? LOCK_STALE_AFTER_MS
  if (heartbeatMs <= 0 || staleAfterMs <= heartbeatMs) throw new RangeError('Lock timing configuration is invalid')
  if (options.trustedRoot !== undefined) await assertSecurePath(options.trustedRoot, lockPath)
  await mkdir(dirname(lockPath), { recursive: true })
  if (options.trustedRoot !== undefined) await assertSecurePath(options.trustedRoot, dirname(lockPath))
  const metadataPath = join(lockPath, 'owner.json')
  try {
    await mkdir(lockPath)
  } catch (error) {
    if (!isAlreadyExists(error) ||
      !(await recoverStaleLock(lockPath, metadataPath, staleAfterMs, options.now?.() ?? new Date(), options.trustedRoot))) {
      throw error
    }
    await mkdir(lockPath)
  }

  const ownerId = randomUUID()
  const acquiredAt = (options.now?.() ?? new Date()).toISOString()
  const metadata: DirectoryLockMetadata = {
    schemaVersion: 1,
    ownerId,
    pid: process.pid,
    hostname: hostname(),
    acquiredAt,
    heartbeatAt: acquiredAt,
  }
  await writeJsonImmutable(metadataPath, { ...metadata }, options.trustedRoot)
  const heartbeat = setInterval(() => {
    const next = { ...metadata, heartbeatAt: (options.now?.() ?? new Date()).toISOString() }
    void writeJsonReplace(metadataPath, next, options.trustedRoot).catch(() => clearInterval(heartbeat))
  }, heartbeatMs)
  heartbeat.unref()

  return async () => {
    clearInterval(heartbeat)
    let current: unknown
    try {
      current = await readJson(metadataPath, options.trustedRoot)
    } catch {
      return
    }
    if (!isLockMetadata(current) || current.ownerId !== ownerId) return
    await unlink(metadataPath)
    await rmdir(lockPath)
  }
}
