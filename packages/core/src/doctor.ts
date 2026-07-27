import { readdir } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

import { isConfigSchemaV2 } from './config.js'
import { pathExists, readJson, readTextFile } from './files.js'
import { assertHandoffPacket } from './handoffs.js'
import { assertSecurePath, assertSecurePhasewireRoot } from './paths.js'
import { assertWorkflowEvent, replayWorkflow } from './replay.js'
import { TemplateRegistry } from './templates.js'
import type { DoctorIssue, DoctorReport, WorkflowEvent } from './types.js'

function issue(
  code: string,
  severity: DoctorIssue['severity'],
  message: string,
  options: { readonly path?: string; readonly workflowId?: string; readonly remediation?: string } = {},
): DoctorIssue {
  return { code, severity, message, ...options }
}

function redactIssue(entry: DoctorIssue, projectRoot: string): DoctorIssue {
  const path = entry.path === undefined ? undefined : relative(projectRoot, entry.path).split(sep).join('/')
  return {
    ...entry,
    message: entry.message.replaceAll(projectRoot, '<project>'),
    ...(path === undefined ? {} : { path: path.startsWith('../') ? '<outside-project>' : path }),
  }
}

export async function doctorProject(projectRoot: string): Promise<DoctorReport> {
  const absoluteRoot = resolve(projectRoot)
  const phasewireRoot = join(absoluteRoot, '.phasewire')
  await assertSecurePhasewireRoot(absoluteRoot, phasewireRoot)
  const issues: DoctorIssue[] = []
  let workflowCount = 0

  const requiredPaths = [
    'config.json',
    'template-lock.json',
    'workflows',
    'artifacts/plans',
    'artifacts/decisions',
    'artifacts/executions',
    'artifacts/reviews',
    'artifacts/validations',
    'handoffs',
    'templates',
    '.runtime',
  ]
  for (const entry of requiredPaths) {
    const path = join(phasewireRoot, entry)
    await assertSecurePath(absoluteRoot, path)
    if (!(await pathExists(path))) {
      issues.push(issue('MISSING_LAYOUT_PATH', 'error', `Missing required Phasewire path ${entry}`, {
        path,
        remediation: 'Run phasewire init to restore the durable layout.',
      }))
    }
  }

  const ignorePath = join(phasewireRoot, '.gitignore')
  if (!(await pathExists(ignorePath))) {
    issues.push(issue('RUNTIME_NOT_IGNORED', 'error', '.phasewire/.gitignore is missing', {
      path: ignorePath,
      remediation: 'Add .runtime/ to .phasewire/.gitignore.',
    }))
  } else if (!(await readTextFile(ignorePath, absoluteRoot)).split(/\r?\n/u).includes('.runtime/')) {
    issues.push(issue('RUNTIME_NOT_IGNORED', 'error', '.phasewire/.runtime is not ignored', {
      path: ignorePath,
      remediation: 'Add .runtime/ to .phasewire/.gitignore.',
    }))
  }

  const configPath = join(phasewireRoot, 'config.json')
  if (await pathExists(configPath)) {
    try {
      const config = await readJson(configPath, absoluteRoot)
      if (!isConfigSchemaV2(config)) {
        issues.push(issue('INVALID_CONFIG', 'error', 'Phasewire config does not match schema version 2', { path: configPath }))
      }
    } catch (error) {
      issues.push(issue('INVALID_CONFIG_JSON', 'error', error instanceof Error ? error.message : 'Config cannot be read', {
        path: configPath,
      }))
    }
  }

  const registry = new TemplateRegistry(absoluteRoot)
  if (await pathExists(join(phasewireRoot, 'template-lock.json'))) {
    try {
      const lock = await registry.readLock()
      for (const [id, pin] of Object.entries(lock.templates)) {
        if ((await registry.resolve(id)) === undefined) {
          issues.push(issue('PINNED_TEMPLATE_MISSING', 'error', `Pinned template ${id}@${pin.version} is not installed`))
        }
      }
    } catch (error) {
      issues.push(issue('INVALID_TEMPLATE_REGISTRY', 'error', error instanceof Error ? error.message : 'Template registry is invalid'))
    }
  }

  const workflowsPath = join(phasewireRoot, 'workflows')
  if (await pathExists(workflowsPath)) {
    const workflowEntries = await readdir(workflowsPath, { withFileTypes: true })
    for (const workflowEntry of workflowEntries.filter((entry) => entry.isDirectory())) {
      workflowCount += 1
      const eventsPath = join(workflowsPath, workflowEntry.name, 'events')
      try {
        await assertSecurePath(absoluteRoot, eventsPath)
        const files = (await readdir(eventsPath)).filter((name) => name.endsWith('.json')).sort()
        const events: WorkflowEvent[] = []
        for (const file of files) {
          const eventPath = join(eventsPath, file)
          const raw = await readJson(eventPath, absoluteRoot)
          assertWorkflowEvent(raw, file)
          if (file !== `${raw.eventId}.json`) throw new Error(`Filename ${file} does not match ${raw.eventId}`)
          events.push(raw)
        }
        const projection = replayWorkflow(events)
        if (projection.conflicted) {
          issues.push(issue('WORKFLOW_CONFLICT', 'error', 'Workflow has multiple heads and is read-only', {
            workflowId: workflowEntry.name,
            path: eventsPath,
            remediation: 'Create an explicit workflow.reconciled event with every current head as a parent.',
          }))
        }
        const now = Date.now()
        for (const claim of Object.values(projection.claims)) {
          if (claim !== undefined && claim.releasedByEventId === undefined && Date.parse(claim.leaseExpiresAt) <= now) {
            issues.push(issue('EXPIRED_PHASE_CLAIM', 'warning', `Phase ${claim.phase} claim ${claim.claimId} has expired`, {
              workflowId: workflowEntry.name,
            }))
          }
        }
      } catch (error) {
        issues.push(issue('WORKFLOW_REPLAY_FAILED', 'error', error instanceof Error ? error.message : 'Workflow replay failed', {
          workflowId: workflowEntry.name,
          path: eventsPath,
          remediation: 'Restore the immutable event file from Git or reconcile valid concurrent heads.',
        }))
      }
    }
  }

  const handoffsPath = join(phasewireRoot, 'handoffs')
  if (await pathExists(handoffsPath)) {
    await assertSecurePath(absoluteRoot, handoffsPath)
    for (const file of (await readdir(handoffsPath)).filter((name) => name.endsWith('.json'))) {
      try {
        const value = await readJson(join(handoffsPath, file), absoluteRoot)
        assertHandoffPacket(value)
      } catch (error) {
        issues.push(issue('INVALID_HANDOFF', 'error', error instanceof Error ? error.message : 'Handoff cannot be read', {
          path: join(handoffsPath, file),
        }))
      }
    }
  }

  return {
    ok: !issues.some((entry) => entry.severity === 'error'),
    checkedAt: new Date().toISOString(),
    projectRoot: '.',
    workflowCount,
    issues: issues.map((entry) => redactIssue(entry, absoluteRoot)),
  }
}
