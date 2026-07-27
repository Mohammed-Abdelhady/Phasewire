#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { Command } from 'commander'

import { addAdapterCommands } from './commands/adapters.js'
import { addConfigCommands } from './commands/config.js'
import { addMaintenanceCommands } from './commands/maintenance.js'
import { addHandoffCommands, addPhaseOwnershipCommands } from './commands/ownership.js'
import { addProgressCommands } from './commands/progress.js'
import { addInitCommand, addSetupCommand } from './commands/setup.js'
import { addTemplateCommands } from './commands/templates.js'
import { addDeploymentAuthorizationCommand, addWorkflowCommands } from './commands/workflows.js'
import { printJson, sanitizeTerminalField } from './output.js'

export const createProgram = (): Command => {
  const program = new Command()
    .name('phasewire')
    .description('Persistent local workflow control without deployment side effects')
    .version('0.1.0')
    .option('--project-root <path>', 'Explicit Phasewire project root')
    .option('--json', 'Emit machine-readable JSON')

  addInitCommand(program)
  addSetupCommand(program)
  addConfigCommands(program)
  addWorkflowCommands(program)
  addProgressCommands(program)
  addHandoffCommands(program)
  addPhaseOwnershipCommands(program)
  addMaintenanceCommands(program)
  addTemplateCommands(program)
  addDeploymentAuthorizationCommand(program)
  addAdapterCommands(program)
  return program
}

const run = async (): Promise<void> => {
  try {
    await createProgram().parseAsync(process.argv)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const code =
      error instanceof Error && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'COMMAND_FAILED'
    const nextCommand =
      error instanceof Error && 'nextCommand' in error && typeof error.nextCommand === 'string'
        ? error.nextCommand
        : undefined
    if (process.argv.includes('--json')) {
      printJson({ code, error: message, ...(nextCommand === undefined ? {} : { nextCommand }) })
    } else {
      const safeMessage = sanitizeTerminalField(message)
      const safeNextCommand =
        nextCommand === undefined ? undefined : sanitizeTerminalField(nextCommand)
      process.stderr.write(
        `phasewire: ${safeMessage}${safeNextCommand === undefined ? '' : `\nNext: ${safeNextCommand}`}\n`,
      )
    }
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  void run()
}
