import type {
  HandoffPacket,
  ScaffoldVisualTemplateOptions,
  VisualTemplate,
} from '@phasewire/core'

import type { WorkflowActionInput, WorkflowEventInput } from './types.js'

export interface WorkflowMutationResult {
  readonly event: unknown
  readonly workflow: unknown
}

export interface CoreGateway {
  appendEvent(workflowId: string, input: WorkflowEventInput): Promise<WorkflowMutationResult>
  createHandoff(input: Readonly<Record<string, unknown>>): Promise<unknown>
  doctor(): Promise<unknown>
  listHandoffs(workflowId?: string): Promise<readonly HandoffPacket[]>
  listWorkflows(): Promise<unknown>
  loadWorkflow(workflowId: string): Promise<unknown>
  performAction(
    workflowId: string,
    action: string,
    input: WorkflowActionInput,
  ): Promise<WorkflowMutationResult>
  scaffoldTemplate(options: ScaffoldVisualTemplateOptions): VisualTemplate
  searchTemplates(query?: string): Promise<unknown>
}
