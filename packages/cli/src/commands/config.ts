import type { Command } from 'commander'

import { parseConfigSetValue, withPreservedUi, CONFIG_SET_KEYS } from '../config-keys.js'
import { printResult } from '../output.js'
import { projectContext } from '../runtime.js'

export const addConfigCommands = (program: Command): void => {
  const config = program.command('config').description('Show or update Phasewire project config')

  config
    .command('show')
    .description('Print the current project config')
    .action(async (_options: object, command: Command): Promise<void> => {
      const context = await projectContext(command)
      printResult(context.config, context.json, () =>
        JSON.stringify(context.config, null, 2),
      )
    })

  config
    .command('set')
    .description(`Set a config key (${CONFIG_SET_KEYS.join(', ')})`)
    .argument('<key>', 'Config key')
    .argument('<value>', 'Config value')
    .action(async (key: string, value: string, _options: object, command: Command): Promise<void> => {
      const context = await projectContext(command)
      const parsed = parseConfigSetValue(key, value)
      const partial = withPreservedUi(context.config, key, parsed)
      const next = await context.core.writeConfig(partial)
      printResult(next, context.json, () => `Updated ${key}`)
    })
}
