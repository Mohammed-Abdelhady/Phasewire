import { randomUUID } from 'node:crypto'

import {
  TemplateRegistry,
  WorkflowStore,
  scaffoldVisualTemplate,
  type EventInput,
  type EventType,
  type JsonObject,
  type HandoffPacket,
  type InitOptions,
  type PhasewireConfig,
  type ReconciliationResolution,
  type ScaffoldVisualTemplateOptions,
  type VisualTemplate,
  type WorkflowProjection,
  type WriteConfigInput,
} from '@phasewire/core'

import type { CoreGateway, WorkflowMutationResult } from './core-gateway.js'
import { createHandoff, listHandoffs } from './handoffs.js'
import type { JsonValue, WorkflowActionInput, WorkflowEventInput } from './types.js'
import {
  EVENT_ACTIONS, STRUCTURAL_EVENT_TYPES, phaseForEvent, phaseFromPayload, toActor,
} from './workflow-actions.js'

interface CreateWorkflowOptions {
  readonly actor: string
  readonly requiredValidations?: readonly string[]
  readonly templateId?: string
  readonly title: string
  readonly workflowId?: string
}

export class IllegalTransitionError extends Error {
  readonly code = 'ILLEGAL_TRANSITION'
  readonly nextCommand: string

  constructor(message: string, nextCommand: string) {
    super(message)
    this.name = 'IllegalTransitionError'
    this.nextCommand = nextCommand
  }
}

const toJsonObject = (payload: Readonly<Record<string, JsonValue>> | undefined): JsonObject =>
  payload ?? {}

const reconciliationResolution = (
  payload: Readonly<Record<string, JsonValue>> | undefined,
): ReconciliationResolution | undefined => {
  const resolution = payload?.resolution
  if (typeof resolution !== 'object' || resolution === null || Array.isArray(resolution)) return undefined
  if (
    resolution.strategy !== 'select-parent' ||
    typeof resolution.selectedParent !== 'string' ||
    typeof resolution.rationale !== 'string'
  ) {
    return undefined
  }
  return {
    strategy: 'select-parent',
    selectedParent: resolution.selectedParent,
    rationale: resolution.rationale,
  }
}

export class PhasewireCoreFacade implements CoreGateway {
  readonly #store: WorkflowStore
  readonly #templates: TemplateRegistry

  constructor(projectRoot: string) {
    this.#store = new WorkflowStore(projectRoot)
    this.#templates = new TemplateRegistry(projectRoot)
  }

  async initialize(options: InitOptions = {}): Promise<unknown> {
    return this.#store.init(options)
  }

  async writeConfig(partial: WriteConfigInput): Promise<PhasewireConfig> {
    return this.#store.writeConfig(partial)
  }

  async readConfig(): Promise<PhasewireConfig> {
    return this.#store.readConfig()
  }

  async createWorkflow(options: CreateWorkflowOptions): Promise<WorkflowMutationResult> {
    const workflowId = options.workflowId ?? `wf-${randomUUID()}`
    await this.#store.createWorkflow({
      actor: toActor(options.actor),
      idempotencyKey: randomUUID(),
      ...(options.requiredValidations === undefined
        ? {}
        : { requiredValidations: [...options.requiredValidations] }),
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
      title: options.title,
      workflowId,
    })
    const event = await this.#store.append({
      actor: toActor(options.actor),
      idempotencyKey: randomUUID(),
      payload: { goal: options.title },
      phase: 'plan',
      type: 'plan.proposed',
      workflowId,
    })
    return { event, workflow: await this.#store.loadWorkflow(workflowId) }
  }

  async listWorkflows(): Promise<unknown> {
    return this.#store.listWorkflows()
  }

  async loadWorkflow(workflowId: string): Promise<unknown> {
    return this.#store.loadWorkflow(workflowId)
  }

  async beginExecution(workflowId: string, actorName: string): Promise<WorkflowMutationResult> {
    const actor = toActor(actorName)
    const workflow = await this.#store.loadWorkflow(workflowId)
    if (!workflow.plan.approved) {
      throw new IllegalTransitionError(
        'Execution cannot start until the plan is explicitly approved.',
        `phasewire open ${workflowId}`,
      )
    }
    const event = await this.#store.append({
      actor,
      idempotencyKey: randomUUID(),
      payload: {},
      phase: 'execute',
      type: 'execution.started',
      workflowId,
    })
    return { event, workflow: await this.#store.loadWorkflow(workflowId) }
  }

  async beginReview(workflowId: string, actorName: string): Promise<WorkflowMutationResult> {
    const actor = toActor(actorName)
    const workflow = await this.#store.loadWorkflow(workflowId)
    if (!workflow.execution.completed) {
      throw new IllegalTransitionError(
        'Review cannot start until execution is explicitly completed.',
        `phasewire open ${workflowId}`,
      )
    }
    const event = await this.#store.append({
      actor,
      idempotencyKey: randomUUID(),
      payload: {},
      phase: 'review',
      type: 'review.started',
      workflowId,
    })
    return { event, workflow: await this.#store.loadWorkflow(workflowId) }
  }

  async workflowProjection(workflowId: string): Promise<WorkflowProjection> {
    return this.#store.loadWorkflow(workflowId)
  }

  async appendEvent(workflowId: string, input: WorkflowEventInput): Promise<WorkflowMutationResult> {
    if (STRUCTURAL_EVENT_TYPES.has(input.type)) {
      throw new IllegalTransitionError(
        `${input.type} must use its dedicated Phasewire command or API`,
        `phasewire status ${workflowId}`,
      )
    }
    const fixedPhase = phaseForEvent(input.type)
    const phase = input.type === 'decision.recorded' || input.type === 'annotation.recorded'
      ? (await this.#store.loadWorkflow(workflowId)).currentPhase
      : fixedPhase
    const event = await this.#store.append({
      actor: toActor(input.actor),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      ...(input.logicalClock === undefined ? {} : { logicalClock: input.logicalClock }),
      ...(input.occurredAt === undefined ? {} : { occurredAt: input.occurredAt }),
      ...(input.parents === undefined ? {} : { parents: input.parents }),
      payload: toJsonObject(input.payload),
      phase,
      type: input.type as EventType,
      workflowId,
    })
    return { event, workflow: await this.#store.loadWorkflow(workflowId) }
  }

  async performAction(
    workflowId: string,
    action: string,
    input: WorkflowActionInput,
  ): Promise<WorkflowMutationResult> {
    if (input.actor === undefined) throw new Error('Workflow action requires an explicit actor')
    const actor = toActor(input.actor)
    let event: unknown

    if (action === 'claim') {
      const phase = phaseFromPayload(input.payload)
      event = await this.#store.claimPhase(workflowId, phase, actor, {
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
        ...(typeof input.payload?.ttlMs === 'number' ? { ttlMs: input.payload.ttlMs } : {}),
      })
    } else if (action === 'release') {
      event = await this.#store.releasePhase(workflowId, phaseFromPayload(input.payload), actor, {
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
      })
    } else if (action === 'reconcile') {
      const resolution = reconciliationResolution(input.payload)
      event = await this.#store.reconcile(workflowId, actor, {
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
        ...(resolution === undefined ? {} : { resolution }),
        ...(typeof input.payload?.note === 'string' ? { note: input.payload.note } : {}),
      })
    } else {
      const definition = EVENT_ACTIONS[action]
      if (definition === undefined) throw new Error(`Unknown workflow action: ${action}`)
      const eventInput: EventInput = {
        actor,
        idempotencyKey: input.idempotencyKey ?? randomUUID(),
        payload: toJsonObject(input.payload),
        phase: definition.type === 'decision.recorded' || definition.type === 'annotation.recorded'
          ? (await this.#store.loadWorkflow(workflowId)).currentPhase
          : definition.phase,
        type: definition.type,
        workflowId,
      }
      event = await this.#store.append(eventInput)
    }

    return { event, workflow: await this.#store.loadWorkflow(workflowId) }
  }

  async doctor(): Promise<unknown> {
    return this.#store.doctor()
  }

  async rebuild(): Promise<unknown> {
    return this.#store.rebuildIndex()
  }

  async migrate(): Promise<unknown> {
    return this.#store.migrate()
  }

  async exportProject(): Promise<unknown> {
    return this.#store.exportProject()
  }

  async createHandoff(value: Readonly<Record<string, unknown>>): Promise<unknown> {
    return createHandoff(this.#store, value)
  }

  async listHandoffs(workflowId?: string): Promise<readonly HandoffPacket[]> {
    return listHandoffs(this.#store, workflowId)
  }

  async searchTemplates(query?: string): Promise<unknown> {
    const templates = await this.#templates.list()
    if (query === undefined || query.trim() === '') return templates
    const needle = query.toLowerCase()
    return templates.filter((template) => JSON.stringify(template).toLowerCase().includes(needle))
  }

  async listTemplates(): Promise<readonly VisualTemplate[]> {
    return this.#templates.list()
  }

  scaffoldTemplate(options: ScaffoldVisualTemplateOptions): VisualTemplate {
    return scaffoldVisualTemplate(options)
  }

  validateTemplate(template: VisualTemplate): readonly string[] {
    return this.#templates.validate(template)
  }

  async installTemplate(template: VisualTemplate): Promise<string> {
    return this.#templates.install(template)
  }

  async getTemplate(id: string, version?: string): Promise<VisualTemplate | undefined> {
    return this.#templates.get(id, version)
  }

  composeTemplates(base: VisualTemplate, overlay: VisualTemplate): VisualTemplate {
    return this.#templates.compose(base, overlay)
  }

  async pinTemplate(id: string, version: string): Promise<unknown> {
    return this.#templates.pin(id, version)
  }
}
