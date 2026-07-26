import { lstat, realpath } from 'node:fs/promises'
import { lstatSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import { PhasewireError } from './errors.js'

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function isInside(root: string, candidate: string): boolean {
  const offset = relative(root, candidate)
  return offset === '' || (!offset.startsWith('..') && !isAbsolute(offset))
}

function reject(path: string, detail: string): never {
  throw new PhasewireError(`${detail}: ${path}`, 'PATH_ESCAPE')
}

export function resolveInside(root: string, ...segments: readonly string[]): string {
  const absoluteRoot = resolve(root)
  const candidate = resolve(absoluteRoot, ...segments)
  if (!isInside(absoluteRoot, candidate)) reject(candidate, 'Path escapes its trusted root')
  return candidate
}

export function assertSecureRootEntry(root: string): void {
  const absoluteRoot = resolve(root)
  const stats = lstatSync(absoluteRoot)
  if (stats.isSymbolicLink()) reject(absoluteRoot, 'Trusted root cannot be a symbolic link')
  if (!stats.isDirectory()) reject(absoluteRoot, 'Trusted root must be a directory')
}

export async function assertSecureRoot(root: string): Promise<string> {
  const absoluteRoot = resolve(root)
  let stats
  try {
    stats = await lstat(absoluteRoot)
  } catch (error) {
    if (isMissing(error)) reject(absoluteRoot, 'Trusted root does not exist')
    throw error
  }
  if (stats.isSymbolicLink()) reject(absoluteRoot, 'Trusted root cannot be a symbolic link')
  if (!stats.isDirectory()) reject(absoluteRoot, 'Trusted root must be a directory')
  return realpath(absoluteRoot)
}

export async function assertSecurePath(root: string, candidate: string): Promise<void> {
  const absoluteRoot = resolve(root)
  const canonicalRoot = await assertSecureRoot(root)
  const absoluteCandidate = resolve(candidate)
  if (!isInside(absoluteRoot, absoluteCandidate)) reject(absoluteCandidate, 'Path escapes its trusted root')

  const offset = relative(absoluteRoot, absoluteCandidate)
  if (offset === '') return
  let current = absoluteRoot
  for (const segment of offset.split(sep)) {
    current = resolve(current, segment)
    try {
      const stats = await lstat(current)
      if (stats.isSymbolicLink()) reject(current, 'Symbolic links are not allowed in trusted paths')
      const canonicalCurrent = await realpath(current)
      if (!isInside(canonicalRoot, canonicalCurrent)) reject(current, 'Real path escapes its trusted root')
    } catch (error) {
      if (isMissing(error)) return
      throw error
    }
  }
}

export async function assertSecurePhasewireRoot(projectRoot: string, phasewireRoot: string): Promise<void> {
  await assertSecureRoot(projectRoot)
  await assertSecurePath(projectRoot, phasewireRoot)
}
