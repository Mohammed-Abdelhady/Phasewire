import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildServiceApp, PhasewireCoreFacade } from '@phasewire/server'

const PORT = 4317
const TOKEN = 'phasewire-e2e-token'
const WORKFLOW_ID = 'wf-live-e2e'

const projectRoot = await realpath(await mkdtemp(join(tmpdir(), 'phasewire-web-e2e-')))
const core = new PhasewireCoreFacade(projectRoot)
await core.initialize({ projectId: 'phasewire-web-e2e' })
await core.createWorkflow({
  actor: 'codex',
  requiredValidations: [],
  title: 'Live service persistence workflow with a deliberately descriptive title',
  workflowId: WORKFLOW_ID,
})

const app = await buildServiceApp({ core, projectRoot, token: TOKEN })
await app.listen({ host: '127.0.0.1', port: PORT })

const close = (): void => {
  void app.close().finally(async () => {
    await rm(projectRoot, { force: true, recursive: true })
    process.exit(0)
  })
}

process.once('SIGINT', close)
process.once('SIGTERM', close)
