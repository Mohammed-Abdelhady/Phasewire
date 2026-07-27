import type { PhasewireConfig, WriteConfigInput } from '@phasewire/core'

export const CONFIG_SET_KEYS = [
  'projectId',
  'defaultHarness',
  'defaultTemplateId',
  'requiredValidations',
  'ui.autoOpenOnMutate',
  'ui.autoOpenOnStatusWithId',
] as const

export type ConfigSetKey = (typeof CONFIG_SET_KEYS)[number]

const parseBoolean = (value: string, key: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'n') {
    return false
  }
  throw new Error(`${key} must be true or false`)
}

export const parseConfigSetValue = (key: string, value: string): WriteConfigInput => {
  if (key === 'projectId') {
    if (value.trim().length === 0) throw new Error('projectId must be a non-empty string')
    return { projectId: value.trim() }
  }
  if (key === 'defaultHarness') {
    if (value.trim().length === 0) throw new Error('defaultHarness must be a non-empty string')
    return { defaultHarness: value.trim() }
  }
  if (key === 'defaultTemplateId') {
    if (value.trim().length === 0) throw new Error('defaultTemplateId must be a non-empty string')
    return { defaultTemplateId: value.trim() }
  }
  if (key === 'requiredValidations') {
    return {
      requiredValidations: value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    }
  }
  if (key === 'ui.autoOpenOnMutate') {
    return {
      ui: {
        autoOpenOnMutate: parseBoolean(value, key),
        autoOpenOnStatusWithId: false,
      },
    }
  }
  if (key === 'ui.autoOpenOnStatusWithId') {
    return {
      ui: {
        autoOpenOnMutate: false,
        autoOpenOnStatusWithId: parseBoolean(value, key),
      },
    }
  }
  throw new Error(`Unsupported config key '${key}'. Supported: ${CONFIG_SET_KEYS.join(', ')}`)
}

/** Preserve the sibling UI flag from current config when only one key is being set. */
export const withPreservedUi = (
  current: PhasewireConfig,
  key: string,
  partial: WriteConfigInput,
): WriteConfigInput => {
  if (partial.ui === undefined) return partial
  if (key === 'ui.autoOpenOnMutate') {
    return {
      ...partial,
      ui: {
        autoOpenOnMutate: partial.ui.autoOpenOnMutate,
        autoOpenOnStatusWithId: current.ui?.autoOpenOnStatusWithId ?? false,
      },
    }
  }
  if (key === 'ui.autoOpenOnStatusWithId') {
    return {
      ...partial,
      ui: {
        autoOpenOnMutate: current.ui?.autoOpenOnMutate ?? false,
        autoOpenOnStatusWithId: partial.ui.autoOpenOnStatusWithId,
      },
    }
  }
  return partial
}
