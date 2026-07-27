import { access } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import type { PhasewireConfig, WriteConfigInput } from '@phasewire/core'
import { PhasewireCoreFacade } from '@phasewire/server/core-facade'

import { ADAPTER_HOSTS, type AdapterHost } from './adapters/catalog.js'
import type { AdapterScope } from './adapters/hosts.js'
import { installAdapters, parseAdapterHosts } from './adapters/install.js'
import { printResult } from './output.js'
import { askConfirm, askMultiSelect, askSelect, askText } from './prompt.js'

export const DEFAULT_VALIDATION_CHOICES = ['lint', 'typecheck', 'build', 'test'] as const
export const HARNESS_CHOICES = ['user', ...ADAPTER_HOSTS] as const

export interface SetupAnswers {
  readonly autoOpen: boolean
  readonly defaultHarness: string
  readonly hosts: readonly AdapterHost[]
  readonly installAdapters: boolean
  readonly projectId: string
  readonly scope: AdapterScope
  readonly validations: readonly string[]
}

export interface SetupFlags {
  readonly autoOpen?: boolean
  readonly defaultHarness?: string
  readonly hosts?: string
  readonly noAdapters?: boolean
  readonly projectId?: string
  readonly scope?: string
  readonly validation?: readonly string[]
  readonly yes?: boolean
}

export interface SetupApplyResult {
  readonly adapters?: {
    readonly files: readonly string[]
    readonly hosts: readonly AdapterHost[]
    readonly scope: AdapterScope
  }
  readonly config: PhasewireConfig
  readonly initialized: boolean
  readonly projectRoot: string
}

const hasConfig = async (root: string): Promise<boolean> => {
  try {
    await access(resolve(root, '.phasewire', 'config.json'))
    return true
  } catch {
    return false
  }
}

const defaultProjectId = (root: string): string =>
  basename(root).replace(/[^A-Za-z0-9._-]/gu, '-') || 'phasewire-project'

const parseScope = (value: string | undefined, fallback: AdapterScope = 'project'): AdapterScope => {
  if (value === undefined || value.trim().length === 0) return fallback
  if (value === 'project' || value === 'user') return value
  throw new Error("Scope must be 'project' or 'user'")
}

const parseHosts = (value: string | undefined): readonly AdapterHost[] => {
  if (value === undefined || value.trim().length === 0) return [...ADAPTER_HOSTS]
  return parseAdapterHosts(value)
}

export const isInteractiveSetup = (options: {
  readonly json?: boolean
  readonly yes?: boolean
}): boolean =>
  options.yes !== true &&
  options.json !== true &&
  process.stdin.isTTY === true &&
  process.stdout.isTTY === true

const nonInteractiveAnswers = (
  root: string,
  flags: SetupFlags,
  existing?: PhasewireConfig,
): SetupAnswers => {
  const projectId = flags.projectId ?? existing?.projectId ?? defaultProjectId(root)
  const defaultHarness = flags.defaultHarness ?? existing?.defaultHarness ?? 'user'
  const hosts =
    flags.hosts !== undefined
      ? parseHosts(flags.hosts)
      : existing?.adapters?.hosts !== undefined
        ? parseAdapterHosts(existing.adapters.hosts.join(','))
        : [...ADAPTER_HOSTS]
  const scope = parseScope(flags.scope, existing?.adapters?.scope ?? 'project')
  const validations =
    flags.validation !== undefined && flags.validation.length > 0
      ? flags.validation.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
      : existing?.requiredValidations !== undefined && existing.requiredValidations.length > 0
        ? [...existing.requiredValidations]
        : [...DEFAULT_VALIDATION_CHOICES]
  return {
    autoOpen: flags.autoOpen ?? existing?.ui?.autoOpenOnMutate ?? false,
    defaultHarness,
    hosts,
    installAdapters: flags.noAdapters !== true,
    projectId,
    scope,
    validations,
  }
}

export const resolveSetupAnswers = async (
  root: string,
  flags: SetupFlags,
  existing?: PhasewireConfig,
): Promise<SetupAnswers> => {
  const base = nonInteractiveAnswers(root, flags, existing)
  if (!isInteractiveSetup({ ...(flags.yes === undefined ? {} : { yes: flags.yes }) })) return base

  const projectId = await askText('Project id', base.projectId)
  const defaultHarness = await askSelect(
    'Default harness',
    [...HARNESS_CHOICES],
    HARNESS_CHOICES.includes(base.defaultHarness as (typeof HARNESS_CHOICES)[number])
      ? base.defaultHarness
      : 'user',
  )
  const installAdaptersFlag = await askConfirm('Install harness adapters?', base.installAdapters)
  const hosts = installAdaptersFlag
    ? ((await askMultiSelect('Adapter hosts', [...ADAPTER_HOSTS], base.hosts)) as readonly AdapterHost[])
    : base.hosts
  const scope = installAdaptersFlag
    ? ((await askSelect('Adapter scope', ['project', 'user'], base.scope)) as AdapterScope)
    : base.scope
  const validationDefaults = base.validations.filter((entry) =>
    (DEFAULT_VALIDATION_CHOICES as readonly string[]).includes(entry),
  )
  const validations = await askMultiSelect(
    'Required validations',
    [...DEFAULT_VALIDATION_CHOICES],
    validationDefaults.length > 0 ? validationDefaults : [...DEFAULT_VALIDATION_CHOICES],
  )
  const autoOpen = await askConfirm('Auto-open workbench on mutations?', base.autoOpen)

  return {
    autoOpen,
    defaultHarness,
    hosts,
    installAdapters: installAdaptersFlag,
    projectId: projectId.trim().length > 0 ? projectId.trim() : base.projectId,
    scope,
    validations: validations.length > 0 ? validations : base.validations,
  }
}

export const applySetup = async (
  root: string,
  answers: SetupAnswers,
): Promise<SetupApplyResult> => {
  const core = new PhasewireCoreFacade(root)
  const initialized = !(await hasConfig(root))
  const partial: WriteConfigInput = {
    projectId: answers.projectId,
    defaultHarness: answers.defaultHarness,
    requiredValidations: [...answers.validations],
    ui: {
      autoOpenOnMutate: answers.autoOpen,
      autoOpenOnStatusWithId: false,
    },
  }

  if (initialized) {
    await core.initialize({
      ...partial,
      ...(answers.installAdapters
        ? { adapters: { hosts: [...answers.hosts], scope: answers.scope } }
        : {}),
    })
  }

  let config = await core.writeConfig(partial)
  let adapters: SetupApplyResult['adapters']

  if (answers.installAdapters) {
    const installed = await installAdapters({
      hosts: answers.hosts,
      projectRoot: root,
      scope: answers.scope,
    })
    config = await core.writeConfig({
      adapters: {
        hosts: [...installed.hosts],
        scope: installed.scope,
        installedAt: new Date().toISOString(),
      },
    })
    adapters = {
      files: installed.files,
      hosts: installed.hosts,
      scope: installed.scope,
    }
  }

  return {
    ...(adapters === undefined ? {} : { adapters }),
    config,
    initialized,
    projectRoot: root,
  }
}

export const formatSetupSummary = (result: SetupApplyResult): string => {
  const lines = [
    result.initialized
      ? `Initialized Phasewire in ${result.projectRoot}`
      : `Updated Phasewire config in ${result.projectRoot}`,
    `Project id: ${result.config.projectId}`,
    `Default harness: ${result.config.defaultHarness ?? 'user'}`,
    `Validations: ${result.config.requiredValidations.join(', ') || '(none)'}`,
    `Auto-open on mutate: ${result.config.ui?.autoOpenOnMutate === true ? 'yes' : 'no'}`,
  ]
  if (result.adapters !== undefined) {
    lines.push(
      `Adapters: ${result.adapters.hosts.join(', ')} (${result.adapters.scope})`,
      `Adapter files: ${String(result.adapters.files.length)}`,
    )
  } else {
    lines.push('Adapters: skipped')
  }
  return lines.join('\n')
}

export const runSetup = async (
  root: string,
  flags: SetupFlags,
  json: boolean,
): Promise<SetupApplyResult> => {
  const core = new PhasewireCoreFacade(root)
  const existing = (await hasConfig(root)) ? await core.readConfig() : undefined
  const answers = await resolveSetupAnswers(root, flags, existing)
  const result = await applySetup(root, answers)
  printResult(result, json, (value) => formatSetupSummary(value as SetupApplyResult))
  return result
}
