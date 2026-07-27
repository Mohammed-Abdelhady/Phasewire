import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { PhasewireCoreFacade } from '@phasewire/server/core-facade'

import { createProgram } from './index.js'

const HARNESS = 'codex'
const USER = 'user'
const roots: string[] = []

const temporaryRoot = async (): Promise<string> => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'phasewire-cli-progress-')))
  roots.push(root)
  return root
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

const run = async (root: string, ...arguments_: readonly string[]): Promise<void> => {
  await createProgram().parseAsync([
    process.execPath,
    'phasewire',
    '--project-root',
    root,
    '--json',
    ...arguments_,
  ])
}

const silenceStdout = (): void => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

const createCore = async (): Promise<{ core: PhasewireCoreFacade; root: string }> => {
  const root = await temporaryRoot()
  const core = new PhasewireCoreFacade(root)
  await core.initialize({ projectId: 'cli-progress' })
  return { core, root }
}

const createApprovedWorkflow = async (
  core: PhasewireCoreFacade,
  workflowId: string,
  title: string,
): Promise<void> => {
  await core.createWorkflow({
    actor: HARNESS,
    requiredValidations: ['lint'],
    title,
    workflowId,
  })
  await core.performAction(workflowId, 'approve-plan', {
    actor: USER,
    payload: { acknowledgedMaterialDecisions: true },
  })
}

const seedPostExecution = async (
  core: PhasewireCoreFacade,
  workflowId: string,
): Promise<void> => {
  await core.performAction(workflowId, 'start-execution', { actor: HARNESS, payload: {} })
  await core.performAction(workflowId, 'complete-execution', {
    actor: HARNESS,
    payload: {
      artifactPath: 'artifacts/execution.json',
      summary: 'Implementation complete',
    },
  })
}

const seedRemediationRequired = async (
  core: PhasewireCoreFacade,
  workflowId: string,
  findingId = 'finding-1',
): Promise<string> => {
  await seedPostExecution(core, workflowId)
  await core.performAction(workflowId, 'start-review', { actor: HARNESS, payload: {} })
  await core.performAction(workflowId, 'finding', {
    actor: HARNESS,
    payload: {
      findingId,
      severity: 'blocking',
      title: 'Correct the boundary',
      rootCause: 'Missing guard',
      resolution: 'Add the guard',
    },
  })
  await core.performAction(workflowId, 'complete-review', { actor: HARNESS, payload: {} })
  return findingId
}

const seedPostRemediation = async (
  core: PhasewireCoreFacade,
  workflowId: string,
  findingId = 'finding-1',
): Promise<string> => {
  await seedRemediationRequired(core, workflowId, findingId)
  await core.performAction(workflowId, 'plan-remediation', { actor: HARNESS, payload: {} })
  await core.performAction(workflowId, 'approve-remediation', {
    actor: USER,
    payload: { acknowledgedMaterialDecisions: true },
  })
  await core.performAction(workflowId, 'start-remediation', { actor: HARNESS, payload: {} })
  await core.performAction(workflowId, 'complete-remediation', {
    actor: HARNESS,
    payload: {
      resolvedFindingIds: [findingId],
      artifactPath: 'artifacts/remediation.json',
    },
  })
  return findingId
}

describe('workflow progress commands', () => {
  it('completes execution from an approved plan and opens review readiness', async () => {
    silenceStdout()
    const { core, root } = await createCore()
    const workflowId = 'wf-execution'
    await createApprovedWorkflow(core, workflowId, 'Execution completion')

    await run(root, 'execute', workflowId, '--harness', HARNESS)
    await run(
      root,
      'complete-execution',
      workflowId,
      '--harness',
      HARNESS,
      '--artifact',
      'artifacts/execution.json',
      '--summary',
      'Implementation complete',
    )

    const workflow = await core.workflowProjection(workflowId)
    expect(workflow.execution.completed).toBe(true)
    expect(workflow.currentPhase).toBe('review')
    expect(workflow.review.started).toBe(false)
  })

  it('records a blocking review that requires remediation', async () => {
    silenceStdout()
    const { core, root } = await createCore()
    const workflowId = 'wf-blocking-review'
    await createApprovedWorkflow(core, workflowId, 'Blocking review')
    await seedPostExecution(core, workflowId)

    await run(root, 'review', workflowId, '--harness', HARNESS)
    await run(
      root,
      'finding',
      workflowId,
      '--harness',
      HARNESS,
      '--severity',
      'blocking',
      '--title',
      'Correct the boundary',
      '--root-cause',
      'Missing guard',
      '--resolution',
      'Add the guard',
    )
    await run(root, 'complete-review', workflowId, '--harness', HARNESS)

    const workflow = await core.workflowProjection(workflowId)
    expect(workflow.currentPhase).toBe('remediation')
    expect(workflow.review.completed).toBe(true)
    expect(workflow.deploymentReadiness.ready).toBe(false)
    expect(workflow.review.findings[0]?.severity).toBe('blocking')
    expect(workflow.review.findings[0]?.resolvedByEventId).toBeUndefined()
  })

  it('approves and completes remediation with a resolution event', async () => {
    silenceStdout()
    const { core, root } = await createCore()
    const workflowId = 'wf-remediation'
    await createApprovedWorkflow(core, workflowId, 'Approved remediation')
    const findingId = await seedRemediationRequired(core, workflowId)

    await run(root, 'plan-remediation', workflowId, '--harness', HARNESS)
    await run(root, 'approve-remediation', workflowId)
    await run(root, 'start-remediation', workflowId, '--harness', HARNESS)
    await run(
      root,
      'complete-remediation',
      workflowId,
      '--harness',
      HARNESS,
      '--resolved',
      findingId,
      '--artifact',
      'artifacts/remediation.json',
    )

    const workflow = await core.workflowProjection(workflowId)
    expect(workflow.remediation.completed).toBe(true)
    expect(workflow.review.findings[0]?.resolvedByEventId).toBeDefined()
    expect(workflow.currentPhase).toBe('review')
  })

  it('derives readiness from a fresh clear review and passed validation', async () => {
    silenceStdout()
    const { core, root } = await createCore()
    const workflowId = 'wf-fresh-evidence'
    await createApprovedWorkflow(core, workflowId, 'Fresh evidence')
    await seedPostRemediation(core, workflowId)

    await run(root, 'review', workflowId, '--harness', HARNESS)
    await run(root, 'complete-review', workflowId, '--harness', HARNESS)
    await run(
      root,
      'validate',
      workflowId,
      '--harness',
      HARNESS,
      '--check',
      'lint',
      '--status',
      'passed',
      '--summary',
      'No lint errors',
      '--artifact',
      'artifacts/lint.txt',
    )

    const workflow = await core.workflowProjection(workflowId)
    expect(workflow.deploymentReadiness.ready).toBe(true)
    expect(workflow.validations).toContainEqual(
      expect.objectContaining({ check: 'lint', status: 'passed' }),
    )
  })
})
