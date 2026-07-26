import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import {
  ADAPTER_HOSTS,
  ADAPTER_SKILLS,
  type AdapterHost,
  type AdapterSkill,
} from './catalog.js'
import { resolveHostPlans, type AdapterScope, type HostInstallPlan } from './hosts.js'
import {
  renderClaudeCommandMarkdown,
  renderCodexPluginJson,
  renderPluginJson,
  renderSkillMarkdown,
} from './render.js'

export interface AdapterInstallRequest {
  readonly hosts: readonly AdapterHost[]
  readonly projectRoot: string
  readonly scope: AdapterScope
}

export interface AdapterInstallResult {
  readonly files: readonly string[]
  readonly hosts: readonly AdapterHost[]
  readonly scope: AdapterScope
}

const pluginSkillName = (skill: AdapterSkill): string =>
  skill.id === 'phasewire' ? 'phasewire' : skill.id

const skillDirectoryName = (plan: HostInstallPlan, skill: AdapterSkill): string => {
  if (plan.skillNamespace === 'plugin') return pluginSkillName(skill)
  return skill.skillName
}

const commandRelativePath = (skill: AdapterSkill): string => {
  // Nested `.claude/commands/phasewire/plan.md` becomes `/phasewire:plan`.
  if (skill.id === 'phasewire') return 'phasewire.md'
  return join('phasewire', `${skill.id}.md`)
}

const writeText = async (path: string, contents: string, files: string[]): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, 'utf8')
  files.push(path)
}

const installPlan = async (
  plan: HostInstallPlan,
  files: string[],
): Promise<void> => {
  for (const skill of ADAPTER_SKILLS) {
    const skillDir = join(plan.skillRoot, skillDirectoryName(plan, skill))
    const rendered = renderSkillMarkdown(
      plan.skillNamespace === 'plugin'
        ? { ...skill, skillName: pluginSkillName(skill) }
        : skill,
      plan.host,
    )
    await writeText(join(skillDir, 'SKILL.md'), rendered, files)

    if (plan.commandDir !== undefined) {
      await writeText(
        join(plan.commandDir, commandRelativePath(skill)),
        renderClaudeCommandMarkdown(skill),
        files,
      )
    }

    if (plan.workflowDir !== undefined) {
      await writeText(
        join(plan.workflowDir, `${skill.skillName}.md`),
        renderSkillMarkdown(skill, plan.host),
        files,
      )
    }
  }

  if (plan.pluginManifestPath !== undefined) {
    const manifest =
      plan.pluginManifestKind === 'codex' ? renderCodexPluginJson() : renderPluginJson()
    await writeText(plan.pluginManifestPath, manifest, files)
  }
}

export const parseAdapterHosts = (value: string): readonly AdapterHost[] => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'all') return ADAPTER_HOSTS
  if ((ADAPTER_HOSTS as readonly string[]).includes(normalized)) {
    return [normalized as AdapterHost]
  }
  throw new Error(`Unknown harness '${value}'. Use claude, codex, grok, agy, or all.`)
}

export const installAdapters = async (
  request: AdapterInstallRequest,
): Promise<AdapterInstallResult> => {
  const files: string[] = []
  for (const host of request.hosts) {
    const plans = resolveHostPlans(request.projectRoot, host, request.scope)
    for (const plan of plans) await installPlan(plan, files)
  }
  return {
    files: files.sort(),
    hosts: request.hosts,
    scope: request.scope,
  }
}
