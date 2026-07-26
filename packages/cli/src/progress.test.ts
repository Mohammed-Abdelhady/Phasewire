import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { PhasewireCoreFacade } from '@phasewire/server/core-facade'

import { createProgram } from './index.js'

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

describe('workflow progress commands', () => {
  it('drives execution, review, remediation, and validation through reducer-valid events', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const root = await temporaryRoot()
    const core = new PhasewireCoreFacade(root)
    await core.initialize({ projectId: 'cli-progress' })
    await core.createWorkflow({
      actor: 'codex',
      requiredValidations: ['lint'],
      title: 'Exercise every workflow command',
      workflowId: 'wf-progress',
    })
    await core.performAction('wf-progress', 'approve-plan', {
      actor: 'user',
      payload: { acknowledgedMaterialDecisions: true },
    })

    await run(root, 'execute', 'wf-progress', '--harness', 'codex')
    await run(
      root,
      'complete-execution',
      'wf-progress',
      '--harness',
      'codex',
      '--artifact',
      'artifacts/execution.json',
      '--summary',
      'Implementation complete',
    )
    await run(root, 'review', 'wf-progress', '--harness', 'codex')
    await run(
      root,
      'finding',
      'wf-progress',
      '--harness',
      'codex',
      '--severity',
      'blocking',
      '--title',
      'Correct the boundary',
      '--root-cause',
      'Missing guard',
      '--resolution',
      'Add the guard',
    )
    const findingId = (await core.workflowProjection('wf-progress')).review.findings[0]?.id
    if (findingId === undefined) throw new Error('Expected a blocking finding')

    await run(root, 'complete-review', 'wf-progress', '--harness', 'codex')
    await run(root, 'plan-remediation', 'wf-progress', '--harness', 'codex')
    await run(root, 'approve-remediation', 'wf-progress')
    await run(root, 'start-remediation', 'wf-progress', '--harness', 'codex')
    await run(
      root,
      'complete-remediation',
      'wf-progress',
      '--harness',
      'codex',
      '--resolved',
      findingId,
      '--artifact',
      'artifacts/remediation.json',
    )
    await run(root, 'review', 'wf-progress', '--harness', 'codex')
    await run(root, 'complete-review', 'wf-progress', '--harness', 'codex')
    await run(
      root,
      'validate',
      'wf-progress',
      '--harness',
      'codex',
      '--check',
      'lint',
      '--status',
      'passed',
      '--summary',
      'No lint errors',
      '--artifact',
      'artifacts/lint.txt',
    )

    const workflow = await core.workflowProjection('wf-progress')
    expect(workflow.deploymentReadiness.ready).toBe(true)
    expect(workflow.review.findings[0]?.resolvedByEventId).toBeDefined()
    expect(workflow.validations).toContainEqual(
      expect.objectContaining({ check: 'lint', status: 'passed' }),
    )
  })
})
