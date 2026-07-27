import type { Command } from 'commander'

import { resolveInitRoot } from '../project-root.js'
import { collect, globalOptions } from '../runtime.js'
import { runSetup, type SetupFlags } from '../setup.js'

interface SetupCliOptions {
  readonly projectId?: string
  readonly defaultHarness?: string
  readonly hosts?: string
  readonly scope?: string
  readonly validation?: readonly string[]
  readonly adapters?: boolean
  readonly autoOpen?: boolean
  readonly yes?: boolean
}

const setupFlags = (command: Command): void => {
  command
    .option('--project-id <id>', 'Stable project identifier')
    .option('--default-harness <harness>', 'Default harness id')
    .option('--hosts <hosts>', 'Adapter hosts: claude,codex,grok,agy or all')
    .option('--scope <scope>', 'Adapter scope: project | user')
    .option('--validation <check>', 'Required validation (repeatable)', collect, [])
    .option('--no-adapters', 'Skip harness adapter install')
    .option('--auto-open', 'Enable auto-open workbench on mutations')
    .option('--no-auto-open', 'Disable auto-open workbench on mutations')
    .option('--yes', 'Non-interactive defaults / accept flags')
}

const resolveAutoOpen = (command: Command, options: SetupCliOptions): boolean | undefined => {
  const source = command.getOptionValueSource('autoOpen')
  if (source === 'cli') return options.autoOpen === true
  return undefined
}

const toSetupFlags = (command: Command, options: SetupCliOptions): SetupFlags => ({
  ...(options.projectId === undefined ? {} : { projectId: options.projectId }),
  ...(options.defaultHarness === undefined ? {} : { defaultHarness: options.defaultHarness }),
  ...(options.hosts === undefined ? {} : { hosts: options.hosts }),
  ...(options.scope === undefined ? {} : { scope: options.scope }),
  ...(options.validation === undefined || options.validation.length === 0
    ? {}
    : { validation: options.validation }),
  ...(options.adapters === false ? { noAdapters: true } : {}),
  ...((): SetupFlags => {
    const autoOpen = resolveAutoOpen(command, options)
    return autoOpen === undefined ? {} : { autoOpen }
  })(),
  ...(options.yes === true ? { yes: true } : {}),
})

const runSetupAction = async (
  directory: string | undefined,
  options: SetupCliOptions,
  command: Command,
): Promise<void> => {
  const globals = globalOptions(command)
  const root = resolveInitRoot(directory, globals.projectRoot)
  const flags = toSetupFlags(command, options)
  await runSetup(
    root,
    {
      ...flags,
      ...(globals.json === true || flags.yes === true || process.stdin.isTTY !== true
        ? { yes: true }
        : {}),
    },
    globals.json ?? false,
  )
}

export const addInitCommand = (program: Command): void => {
  const init = program
    .command('init')
    .description('Initialize a Phasewire project (interactive wizard on TTY)')
    .argument('[directory]', 'Target directory (defaults to cwd)')
  setupFlags(init)
  init.action(runSetupAction)
}

export const addSetupCommand = (program: Command): void => {
  const setup = program
    .command('setup')
    .description('Re-run project setup on an existing Phasewire project')
    .argument('[directory]', 'Target directory (defaults to cwd)')
  setupFlags(setup)
  setup.action(runSetupAction)
}
