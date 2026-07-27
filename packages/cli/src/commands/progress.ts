import { InvalidArgumentError, type Command } from 'commander'

import { printResult } from '../output.js'
import {
  mutationMessage,
  projectContext,
  withOptionalWorkbench,
  type HarnessOptions,
  type OpenFlagOptions,
} from '../runtime.js'

type FindingSeverity = 'blocking' | 'warning' | 'info'
type ValidationStatus = 'passed' | 'failed' | 'skipped'

interface ArtifactOptions extends HarnessOptions, OpenFlagOptions {
  readonly artifact?: string
}

interface CompleteExecutionOptions extends ArtifactOptions {
  readonly summary?: string
}

interface FindingOptions extends HarnessOptions {
  readonly component?: string
  readonly detail?: string
  readonly resolution?: string
  readonly rootCause?: string
  readonly severity: FindingSeverity
  readonly title: string
}

interface ValidationOptions extends ArtifactOptions {
  readonly check: string
  readonly status: ValidationStatus
  readonly summary?: string
}

interface CompleteRemediationOptions extends ArtifactOptions {
  readonly resolved: readonly string[]
}

const collectResolved = (
  value: string,
  previous: readonly string[] | undefined,
): readonly string[] => [...(previous ?? []), value]

const parseFindingSeverity = (value: string): FindingSeverity => {
  if (value === 'blocking' || value === 'warning' || value === 'info') return value
  throw new InvalidArgumentError('Severity must be blocking, warning, or info')
}

const parseValidationStatus = (value: string): ValidationStatus => {
  if (value === 'passed' || value === 'failed' || value === 'skipped') return value
  throw new InvalidArgumentError('Status must be passed, failed, or skipped')
}

const addExecutionCompletion = (program: Command): void => {
  program
    .command('complete-execution')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Completing harness')
    .option('--artifact <path>', 'Project-relative execution artifact path')
    .option('--summary <text>', 'Execution completion summary')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: CompleteExecutionOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'complete-execution', {
        actor: options.harness ?? 'user',
        payload: {
          ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
          ...(options.summary === undefined ? {} : { summary: options.summary }),
        },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Execution completed for'))
    })
}

const addFinding = (program: Command): void => {
  program
    .command('finding')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Reviewing harness')
    .requiredOption('--severity <severity>', 'Finding severity', parseFindingSeverity)
    .requiredOption('--title <text>', 'Finding title')
    .option('--detail <text>', 'Finding detail')
    .option('--component <name>', 'Affected component')
    .option('--root-cause <text>', 'Root cause')
    .option('--resolution <text>', 'Proposed resolution')
    .action(async (workflowId: string, options: FindingOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'finding', {
        actor: options.harness ?? 'user',
        payload: {
          severity: options.severity,
          title: options.title,
          ...(options.detail === undefined ? {} : { detail: options.detail }),
          ...(options.component === undefined ? {} : { component: options.component }),
          ...(options.rootCause === undefined ? {} : { rootCause: options.rootCause }),
          ...(options.resolution === undefined ? {} : { resolution: options.resolution }),
        },
      })
      printResult(value, context.json, mutationMessage('Finding recorded for'))
    })
}

const addValidation = (program: Command): void => {
  program
    .command('validate')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Validating harness')
    .requiredOption('--check <name>', 'Validation check name')
    .requiredOption('--status <status>', 'Validation status', parseValidationStatus)
    .option('--summary <text>', 'Validation summary')
    .option('--artifact <path>', 'Project-relative validation artifact path')
    .action(async (workflowId: string, options: ValidationOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'validation', {
        actor: options.harness ?? 'user',
        payload: {
          check: options.check,
          status: options.status,
          ...(options.summary === undefined ? {} : { summary: options.summary }),
          ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
        },
      })
      printResult(value, context.json, mutationMessage('Validation recorded for'))
    })
}

const addReviewCompletion = (program: Command): void => {
  program
    .command('complete-review')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Reviewing harness')
    .option('--artifact <path>', 'Project-relative review artifact path')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: ArtifactOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'complete-review', {
        actor: options.harness ?? 'user',
        payload: {
          ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
        },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Review completed for'))
    })
}

const addRemediation = (program: Command): void => {
  program
    .command('plan-remediation')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Planning harness')
    .option('--artifact <path>', 'Project-relative remediation plan artifact path')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: ArtifactOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'plan-remediation', {
        actor: options.harness ?? 'user',
        payload: {
          ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
        },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Remediation planned for'))
    })

  program
    .command('approve-remediation')
    .argument('<workflow-id>')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: OpenFlagOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'approve-remediation', {
        actor: 'user',
        payload: { acknowledgedMaterialDecisions: true },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Remediation plan approved for'))
    })

  program
    .command('start-remediation')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Remediating harness')
    .option('--artifact <path>', 'Project-relative remediation artifact path')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: ArtifactOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'start-remediation', {
        actor: options.harness ?? 'user',
        payload: {
          ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
        },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Remediation started for'))
    })

  program
    .command('complete-remediation')
    .argument('<workflow-id>')
    .requiredOption('--harness <harness>', 'Remediating harness')
    .requiredOption(
      '--resolved <finding-id>',
      'Resolved blocking finding ID (repeatable)',
      collectResolved,
    )
    .option('--artifact <path>', 'Project-relative remediation artifact path')
    .option('--no-open', 'Skip opening the visual workbench')
    .action(async (workflowId: string, options: CompleteRemediationOptions, command: Command) => {
      const context = await projectContext(command)
      const value = await context.core.performAction(workflowId, 'complete-remediation', {
        actor: options.harness ?? 'user',
        payload: {
          resolvedFindingIds: [...options.resolved],
          ...(options.artifact === undefined ? {} : { artifactPath: options.artifact }),
        },
      })
      const output = await withOptionalWorkbench(context, value, {
        kind: 'mutate',
        openFlag: options.open,
        workflowId,
      })
      printResult(output, context.json, mutationMessage('Remediation completed for'))
    })
}

export const addProgressCommands = (program: Command): void => {
  addExecutionCompletion(program)
  addFinding(program)
  addValidation(program)
  addReviewCompletion(program)
  addRemediation(program)
}
