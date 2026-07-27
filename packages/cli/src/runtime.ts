import type { PhasewireConfig, WorkflowPhase } from '@phasewire/core'
import { InvalidArgumentError, type Command } from 'commander'

import { PhasewireCoreFacade } from '@phasewire/server/core-facade'

import { formatStatus } from './output.js'
import { discoverProjectRoot } from './project-root.js'
import {
  maybeOpenWorkbench,
  openWorkbench,
  shouldOpenWorkbench,
  type OpenPolicyInput,
  type WorkbenchLaunch,
  type WorkbenchOpenKind,
} from './ui-open.js'

export type { OpenPolicyInput, WorkbenchLaunch, WorkbenchOpenKind }
export { maybeOpenWorkbench, openWorkbench, shouldOpenWorkbench }

export interface GlobalOptions {
  readonly json?: boolean
  readonly projectRoot?: string
}

export interface HarnessOptions {
  readonly harness?: string
}

export interface OpenFlagOptions {
  readonly open: boolean
}

export interface PlanOptions extends HarnessOptions, OpenFlagOptions {
  readonly id?: string
  readonly template?: string
  readonly validation: readonly string[]
}

export interface ClaimOptions extends HarnessOptions, OpenFlagOptions {
  readonly phase: WorkflowPhase
  readonly ttl?: number
}

export interface ReleaseOptions extends HarnessOptions {
  readonly phase: WorkflowPhase
}

export interface ProjectCoreContext {
  readonly core: PhasewireCoreFacade
  readonly json: boolean
  readonly root: string
}

export interface ProjectContext extends ProjectCoreContext {
  readonly config: PhasewireConfig
}

export const collect = (value: string, previous: readonly string[]): readonly string[] => [
  ...previous,
  value,
]

export const parsePositiveInteger = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Must be a positive integer')
  }
  return parsed
}

export const parsePhase = (value: string): WorkflowPhase => {
  if (value === 'plan' || value === 'execute' || value === 'review' || value === 'remediation') {
    return value
  }
  throw new InvalidArgumentError('Phase must be plan, execute, review, or remediation')
}

export const globalOptions = (command: Command): GlobalOptions =>
  command.optsWithGlobals<GlobalOptions>()

export const projectCoreContext = async (command: Command): Promise<ProjectCoreContext> => {
  const options = globalOptions(command)
  const root = await discoverProjectRoot(process.cwd(), options.projectRoot)
  return {
    core: new PhasewireCoreFacade(root),
    json: options.json ?? false,
    root,
  }
}

export const projectContext = async (command: Command): Promise<ProjectContext> => {
  const base = await projectCoreContext(command)
  return {
    ...base,
    config: await base.core.readConfig(),
  }
}

/** Resolve harness: --harness > PHASEWIRE_HARNESS > config.defaultHarness > user */
export const resolveHarness = (
  flag: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
  config: Readonly<{ defaultHarness?: string }>,
): string => {
  const fromFlag = flag?.trim()
  if (fromFlag !== undefined && fromFlag.length > 0) return fromFlag
  const fromEnv = env.PHASEWIRE_HARNESS?.trim()
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv
  const fromConfig = config.defaultHarness?.trim()
  if (fromConfig !== undefined && fromConfig.length > 0) return fromConfig
  return 'user'
}

export const resultWorkflow = (value: unknown): unknown => {
  if (typeof value === 'object' && value !== null && 'workflow' in value) return value.workflow
  return value
}

export const extractWorkflowId = (value: unknown, fallback?: string): string | undefined => {
  const workflow = resultWorkflow(value)
  if (typeof workflow === 'object' && workflow !== null && 'workflowId' in workflow) {
    return String(workflow.workflowId)
  }
  return fallback
}

export const mutationMessage =
  (verb: string) =>
  (value: unknown): string => {
    const workflow = resultWorkflow(value)
    if (typeof workflow === 'object' && workflow !== null && 'workflowId' in workflow) {
      return `${verb} ${String(workflow.workflowId)}\n${formatStatus(workflow)}`
    }
    return verb
  }

export const withOptionalWorkbench = async (
  context: ProjectContext,
  value: unknown,
  options: {
    readonly kind: WorkbenchOpenKind
    readonly openFlag?: boolean
    readonly workflowId?: string
  },
): Promise<unknown> => {
  const workflowId = extractWorkflowId(value, options.workflowId)
  const policy: OpenPolicyInput = {
    config: context.config,
    json: context.json,
    kind: options.kind,
    ...(options.openFlag === undefined ? {} : { openFlag: options.openFlag }),
  }
  const ui = await maybeOpenWorkbench(context.root, workflowId, policy)
  if (ui === undefined) return value
  if (typeof value === 'object' && value !== null) return { ...value, ui }
  return { result: value, ui }
}
