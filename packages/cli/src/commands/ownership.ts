import type { Command } from 'commander'

import { printResult } from '../output.js'
import {
  mutationMessage,
  parsePhase,
  parsePositiveInteger,
  projectContext,
  type ClaimOptions,
  type ReleaseOptions,
} from '../runtime.js'

export const addHandoffCommands = (program: Command): void => {
  const handoff = program.command('handoff').description('Create portable handoffs')
  handoff
    .command('create')
    .argument('<workflow-id>')
    .requiredOption('--to <harness>', 'Intended receiving harness')
    .option('--from <actor>', 'Creating actor', 'user')
    .option('--note <text>', 'Handoff note')
    .action(
      async (
        workflowId: string,
        options: { from: string; note?: string; to: string },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const value = await context.core.createHandoff({
          createdBy: options.from,
          intendedFor: options.to,
          ...(options.note === undefined ? {} : { note: options.note }),
          workflowId,
        })
        printResult(value, context.json, () => `Created handoff for ${workflowId} to ${options.to}`)
      },
    )
}

export const addPhaseOwnershipCommands = (program: Command): void => {
  program
    .command('claim')
    .argument('<workflow-id>')
    .requiredOption('--phase <phase>', 'Phase to claim', parsePhase)
    .requiredOption('--harness <harness>', 'Claiming harness')
    .option('--ttl <milliseconds>', 'Lease duration in milliseconds', parsePositiveInteger)
    .action(async (workflowId: string, options: ClaimOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'claim', {
        actor: options.harness,
        payload: {
          phase: options.phase,
          ...(options.ttl === undefined ? {} : { ttlMs: options.ttl }),
        },
      })
      printResult(value, context.json, mutationMessage('Claimed'))
    })

  program
    .command('checkpoint')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Checkpointing harness')
    .requiredOption('--summary <text>', 'Checkpoint summary')
    .option('--artifact <path>', 'Sanitized artifact path')
    .action(
      async (
        workflowId: string,
        options: { artifact?: string; harness: string; summary: string },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const value = await context.core.performAction(workflowId, 'checkpoint', {
          actor: options.harness,
          payload: {
            summary: options.summary,
            ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
          },
        })
        printResult(value, context.json, mutationMessage('Checkpointed'))
      },
    )

  program
    .command('release')
    .argument('<workflow-id>')
    .requiredOption('--phase <phase>', 'Phase to release', parsePhase)
    .requiredOption('--harness <harness>', 'Releasing harness')
    .action(async (workflowId: string, options: ReleaseOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'release', {
        actor: options.harness,
        payload: { phase: options.phase },
      })
      printResult(value, context.json, mutationMessage('Released'))
    })
}
