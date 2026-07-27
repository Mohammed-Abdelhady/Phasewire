import type { Command } from 'commander'

import { printResult } from '../output.js'
import { mutationMessage, projectContext, type HarnessOptions } from '../runtime.js'

export const addMaintenanceCommands = (program: Command): void => {
  program.command('doctor').action(async (_options: object, command: Command) => {
    const context = await projectContext(command)
    const report = await context.core.doctor()
    const ok = typeof report === 'object' && report !== null && 'ok' in report && report.ok === true
    printResult(report, context.json, () =>
      ok ? 'Phasewire project is healthy.' : JSON.stringify(report, null, 2),
    )
    if (!ok) process.exitCode = 1
  })

  program.command('rebuild').action(async (_options: object, command: Command) => {
    const context = await projectContext(command)
    const report = await context.core.rebuild()
    printResult(report, context.json, () => 'Rebuilt disposable Phasewire projections.')
  })

  program.command('migrate').action(async (_options: object, command: Command) => {
    const context = await projectContext(command)
    const result = await context.core.migrate()
    printResult(result, context.json, () => 'Phasewire project schema is current.')
  })

  program.command('export').action(async (_options: object, command: Command) => {
    const context = await projectContext(command)
    const result = await context.core.exportProject()
    printResult(result, true, () => '')
  })

  program
    .command('reconcile')
    .argument('<workflow-id>')
    .option('--harness <harness>', 'Reconciling actor', 'user')
    .requiredOption(
      '--select-parent <event-id>',
      'Current head selected as the reconciliation base',
    )
    .requiredOption('--rationale <text>', 'Reason for selecting this head')
    .option('--note <text>', 'Reconciliation note')
    .action(
      async (
        workflowId: string,
        options: HarnessOptions & { note?: string; rationale: string; selectParent: string },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const value = await context.core.performAction(workflowId, 'reconcile', {
          actor: options.harness,
          payload: {
            resolution: {
              strategy: 'select-parent',
              selectedParent: options.selectParent,
              rationale: options.rationale,
            },
            ...(options.note === undefined ? {} : { note: options.note }),
          },
        })
        printResult(value, context.json, mutationMessage('Reconciled'))
      },
    )
}
