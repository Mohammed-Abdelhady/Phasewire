import { PhasewireError } from './errors.js'
import { CONFIG_SCHEMA_VERSION } from './store-helpers.js'
import type {
  PhasewireAdaptersConfig, PhasewireConfig, PhasewireUiConfig, WriteConfigInput,
} from './types.js'

export function parseDefaultHarness(value: object): string | undefined {
  if (!('defaultHarness' in value) || value.defaultHarness === undefined) return undefined
  if (typeof value.defaultHarness !== 'string' || value.defaultHarness.trim().length === 0) {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  return value.defaultHarness
}

export function parseAdaptersConfig(value: object): PhasewireAdaptersConfig | undefined {
  if (!('adapters' in value) || value.adapters === undefined) return undefined
  if (typeof value.adapters !== 'object' || value.adapters === null || Array.isArray(value.adapters)) {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  const adapters = value.adapters as Record<string, unknown>
  if (!Array.isArray(adapters.hosts) || !adapters.hosts.every((entry) => typeof entry === 'string' && entry.length > 0)) {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  if (adapters.scope !== 'project' && adapters.scope !== 'user') {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  if (adapters.installedAt !== undefined && (typeof adapters.installedAt !== 'string' || adapters.installedAt.length === 0)) {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  return {
    hosts: adapters.hosts as readonly string[],
    scope: adapters.scope,
    ...(typeof adapters.installedAt === 'string' ? { installedAt: adapters.installedAt } : {}),
  }
}

export function parseUiConfig(value: object): PhasewireUiConfig | undefined {
  if (!('ui' in value) || value.ui === undefined) return undefined
  if (typeof value.ui !== 'object' || value.ui === null || Array.isArray(value.ui)) {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  const ui = value.ui as Record<string, unknown>
  if (typeof ui.autoOpenOnMutate !== 'boolean' || typeof ui.autoOpenOnStatusWithId !== 'boolean') {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  return {
    autoOpenOnMutate: ui.autoOpenOnMutate,
    autoOpenOnStatusWithId: ui.autoOpenOnStatusWithId,
  }
}

export function assertAdaptersConfig(adapters: PhasewireAdaptersConfig): void {
  if (!adapters.hosts.every((entry) => entry.trim().length > 0)) {
    throw new PhasewireError('adapters.hosts entries must be non-empty strings', 'INVALID_CONFIG')
  }
  if (adapters.scope !== 'project' && adapters.scope !== 'user') {
    throw new PhasewireError('adapters.scope must be project or user', 'INVALID_CONFIG')
  }
}

export function parsePhasewireConfig(value: unknown): PhasewireConfig {
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || typeof value.schemaVersion !== 'number') {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  if (value.schemaVersion > CONFIG_SCHEMA_VERSION) {
    throw new PhasewireError('A newer schema is read-only; export is still available', 'NEWER_SCHEMA_READ_ONLY')
  }
  if (value.schemaVersion < CONFIG_SCHEMA_VERSION) {
    throw new PhasewireError('Project schema migration is required', 'MIGRATION_REQUIRED')
  }
  if (!('projectId' in value) || typeof value.projectId !== 'string' ||
    !('defaultTemplateId' in value) || typeof value.defaultTemplateId !== 'string' ||
    !('requiredValidations' in value) || !Array.isArray(value.requiredValidations) ||
    !value.requiredValidations.every((entry) => typeof entry === 'string')) {
    throw new PhasewireError('Invalid .phasewire/config.json', 'INVALID_CONFIG')
  }
  const defaultHarness = parseDefaultHarness(value)
  const adapters = parseAdaptersConfig(value)
  const ui = parseUiConfig(value)
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    projectId: value.projectId,
    defaultTemplateId: value.defaultTemplateId,
    requiredValidations: value.requiredValidations,
    ...(defaultHarness === undefined ? {} : { defaultHarness }),
    ...(adapters === undefined ? {} : { adapters }),
    ...(ui === undefined ? {} : { ui }),
  }
}

export function mergeConfigPartial(current: PhasewireConfig, partial: WriteConfigInput): PhasewireConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    projectId: partial.projectId ?? current.projectId,
    defaultTemplateId: partial.defaultTemplateId ?? current.defaultTemplateId,
    requiredValidations: [...(partial.requiredValidations ?? current.requiredValidations)],
    ...(partial.defaultHarness !== undefined
      ? { defaultHarness: partial.defaultHarness }
      : current.defaultHarness === undefined ? {} : { defaultHarness: current.defaultHarness }),
    ...(partial.adapters !== undefined
      ? { adapters: partial.adapters }
      : current.adapters === undefined ? {} : { adapters: current.adapters }),
    ...(partial.ui !== undefined
      ? { ui: partial.ui }
      : current.ui === undefined ? {} : { ui: current.ui }),
  }
}

export function isConfigSchemaV2(value: unknown): value is PhasewireConfig {
  if (typeof value !== 'object' || value === null) return false
  const config = value as Record<string, unknown>
  if (config.schemaVersion !== CONFIG_SCHEMA_VERSION) return false
  if (typeof config.projectId !== 'string' || typeof config.defaultTemplateId !== 'string') return false
  if (!Array.isArray(config.requiredValidations) || !config.requiredValidations.every((entry) => typeof entry === 'string')) {
    return false
  }
  try {
    parseDefaultHarness(config)
    parseAdaptersConfig(config)
    parseUiConfig(config)
    return true
  } catch {
    return false
  }
}
