import { access, realpath } from 'node:fs/promises'
import { dirname, parse, resolve } from 'node:path'

const hasPhasewireConfig = async (directory: string): Promise<boolean> => {
  try {
    await access(resolve(directory, '.phasewire', 'config.json'))
    return true
  } catch {
    return false
  }
}

export const discoverProjectRoot = async (
  startDirectory: string,
  explicitRoot?: string,
): Promise<string> => {
  if (explicitRoot !== undefined) return realpath(resolve(explicitRoot))

  let current = await realpath(resolve(startDirectory))
  const filesystemRoot = parse(current).root
  while (true) {
    if (await hasPhasewireConfig(current)) return current
    if (current === filesystemRoot) break
    current = dirname(current)
  }
  throw new Error('Not inside a Phasewire project. Run `phasewire init` first.')
}

export const resolveInitRoot = (directory: string | undefined, explicitRoot?: string): string =>
  resolve(explicitRoot ?? directory ?? process.cwd())
