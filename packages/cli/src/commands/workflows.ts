import type { Command } from 'commander'

import { PhasewireCoreFacade } from '@phasewire/server/core-facade'

import { formatStatus, printResult } from '../output.js'
import { resolveInitRoot } from '../project-root.js'
import {
  createResumeInstructions,
  formatResumeInstructions,
  latestIntendedHandoff,
} from '../resume.js'
import {
  collect,
  globalOptions,
  mutationMessage,
  openWorkbench,
  projectContext,
  resultWorkflow,
  type HarnessOptions,
  type PlanOptions,
} from '../runtime.js'

const addInitAndPlan = (program: Command): void => {
  program
    .command('init')
    .argument('[directory]')
    .option('--project-id <id>', 'Stable project identifier')
    .action(
      async (directory: string | undefined, options: { projectId?: string }, command: Command) => {
        const globals = globalOptions(command)
        const root = resolveInitRoot(directory, globals.projectRoot)
        const core = new PhasewireCoreFacade(root)
        const config = await core.initialize(
          options.projectId === undefined ? {} : { projectId: options.projectId },
        )
        printResult(
          { config, projectRoot: root },
          globals.json ?? false,
          () => `Initialized Phasewire in ${root}`,
        )
      },
    )

  program
    .command('plan')
    .argument('<goal>')
    .option('--harness <harness>', 'Planning harness', 'user')
    .option('--id <workflow-id>', 'Explicit workflow identifier')
    .option('--template <template-id>', 'Pinned visual template')
    .option('--validation <check>', 'Required validation (repeatable)', collect, [])
    .option('--no-open', 'Create the workflow without opening the visual workbench')
    .action(async (goal: string, options: PlanOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.createWorkflow({
        actor: options.harness,
        ...(options.id === undefined ? {} : { workflowId: options.id }),
        ...(options.template === undefined ? {} : { templateId: options.template }),
        ...(options.validation.length === 0 ? {} : { requiredValidations: options.validation }),
        title: goal,
      })
      if (!options.open) return printResult(value, context.json, mutationMessage('Planned'))
      const workflow = resultWorkflow(value)
      const workflowId =
        typeof workflow === 'object' && workflow !== null && 'workflowId' in workflow
          ? String(workflow.workflowId)
          : options.id
      const ui = await openWorkbench(context.root, workflowId, true)
      const output =
        typeof value === 'object' && value !== null ? { ...value, ui } : { result: value, ui }
      printResult(output, context.json, mutationMessage('Planned'))
    })
}

const addLifecycle = (program: Command): void => {
  program
    .command('approve-plan')
    .argument('<workflow-id>')
    .action(async (workflowId: string, _options: object, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'approve-plan', {
        actor: 'user',
        payload: { acknowledgedMaterialDecisions: true },
      })
      printResult(value, context.json, mutationMessage('Plan approved for'))
    })

  program
    .command('execute')
    .argument('<workflow-id>')
    .option('--harness <harness>', 'Executing harness', 'user')
    .action(async (workflowId: string, options: HarnessOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.beginExecution(workflowId, options.harness)
      printResult(value, context.json, mutationMessage('Execution started for'))
    })

  program
    .command('review')
    .argument('<workflow-id>')
    .option('--harness <harness>', 'Reviewing harness', 'user')
    .action(async (workflowId: string, options: HarnessOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.beginReview(workflowId, options.harness)
      printResult(value, context.json, mutationMessage('Review started for'))
    })
}

const addInspection = (program: Command): void => {
  program
    .command('status')
    .argument('[workflow-id]')
    .action(async (workflowId: string | undefined, _options: object, command: Command) => {
      const context = await projectContext(command)
      const value =
        workflowId === undefined
          ? await context.core.listWorkflows()
          : await context.core.loadWorkflow(workflowId)
      printResult(value, context.json, formatStatus)
    })

  program
    .command('open')
    .argument('[workflow-id]')
    .option('--no-open', 'Print the URL without opening a browser')
    .action(
      async (workflowId: string | undefined, options: { open: boolean }, command: Command) => {
        const context = await projectContext(command)
        const value = await openWorkbench(context.root, workflowId, options.open)
        printResult(value, context.json, () => value.url)
      },
    )

  program
    .command('resume')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Receiving harness')
    .action(async (workflowId: string, options: HarnessOptions, command: Command) => {
      const context = await projectContext(command)
      const packet = latestIntendedHandoff(
        await context.core.listHandoffs(workflowId),
        options.harness,
      )
      const value = createResumeInstructions(context.root, packet, options.harness)
      printResult(value, context.json, (result) => formatResumeInstructions(result as typeof value))
    })
}

export const addWorkflowCommands = (program: Command): void => {
  addInitAndPlan(program)
  addLifecycle(program)
  addInspection(program)
}

export const addDeploymentAuthorizationCommand = (program: Command): void => {
  program
    .command('authorize-deployment')
    .argument('<workflow-id>')
    .option('--note <text>', 'Authorization note')
    .action(async (workflowId: string, options: { note?: string }, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'authorize-deployment', {
        actor: 'user',
        payload: {
          authorized: true,
          acknowledgedReadiness: true,
          ...(options.note === undefined ? {} : { note: options.note }),
        },
      })
      printResult(value, context.json, mutationMessage('Deployment authorization recorded for'))
    })
}
