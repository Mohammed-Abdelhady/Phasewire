import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { PhasewireCoreFacade } from './core-facade.js'

const roots: string[] = []

async function project(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'phasewire-facade-security-')))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })))
})

describe('core facade security', () => {
  it('maps global actions to the current phase before claim enforcement', async () => {
    const core = new PhasewireCoreFacade(await project())
    await core.initialize()
    await core.createWorkflow({ actor: 'owner', title: 'Claimed plan', workflowId: 'claimed-plan' })
    await core.performAction('claimed-plan', 'claim', {
      actor: 'owner',
      payload: { phase: 'plan', ttlMs: 60_000 },
    })

    await expect(core.performAction('claimed-plan', 'decision', {
      actor: 'other',
      payload: { decisionId: 'bypass', outcome: 'Unsafe', title: 'Cross phase' },
    })).rejects.toThrow('requires ownership')
    await expect(core.performAction('claimed-plan', 'annotation', {
      actor: 'other',
      payload: { body: 'Unsafe' },
    })).rejects.toThrow('requires ownership')
  })

  it('reserves structural events for their dedicated APIs', async () => {
    const core = new PhasewireCoreFacade(await project())
    await core.initialize()
    await core.createWorkflow({ actor: 'owner', title: 'Review claim', workflowId: 'review-claim' })
    await core.performAction('review-claim', 'approve-plan', {
      actor: 'user', payload: { acknowledgedMaterialDecisions: true },
    })
    await core.performAction('review-claim', 'start-execution', { actor: 'owner', payload: {} })
    await core.performAction('review-claim', 'complete-execution', { actor: 'owner', payload: {} })
    await core.performAction('review-claim', 'start-review', { actor: 'owner', payload: {} })
    await core.performAction('review-claim', 'claim', {
      actor: 'owner', payload: { phase: 'review', ttlMs: 60_000 },
    })

    await expect(core.appendEvent('review-claim', {
      actor: 'other', payload: { handoffId: 'unsafe' }, type: 'handoff.created',
    })).rejects.toThrow('dedicated Phasewire command or API')
  })
})
