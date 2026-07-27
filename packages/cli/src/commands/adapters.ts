import { access } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { Command } from 'commander'

import { PhasewireCoreFacade } from '@phasewire/server/core-facade'

import { installAdapters, parseAdapterHosts } from '../adapters/install.js'
import type { AdapterScope } from '../adapters/hosts.js'
import { printResult } from '../output.js'
import { discoverProjectRoot } from '../project-root.js'
import { globalOptions } from '../runtime.js'

const parseScope = (value: string): AdapterScope => {
  if (value === 'project' || value === 'user') return value
  throw new Error("Scope must be 'project' or 'user'")
}

const projectExists = async (root: string): Promise<boolean> => {
  try {
    await access(resolve(root, '.phasewire', 'config.json'))
    return true
  } catch {
    return false
  }
}

export const addAdapterCommands = (program: Command): void => {
  const adapters = program.command('adapters').description('Install harness slash/skill adapters')

  adapters
    .command('install')
    .description('Install Phasewire skills/commands into Claude, Codex, Grok, and/or Agy')
    .option('--host <host>', 'claude | codex | grok | agy | all', 'all')
    .option('--scope <scope>', 'project | user', 'project')
    .action(async (options: { host: string; scope: string }, command: Command): Promise<void> => {
      const globals = globalOptions(command)
      const hosts = parseAdapterHosts(options.host)
      const scope = parseScope(options.scope)
      const projectRoot =
        scope === 'project'
          ? await discoverProjectRoot(process.cwd(), globals.projectRoot).catch(() =>
              resolve(globals.projectRoot ?? process.cwd()),
            )
          : resolve(globals.projectRoot ?? process.cwd())
      const result = await installAdapters({ hosts, projectRoot, scope })
      if (await projectExists(projectRoot)) {
        const core = new PhasewireCoreFacade(projectRoot)
        await core.writeConfig({
          adapters: {
            hosts: [...result.hosts],
            scope: result.scope,
            installedAt: new Date().toISOString(),
          },
        })
      }
      printResult(result, globals.json ?? false, () => {
        const hostList = result.hosts.join(', ')
        return [
          `Installed Phasewire adapters for ${hostList} (${result.scope}).`,
          `Wrote ${String(result.files.length)} files.`,
          'Restart the host session, then try /phasewire or /phasewire:plan.',
        ].join('\n')
      })
    })
}
