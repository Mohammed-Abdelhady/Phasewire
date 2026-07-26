import type { WorkflowPhase } from '@phasewire/core'
import { InvalidArgumentError, type Command } from 'commander'
import openBrowser from 'open'

import { PhasewireCoreFacade } from '@phasewire/server/core-facade'
import { ensureService } from '@phasewire/server/launcher'

import { formatStatus } from './output.js'
import { discoverProjectRoot } from './project-root.js'

export interface GlobalOptions {
  readonly json?: boolean
  readonly projectRoot?: string
}

export interface HarnessOptions {
  readonly harness: string
}

export interface PlanOptions extends HarnessOptions {
  readonly id?: string
  readonly open: boolean
  readonly template?: string
  readonly validation: readonly string[]
}

export interface ClaimOptions extends HarnessOptions {
  readonly phase: WorkflowPhase
  readonly ttl?: number
}

export interface ReleaseOptions extends HarnessOptions {
  readonly phase: WorkflowPhase
}

export interface ProjectContext {
  readonly core: PhasewireCoreFacade
  readonly json: boolean
  readonly root: string
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

export const projectContext = async (command: Command): Promise<ProjectContext> => {
  const options = globalOptions(command)
  const root = await discoverProjectRoot(process.cwd(), options.projectRoot)
  return { core: new PhasewireCoreFacade(root), json: options.json ?? false, root }
}

export const resultWorkflow = (value: unknown): unknown => {
  if (typeof value === 'object' && value !== null && 'workflow' in value) return value.workflow
  return value
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

export const openWorkbench = async (
  root: string,
  workflowId: string | undefined,
  shouldOpen: boolean,
): Promise<Readonly<{ opened: boolean; url: string }>> => {
  const endpoint = await ensureService(root)
  const query = new URLSearchParams({
    token: endpoint.token,
    ...(workflowId === undefined ? {} : { workflow: workflowId }),
  })
  const launchUrl = `${endpoint.origin}/session?${query.toString()}`
  if (!shouldOpen) return { opened: false, url: launchUrl }
  await openBrowser(launchUrl)
  const fragment = workflowId === undefined ? '' : `#workflow=${encodeURIComponent(workflowId)}`
  return { opened: true, url: `${endpoint.origin}/${fragment}` }
}
