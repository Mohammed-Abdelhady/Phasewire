import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import Database from 'better-sqlite3'

import type { WorkflowStore } from './store.js'
import { assertSecurePath, assertSecurePhasewireRoot } from './paths.js'
import type { WorkflowEvent, WorkflowProjection, WorkflowSummary } from './types.js'

export interface IndexRebuildResult {
  readonly databasePath: string
  readonly workflowCount: number
  readonly eventCount: number
}

interface WorkflowRow {
  workflow_id: string
  title: string
  status: WorkflowSummary['status']
  current_phase: WorkflowSummary['currentPhase']
  cycle: number
  last_event_at: string
  deployment_ready: number
  projection_json: string
}

export class DisposableWorkflowIndex {
  private readonly database: Database.Database

  public constructor(public readonly databasePath: string) {
    this.database = new Database(databasePath)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('foreign_keys = ON')
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        workflow_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        current_phase TEXT NOT NULL,
        cycle INTEGER NOT NULL,
        last_event_at TEXT NOT NULL,
        deployment_ready INTEGER NOT NULL,
        projection_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflows(workflow_id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        phase TEXT NOT NULL,
        logical_clock INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        event_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_workflow_clock
        ON events(workflow_id, logical_clock, event_id);
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  public async rebuild(store: WorkflowStore): Promise<IndexRebuildResult> {
    const summaries = await store.listWorkflows()
    const records: Array<{ readonly projection: WorkflowProjection; readonly events: readonly WorkflowEvent[] }> = []
    for (const summary of summaries) {
      records.push({
        projection: await store.loadWorkflow(summary.workflowId),
        events: await store.loadEvents(summary.workflowId),
      })
    }

    const clear = this.database.prepare('DELETE FROM workflows')
    const insertWorkflow = this.database.prepare(`
      INSERT INTO workflows (
        workflow_id, title, status, current_phase, cycle, last_event_at, deployment_ready, projection_json
      ) VALUES (
        @workflowId, @title, @status, @currentPhase, @cycle, @lastEventAt, @deploymentReady, @projectionJson
      )
    `)
    const insertEvent = this.database.prepare(`
      INSERT INTO events (event_id, workflow_id, type, phase, logical_clock, occurred_at, event_json)
      VALUES (@eventId, @workflowId, @type, @phase, @logicalClock, @occurredAt, @eventJson)
    `)
    const setMetadata = this.database.prepare(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (@key, @value)',
    )
    const transaction = this.database.transaction(() => {
      clear.run()
      let eventCount = 0
      for (const record of records) {
        const projection = record.projection
        insertWorkflow.run({
          workflowId: projection.workflowId,
          title: projection.title,
          status: projection.status,
          currentPhase: projection.currentPhase,
          cycle: projection.cycle,
          lastEventAt: projection.lastEventAt,
          deploymentReady: projection.deploymentReadiness.ready ? 1 : 0,
          projectionJson: JSON.stringify(projection),
        })
        for (const event of record.events) {
          insertEvent.run({
            eventId: event.eventId,
            workflowId: event.workflowId,
            type: event.type,
            phase: event.phase,
            logicalClock: event.logicalClock,
            occurredAt: event.occurredAt,
            eventJson: JSON.stringify(event),
          })
          eventCount += 1
        }
      }
      setMetadata.run({ key: 'schemaVersion', value: '1' })
      setMetadata.run({ key: 'rebuiltAt', value: new Date().toISOString() })
      return eventCount
    })
    const eventCount = transaction()
    return { databasePath: this.databasePath, workflowCount: records.length, eventCount }
  }

  public listWorkflows(): readonly WorkflowSummary[] {
    const rows = this.database.prepare(`
      SELECT workflow_id, title, status, current_phase, cycle, last_event_at,
             deployment_ready, projection_json
      FROM workflows ORDER BY last_event_at DESC
    `).all() as WorkflowRow[]
    return rows.map((row) => {
      const projection = JSON.parse(row.projection_json) as WorkflowProjection
      return {
        workflowId: row.workflow_id,
        title: row.title,
        status: row.status,
        currentPhase: row.current_phase,
        cycle: row.cycle,
        lastEventAt: row.last_event_at,
        heads: projection.heads,
        deploymentReady: row.deployment_ready === 1,
      }
    })
  }

  public getProjection(workflowId: string): WorkflowProjection | undefined {
    const row = this.database
      .prepare('SELECT projection_json FROM workflows WHERE workflow_id = ?')
      .get(workflowId) as { projection_json: string } | undefined
    return row === undefined ? undefined : JSON.parse(row.projection_json) as WorkflowProjection
  }

  public close(): void {
    this.database.close()
  }
}

export async function rebuildIndex(projectRoot: string): Promise<IndexRebuildResult> {
  const { WorkflowStore } = await import('./store.js')
  const absoluteRoot = resolve(projectRoot)
  const databasePath = join(absoluteRoot, '.phasewire', '.runtime', 'index.sqlite')
  await assertSecurePhasewireRoot(absoluteRoot, join(absoluteRoot, '.phasewire'))
  await assertSecurePath(absoluteRoot, databasePath)
  await mkdir(dirname(databasePath), { recursive: true })
  await assertSecurePath(absoluteRoot, dirname(databasePath))
  const index = new DisposableWorkflowIndex(databasePath)
  try {
    return await index.rebuild(new WorkflowStore(absoluteRoot))
  } finally {
    index.close()
  }
}
