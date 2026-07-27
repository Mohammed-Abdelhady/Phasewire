import type { PhasewireConfig, PhasewireUiConfig } from '@phasewire/core'
import openBrowser from 'open'

import { ensureService } from '@phasewire/server/launcher'

export type WorkbenchOpenKind = 'mutate' | 'status' | 'explicit' | 'never'

export interface OpenPolicyInput {
  readonly kind: WorkbenchOpenKind
  readonly openFlag?: boolean
  readonly config: Readonly<{ ui?: PhasewireUiConfig }> | PhasewireConfig
  readonly json?: boolean
}

export interface WorkbenchLaunch {
  readonly opened: boolean
  readonly url: string
}

/** Pure open policy used by CLI mutators and status. */
export const shouldOpenWorkbench = (options: OpenPolicyInput): boolean => {
  if (options.openFlag === false) return false
  if (options.kind === 'never') return false
  if (options.kind === 'explicit') return true
  if (options.kind === 'status') return options.config.ui?.autoOpenOnStatusWithId === true
  return options.config.ui?.autoOpenOnMutate !== false
}

/**
 * Launch the local workbench. When `shouldOpen` is true the browser opens with a
 * tokenized session URL; the returned `url` is redacted (no token) for safe display.
 * When `shouldOpen` is false the full launch URL (with token) is returned for
 * explicit `open --no-open` copy/paste use.
 */
export const openWorkbench = async (
  root: string,
  workflowId: string | undefined,
  shouldOpen: boolean,
): Promise<WorkbenchLaunch> => {
  const endpoint = await ensureService(root)
  const query = new URLSearchParams({
    token: endpoint.token,
    ...(workflowId === undefined ? {} : { workflow: workflowId }),
  })
  const launchUrl = `${endpoint.origin}/session?${query.toString()}`
  if (!shouldOpen) return { opened: false, url: launchUrl }
  await openBrowser(launchUrl)
  const fragment = workflowId === undefined ? '' : `#workflow=${encodeURIComponent(workflowId)}`
  return { opened: true, url: `${endpoint.origin}/${fragment}` }
}

export const maybeOpenWorkbench = async (
  root: string,
  workflowId: string | undefined,
  options: OpenPolicyInput,
): Promise<WorkbenchLaunch | undefined> => {
  if (!shouldOpenWorkbench(options)) return undefined
  return openWorkbench(root, workflowId, true)
}
