import type { Command } from 'commander'

import { formatStatus, printResult } from '../output.js'
import {
  createResumeInstructions,
  formatResumeInstructions,
  latestIntendedHandoff,
} from '../resume.js'
import {
  collect,
  mutationMessage,
  openWorkbench,
  projectContext,
  resolveHarness,
  withOptionalWorkbench,
  type HarnessOptions,
  type OpenFlagOptions,
  type PlanOptions,
} from '../runtime.js'

const addPlan = (program: Command): void => {
  program
    .command('plan')
    .argument('<goal>')
    .option('--harness <harness>', 'Planning harness')
    .option('--id <workflow-id>', 'Explicit workflow identifier')
    .option('--template <template-id>', 'Pinned visual template')
    .option('--validation <check>', 'Required validation (repeatable)', collect, [])
    .option('--no-open', 'Create the workflow without opening the visual workbench')
    .action(async (goal: string, options: PlanOptions, command: Command) => {
      const context = await projectContext(command)
      const harness = resolveHarness(options.harness, process.env, context.config)
      const value = await context.core.createWorkflow({
        actor: harness,
        ...(options.id === undefined ? {} : { workflowId: options.id }),
        ...(options.template === undefined ? {} : { templateId: options.template }),
        ...(options.validation.length === 0 ? {} : { requiredValidations: options.validation }),
        title: goal,
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        ...(options.id === undefined ? {} : { workflowId: options.id }),
      })
      printResult(output, context.json, mutationMessage('Planned'))
    })
}

const addLifecycle = (program: Command): void => {
  program
    .command('approve-plan')
    .argument('<workflow-id>')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: OpenFlagOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'approve-plan', {
        actor: 'user',
        payload: { acknowledgedMaterialDecisions: true },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Plan approved for'))
    })

  program
    .command('execute')
    .argument('<workflow-id>')
    .option('--harness <harness>', 'Executing harness')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(
      async (workflowId: string, options: HarnessOptions & OpenFlagOptions, command: Command) => {
        const context = await projectContext(command)
        const harness = resolveHarness(options.harness, process.env, context.config)
        const value = await context.core.beginExecution(workflowId, harness)
        const output = await withOptionalWorkbench(context, value, {
          kind: 'mutate',
          openFlag: options.open,
          workflowId,
        })
        printResult(output, context.json, mutationMessage('Execution started for'))
      },
    )

  program
    .command('review')
    .argument('<workflow-id>')
    .option('--harness <harness>', 'Reviewing harness')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(
      async (workflowId: string, options: HarnessOptions & OpenFlagOptions, command: Command) => {
        const context = await projectContext(command)
        const harness = resolveHarness(options.harness, process.env, context.config)
        const value = await context.core.beginReview(workflowId, harness)
        const output = await withOptionalWorkbench(context, value, {
          kind: 'mutate',
          openFlag: options.open,
          workflowId,
        })
        printResult(output, context.json, mutationMessage('Review started for'))
      },
    )
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
      if (workflowId === undefined) {
        printResult(value, context.json, formatStatus)
        return
      }
      const output = await withOptionalWorkbench(context, value, {
        kind: 'status',
        workflowId,
      })
      printResult(output, context.json, formatStatus)
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
    .option('--no-open', 'Skip opening the visual workbench')
    .action(
      async (workflowId: string, options: HarnessOptions & OpenFlagOptions, command: Command) => {
        const context = await projectContext(command)
        const harness = resolveHarness(options.harness, process.env, context.config)
        const packet = latestIntendedHandoff(
          await context.core.listHandoffs(workflowId),
          harness,
        )
        const value = createResumeInstructions(context.root, packet, harness)
        const output = await withOptionalWorkbench(context, value, {
          kind: 'mutate',
          openFlag: options.open,
          workflowId,
        })
        printResult(output, context.json, () => formatResumeInstructions(value))
      },
    )
}

export const addWorkflowCommands = (program: Command): void => {
  addPlan(program)
  addLifecycle(program)
  addInspection(program)
}

export const addDeploymentAuthorizationCommand = (program: Command): void => {
  program
    .command('authorize-deployment')
    .argument('<workflow-id>')
    .option('--note <text>', 'Authorization note')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(
      async (
        workflowId: string,
        options: OpenFlagOptions & { note?: string },
        command: Command,
      ) => {
        const context = await projectContext(command)
        const value = await context.core.performAction(workflowId, 'authorize-deployment', {
          actor: 'user',
          payload: {
            authorized: true,
            acknowledgedReadiness: true,
            ...(options.note === undefined ? {} : { note: options.note }),
          },
        })
        const output = await withOptionalWorkbench(context, value, {
          kind: 'mutate',
          openFlag: options.open,
          workflowId,
        })
        printResult(output, context.json, mutationMessage('Deployment authorization recorded for'))
      },
    )
}
