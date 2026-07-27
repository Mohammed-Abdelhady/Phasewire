import { mkdir, readdir } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'

import { createEventEnvelope } from './canonical.js'
import {
  ActiveClaimError, PhasewireError, StoreBusyError, WorkflowConflictError, WorkflowNotFoundError,
} from './errors.js'
import {
  assertAdaptersConfig, mergeConfigPartial, parsePhasewireConfig,
} from './config.js'
import {
  acquireDirectoryLock, pathExists, readJson, writeJsonImmutable, writeJsonReplace, writeTextImmutable,
} from './files.js'
import { assertSecurePath, assertSecurePhasewireRoot, assertSecureRootEntry } from './paths.js'
import { assertWorkflowEvent, replayWorkflow } from './replay.js'
import {
  CONFIG_SCHEMA_VERSION, DEFAULT_UI_PREFS, DEFAULT_VALIDATIONS, MAX_CLAIM_TTL_MS, PHASEWIRE_DIRS,
  assertEventInput, assertSafeIdentifier, assertTimestamp, configAsJson, equalSets, eventAsJson, eventIntent,
  inputIntent,
} from './store-helpers.js'
import { TemplateRegistry } from './templates.js'
import type {
  CreateWorkflowInput, EventInput, InitOptions, PhasewireConfig, WorkflowEvent, WorkflowProjection,
  WorkflowStoreOptions, WorkflowSummary, WriteConfigInput,
} from './types.js'

export class WorkflowStoreBase {
  public readonly projectRoot: string
  public readonly phasewireRoot: string
  public readonly templates: TemplateRegistry
  private readonly now: () => Date

  public constructor(projectRoot: string, options: WorkflowStoreOptions = {}) {
    this.projectRoot = resolve(projectRoot)
    assertSecureRootEntry(this.projectRoot)
    this.phasewireRoot = join(this.projectRoot, PHASEWIRE_DIRS.root)
    this.templates = new TemplateRegistry(this.projectRoot)
    this.now = options.now ?? (() => new Date())
  }

  protected trustedTimestamp(): string {
    return this.now().toISOString()
  }

  public async init(options: InitOptions = {}): Promise<PhasewireConfig> {
    await assertSecurePhasewireRoot(this.projectRoot, this.phasewireRoot)
    const defaultProjectId = basename(this.projectRoot).replace(/[^A-Za-z0-9._-]/g, '-') || 'phasewire-project'
    const config: PhasewireConfig = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      projectId: options.projectId ?? defaultProjectId,
      defaultTemplateId: options.defaultTemplateId ?? 'phasewire.default',
      requiredValidations: [...(options.requiredValidations ?? DEFAULT_VALIDATIONS)],
      ...(options.defaultHarness === undefined ? {} : { defaultHarness: options.defaultHarness }),
      ...(options.adapters === undefined ? {} : { adapters: options.adapters }),
      ui: options.ui ?? { ...DEFAULT_UI_PREFS },
    }
    assertSafeIdentifier(config.projectId, 'projectId')
    const directories = [
      PHASEWIRE_DIRS.workflows, PHASEWIRE_DIRS.plans, PHASEWIRE_DIRS.decisions,
      PHASEWIRE_DIRS.executions, PHASEWIRE_DIRS.reviews, PHASEWIRE_DIRS.validations,
      PHASEWIRE_DIRS.handoffs, PHASEWIRE_DIRS.templates, PHASEWIRE_DIRS.runtime,
    ]
    for (const directory of directories) {
      const path = join(this.phasewireRoot, directory)
      await this.assertSecureStorePath(path)
      await mkdir(path, { recursive: true })
      await this.assertSecureStorePath(path)
    }
    const configPath = join(this.phasewireRoot, 'config.json')
    if (!(await pathExists(configPath))) await writeJsonImmutable(configPath, configAsJson(config), this.projectRoot)
    const ignorePath = join(this.phasewireRoot, '.gitignore')
    await this.assertSecureStorePath(ignorePath)
    if (!(await pathExists(ignorePath))) await writeTextImmutable(ignorePath, '.runtime/\n', this.projectRoot)
    await this.templates.initialize()
    return this.readConfig()
  }

  public async readConfig(): Promise<PhasewireConfig> {
    const path = join(this.phasewireRoot, 'config.json')
    await this.assertSecureStorePath(path)
    return parsePhasewireConfig(await readJson(path, this.projectRoot))
  }

  public async writeConfig(partial: WriteConfigInput): Promise<PhasewireConfig> {
    await this.assertWritableSchema()
    const next = mergeConfigPartial(await this.readConfig(), partial)
    assertSafeIdentifier(next.projectId, 'projectId')
    if (next.defaultHarness !== undefined && next.defaultHarness.trim().length === 0) {
      throw new PhasewireError('defaultHarness must be a non-empty string', 'INVALID_CONFIG')
    }
    if (next.adapters !== undefined) assertAdaptersConfig(next.adapters)
    const configPath = join(this.phasewireRoot, 'config.json')
    await this.assertSecureStorePath(configPath)
    await writeJsonReplace(configPath, configAsJson(next), this.projectRoot)
    return this.readConfig()
  }

  public async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowEvent> {
    assertSafeIdentifier(input.workflowId, 'workflowId')
    if (input.title.trim().length === 0) throw new PhasewireError('title is required', 'INVALID_TITLE')
    const config = await this.readConfig()
    return this.append({
      workflowId: input.workflowId, type: 'workflow.created', phase: 'plan', actor: input.actor,
      idempotencyKey: input.idempotencyKey,
      payload: {
        title: input.title, templateId: input.templateId ?? config.defaultTemplateId,
        requiredValidations: [...(input.requiredValidations ?? config.requiredValidations)],
      },
      ...(input.occurredAt === undefined ? {} : { occurredAt: input.occurredAt }),
    })
  }

  public async listWorkflows(): Promise<readonly WorkflowSummary[]> {
    const workflowsPath = join(this.phasewireRoot, PHASEWIRE_DIRS.workflows)
    await this.assertSecureStorePath(workflowsPath)
    if (!(await pathExists(workflowsPath))) return []
    const entries = await readdir(workflowsPath, { withFileTypes: true })
    const summaries: WorkflowSummary[] = []
    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      try {
        const projection = await this.loadWorkflow(entry.name)
        summaries.push({
          workflowId: projection.workflowId, title: projection.title, status: projection.status,
          currentPhase: projection.currentPhase, cycle: projection.cycle, lastEventAt: projection.lastEventAt,
          heads: projection.heads, deploymentReady: projection.deploymentReadiness.ready,
        })
      } catch (error) {
        if (!(error instanceof WorkflowNotFoundError)) throw error
      }
    }
    return summaries.sort((left, right) => right.lastEventAt.localeCompare(left.lastEventAt))
  }

  public async loadEvents(workflowId: string): Promise<readonly WorkflowEvent[]> {
    assertSafeIdentifier(workflowId, 'workflowId')
    const eventsPath = this.eventsPath(workflowId)
    await this.assertSecureStorePath(eventsPath)
    if (!(await pathExists(eventsPath))) throw new WorkflowNotFoundError(workflowId)
    const filenames = (await readdir(eventsPath)).filter((name) => name.endsWith('.json')).sort()
    if (filenames.length === 0) throw new WorkflowNotFoundError(workflowId)
    const events: WorkflowEvent[] = []
    for (const filename of filenames) {
      const eventPath = join(eventsPath, filename)
      const raw = await readJson(eventPath, this.projectRoot)
      assertWorkflowEvent(raw, eventPath)
      if (filename !== `${raw.eventId}.json`) throw new PhasewireError(`Event filename does not match eventId: ${filename}`, 'EVENT_FILENAME_MISMATCH')
      events.push(raw)
    }
    return events
  }

  public async loadWorkflow(workflowId: string): Promise<WorkflowProjection> {
    return replayWorkflow(await this.loadEvents(workflowId))
  }

  public async append(input: EventInput): Promise<WorkflowEvent> {
    assertEventInput(input)
    await this.assertWritableSchema()
    await this.assertSecureStorePath(this.eventsPath(input.workflowId))
    const releaseLock = await this.lock(input.workflowId)
    try {
      const eventsPath = this.eventsPath(input.workflowId)
      const exists = await pathExists(eventsPath)
      const existing = exists ? await this.loadEvents(input.workflowId) : []
      const duplicate = existing.find((event) => event.idempotencyKey === input.idempotencyKey)
      if (duplicate !== undefined) {
        if (eventIntent(duplicate) !== inputIntent(input)) throw new PhasewireError(`Idempotency key ${input.idempotencyKey} was already used for a different event`, 'IDEMPOTENCY_CONFLICT')
        return duplicate
      }
      if (existing.length === 0 && input.type !== 'workflow.created') throw new WorkflowNotFoundError(input.workflowId)
      if (existing.length > 0 && input.type === 'workflow.created') throw new PhasewireError(`Workflow ${input.workflowId} already exists`, 'WORKFLOW_EXISTS')
      const projection = existing.length === 0 ? undefined : replayWorkflow(existing)
      if (projection?.conflicted === true && input.type !== 'workflow.reconciled') throw new WorkflowConflictError(input.workflowId, projection.heads)
      if (input.type === 'workflow.reconciled' && (projection === undefined || projection.heads.length < 2)) {
        throw new PhasewireError('Reconciliation requires a workflow with multiple heads', 'INVALID_RECONCILIATION')
      }
      const expectedParents = projection?.heads ?? []
      const parents = [...(input.parents ?? expectedParents)].sort()
      if (!equalSets(parents, expectedParents)) throw new PhasewireError('Event parents must match the current workflow heads', 'STALE_EVENT_PARENTS')
      const parentEvents = parents.map((parent) => existing.find((event) => event.eventId === parent))
      if (parentEvents.some((event) => event === undefined)) throw new PhasewireError('Event references an unknown parent', 'UNKNOWN_EVENT_PARENT')
      const expectedClock = parents.length === 0 ? 0 : Math.max(...parentEvents.map((event) => event?.logicalClock ?? -1)) + 1
      if (input.logicalClock !== undefined && input.logicalClock !== expectedClock) throw new PhasewireError(`logicalClock must be ${expectedClock}`, 'INVALID_LOGICAL_CLOCK')
      const activeClaim = projection?.claims[input.phase]
      const claimControlsTimestamp = input.type === 'phase.claimed' || (activeClaim !== undefined &&
        activeClaim.releasedByEventId === undefined && activeClaim.interruptedAt === undefined)
      const occurredAt = claimControlsTimestamp ? this.trustedTimestamp() : input.occurredAt ?? this.trustedTimestamp()
      assertTimestamp(occurredAt, 'occurredAt')
      if (input.type === 'phase.claimed') {
        const leaseExpiresAt = input.payload.leaseExpiresAt
        const leaseDuration = typeof leaseExpiresAt === 'string'
          ? Date.parse(leaseExpiresAt) - Date.parse(occurredAt)
          : Number.NaN
        if (!Number.isFinite(leaseDuration) || leaseDuration <= 0 || leaseDuration > MAX_CLAIM_TTL_MS) {
          throw new PhasewireError('Claim lease exceeds the trusted maximum duration', 'INVALID_CLAIM_TTL')
        }
      }
      if (input.type === 'phase.claimed' && projection !== undefined) {
        const active = projection.claims[input.phase]
        if (active !== undefined && active.releasedByEventId === undefined && active.interruptedAt === undefined &&
          Date.parse(active.leaseExpiresAt) > Date.parse(occurredAt)) throw new ActiveClaimError(input.workflowId, input.phase)
      }
      const event = createEventEnvelope({ ...input, occurredAt, parents, logicalClock: expectedClock })
      replayWorkflow([...existing, event])
      await writeJsonImmutable(join(eventsPath, `${event.eventId}.json`), eventAsJson(event), this.projectRoot)
      return event
    } finally {
      await releaseLock()
    }
  }

  protected eventsPath(workflowId: string): string {
    const path = resolve(this.phasewireRoot, PHASEWIRE_DIRS.workflows, workflowId, 'events')
    const inside = relative(this.phasewireRoot, path)
    if (inside.startsWith('..') || inside.includes(`${sep}..${sep}`)) throw new PhasewireError('Workflow path escapes the project', 'PATH_ESCAPE')
    return path
  }

  protected async assertSecureStorePath(path: string): Promise<void> {
    await assertSecurePhasewireRoot(this.projectRoot, this.phasewireRoot)
    await assertSecurePath(this.projectRoot, path)
  }

  private async assertWritableSchema(): Promise<void> {
    const configPath = join(this.phasewireRoot, 'config.json')
    if (!(await pathExists(configPath))) return
    const config = await readJson(configPath, this.projectRoot)
    if (typeof config === 'object' && config !== null && 'schemaVersion' in config && typeof config.schemaVersion === 'number') {
      if (config.schemaVersion > CONFIG_SCHEMA_VERSION) {
        throw new PhasewireError('A newer schema is read-only; export is still available', 'NEWER_SCHEMA_READ_ONLY')
      }
      if (config.schemaVersion < CONFIG_SCHEMA_VERSION) {
        throw new PhasewireError('Project schema migration is required', 'MIGRATION_REQUIRED')
      }
    }
  }

  private async lock(workflowId: string): Promise<() => Promise<void>> {
    const lockPath = join(this.phasewireRoot, PHASEWIRE_DIRS.runtime, 'locks', `${workflowId}.lock`)
    await this.assertSecureStorePath(lockPath)
    try {
      return await acquireDirectoryLock(lockPath, { trustedRoot: this.projectRoot })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') throw new StoreBusyError(workflowId)
      throw error
    }
  }
}
