import { homedir } from 'node:os'
import { join } from 'node:path'

import type { AdapterHost } from './catalog.js'

export type AdapterScope = 'project' | 'user'

export interface HostInstallPlan {
  readonly commandDir?: string
  readonly host: AdapterHost
  readonly pluginManifestPath?: string
  readonly pluginManifestKind?: 'claude' | 'codex'
  readonly skillRoot: string
  readonly skillNamespace: 'flat' | 'plugin'
  readonly workflowDir?: string
}

export const resolveHostPlans = (
  projectRoot: string,
  host: AdapterHost,
  scope: AdapterScope,
): readonly HostInstallPlan[] => {
  const home = homedir()
  if (host === 'claude') {
    if (scope === 'project') {
      return [
        {
          host,
          skillRoot: join(projectRoot, '.claude', 'skills'),
          skillNamespace: 'flat',
          commandDir: join(projectRoot, '.claude', 'commands'),
        },
        {
          host,
          skillRoot: join(projectRoot, '.claude', 'plugins', 'phasewire', 'skills'),
          skillNamespace: 'plugin',
          pluginManifestPath: join(
            projectRoot,
            '.claude',
            'plugins',
            'phasewire',
            '.claude-plugin',
            'plugin.json',
          ),
          pluginManifestKind: 'claude',
        },
      ]
    }
    return [
      {
        host,
        skillRoot: join(home, '.claude', 'skills'),
        skillNamespace: 'flat',
      },
    ]
  }

  if (host === 'codex') {
    const root =
      scope === 'project' ? join(projectRoot, '.codex', 'skills') : join(home, '.codex', 'skills')
    return [
      {
        host,
        skillRoot: root,
        skillNamespace: 'flat',
        pluginManifestPath:
          scope === 'project'
            ? join(projectRoot, '.codex-plugin', 'plugin.json')
            : join(home, '.codex', 'plugins', 'phasewire', '.codex-plugin', 'plugin.json'),
        pluginManifestKind: 'codex',
      },
    ]
  }

  if (host === 'grok') {
    const root =
      scope === 'project' ? join(projectRoot, '.grok', 'skills') : join(home, '.grok', 'skills')
    return [
      {
        host,
        skillRoot: root,
        skillNamespace: 'flat',
      },
    ]
  }

  // Antigravity / Agy
  if (scope === 'project') {
    return [
      {
        host,
        skillRoot: join(projectRoot, '.agent', 'skills'),
        skillNamespace: 'flat',
        workflowDir: join(projectRoot, '.agent', 'workflows'),
      },
    ]
  }
  return [
    {
      host,
      skillRoot: join(home, '.gemini', 'antigravity', 'skills'),
      skillNamespace: 'flat',
      workflowDir: join(home, '.gemini', 'antigravity', 'workflows'),
    },
  ]
}
