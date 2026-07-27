import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'

const isOutside = (root: string, candidate: string): boolean => {
  const path = relative(root, candidate)
  return path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)
}

const resolvedRoot = async (projectRoot: string): Promise<string> => realpath(resolve(projectRoot))

export const resolveTemplateInput = async (projectRoot: string, input: string): Promise<string> => {
  const root = await resolvedRoot(projectRoot)
  const path = await realpath(resolve(input))
  if (isOutside(root, path)) throw new Error('Template input must remain inside the project root')
  const metadata = await lstat(path)
  if (!metadata.isFile()) throw new Error('Template input must be a regular file')
  return path
}

const ensureSecureDirectory = async (root: string, directory: string): Promise<void> => {
  const relativeDirectory = relative(root, directory)
  if (isOutside(root, directory))
    throw new Error('Template output must remain inside the project root')
  let current = root
  for (const segment of relativeDirectory.split(sep).filter(Boolean)) {
    current = resolve(current, segment)
    try {
      const metadata = await lstat(current)
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(`Template output directory is unsafe: ${current}`)
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      await mkdir(current, { mode: 0o755 })
    }
  }
  if (isOutside(root, await realpath(directory))) {
    throw new Error('Template output directory escapes the project root')
  }
}

export const writeTemplateOutput = async (
  projectRoot: string,
  output: string,
  contents: string,
  overwrite: boolean,
): Promise<string> => {
  const root = await resolvedRoot(projectRoot)
  const destination = resolve(output)
  if (isOutside(root, destination))
    throw new Error('Template output must remain inside the project root')
  await ensureSecureDirectory(root, dirname(destination))

  try {
    const metadata = await lstat(destination)
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error('Template output destination must be a regular file')
    }
    if (!overwrite)
      throw new Error(`Template output already exists: ${destination}; pass --force to replace it`)
  } catch (error: unknown) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }

  if (!overwrite) {
    const handle = await open(destination, 'wx', 0o644)
    try {
      await handle.writeFile(contents, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    return destination
  }

  const temporary = resolve(dirname(destination), `.phasewire-template-${randomUUID()}.tmp`)
  const handle = await open(temporary, 'wx', 0o644)
  try {
    try {
      await handle.writeFile(contents, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, destination)
  } finally {
    await unlink(temporary).catch(() => undefined)
  }
  return destination
}
