#!/usr/bin/env node
import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { parseServiceCliOptions } from './cli-options.js'
import { startService } from './service.js'

export { actionNames, buildServiceApp } from './app.js'
export { PhasewireCoreFacade } from './core-facade.js'
export { endpointFilePath, readEndpoint } from './endpoint.js'
export { ensureService } from './launcher.js'
export { startService } from './service.js'
export type { CoreGateway, WorkflowMutationResult } from './core-gateway.js'
export type {
  EndpointDescriptor,
  EnsureServiceOptions,
  JsonPrimitive,
  JsonValue,
  RunningService,
  ServiceOptions,
  WorkflowActionInput,
  WorkflowEventInput,
} from './types.js'

const run = async (): Promise<void> => {
  const options = parseServiceCliOptions(process.argv.slice(2))
  if (options.projectRoot === undefined) throw new Error('Missing --project-root')
  const projectRoot = await realpath(resolve(options.projectRoot))
  const service = await startService({
    projectRoot,
    ...(options.port === undefined ? {} : { port: options.port }),
  })

  process.stdout.write(
    `phasewire service listening on ${service.endpoint.origin} (pid ${String(service.endpoint.pid)})\n`,
  )

  const shutdown = (): void => {
    void service.close().finally(() => {
      process.exit(0)
    })
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

const invokedPath = process.argv[1]
if (invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  run().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
