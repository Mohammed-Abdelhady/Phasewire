import { canonicalJson, sha256 } from '../canonical.js'
import { PhasewireError } from '../errors.js'
import type { JsonObject, VisualTemplate } from '../types.js'

const NODE_KINDS = new Set(['section', 'stack', 'grid', 'text', 'metric', 'list', 'timeline', 'evidence', 'action'])
const RELATIONS = new Set(['sequence', 'depends-on', 'blocks', 'resolves', 'evidence-for', 'parent-child'])
const FLOWS = new Set(['horizontal', 'vertical', 'radial', 'adaptive'])
const RENDERERS = new Set(['web', 'terminal', 'markdown'])
const FORMATS = new Set(['interactive', 'html', 'markdown', 'json'])
const ACTIONS = new Set(['approve-plan', 'record-decision', 'request-review', 'record-authorization'])
const ROOT_KEYS = new Set([
  'schemaVersion', 'id', 'version', 'name', 'description', 'intendedUse', 'excludedUses', 'inputSchema',
  'requiredData', 'supportedRelations', 'layoutRules', 'semanticTokens', 'motionContract',
  'renderingConstraints', 'rendererCompatibility', 'outputFormats', 'textAlternative', 'regions',
  'accessibility', 'integrity',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`)
}

function strings(
  value: unknown,
  options: { min?: number; unique?: boolean; allowed?: ReadonlySet<string> } = {},
): value is readonly string[] {
  if (!Array.isArray(value) || value.length < (options.min ?? 0) || !value.every((entry) => typeof entry === 'string')) return false
  if (options.unique === true && new Set(value).size !== value.length) return false
  return options.allowed === undefined || value.every((entry) => options.allowed?.has(entry) === true)
}

function requiredString(value: Record<string, unknown>, key: string, path: string, errors: string[]): void {
  if (typeof value[key] !== 'string' || value[key].length === 0) errors.push(`${path}.${key} is required`)
}

function validateNodeAccessibility(value: unknown, path: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${path} must be an object`); return }
  exactKeys(value, new Set(['role', 'label', 'description', 'headingLevel', 'live', 'keyboardAction', 'reducedMotionEquivalent', 'directionAware']), path, errors)
  for (const key of ['role', 'label', 'description', 'keyboardAction'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') errors.push(`${path}.${key} must be a string`)
  }
  if (value.headingLevel !== undefined && (!Number.isInteger(value.headingLevel) || Number(value.headingLevel) < 1 || Number(value.headingLevel) > 6)) errors.push(`${path}.headingLevel is invalid`)
  if (value.live !== undefined && (typeof value.live !== 'string' || !new Set(['off', 'polite', 'assertive']).has(value.live))) errors.push(`${path}.live is invalid`)
  for (const key of ['reducedMotionEquivalent', 'directionAware'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') errors.push(`${path}.${key} must be boolean`)
  }
}

function validateNode(value: unknown, path: string, ids: Set<string>, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${path} must be an object`); return }
  exactKeys(value, new Set(['id', 'kind', 'label', 'binding', 'action', 'accessibility', 'children']), path, errors)
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.id)) errors.push(`${path}.id is invalid`)
  else if (ids.has(value.id)) errors.push(`${path}.id duplicates ${value.id}`)
  else ids.add(value.id)
  if (typeof value.kind !== 'string' || !NODE_KINDS.has(value.kind)) errors.push(`${path}.kind is invalid`)
  if (value.label !== undefined && typeof value.label !== 'string') errors.push(`${path}.label must be a string`)
  if (value.binding !== undefined && (typeof value.binding !== 'string' || !/^[A-Za-z0-9_.]+$/.test(value.binding))) errors.push(`${path}.binding is invalid`)
  if (value.action !== undefined && (typeof value.action !== 'string' || !ACTIONS.has(value.action))) errors.push(`${path}.action is invalid`)
  validateNodeAccessibility(value.accessibility, `${path}.accessibility`, errors)
  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) errors.push(`${path}.children must be an array`)
    else value.children.forEach((child, index) => validateNode(child, `${path}.children[${index}]`, ids, errors))
  }
}

function validateLayout(value: unknown, errors: string[]): void {
  if (!isObject(value)) { errors.push('layoutRules must be an object'); return }
  exactKeys(value, new Set(['preferredFlow', 'minimumViewportWidth', 'maximumColumns', 'dense', 'rtlMirrored']), 'layoutRules', errors)
  if (typeof value.preferredFlow !== 'string' || !FLOWS.has(value.preferredFlow)) errors.push('layoutRules.preferredFlow is invalid')
  for (const key of ['minimumViewportWidth', 'maximumColumns'] as const) {
    if (!Number.isInteger(value[key]) || Number(value[key]) < 1) errors.push(`layoutRules.${key} must be a positive integer`)
  }
  if (typeof value.dense !== 'boolean') errors.push('layoutRules.dense must be boolean')
  if (typeof value.rtlMirrored !== 'boolean') errors.push('layoutRules.rtlMirrored must be boolean')
}

function validateSemanticTokens(value: unknown, errors: string[]): void {
  if (!isObject(value)) { errors.push('semanticTokens must be an object'); return }
  exactKeys(value, new Set(['color', 'statuses']), 'semanticTokens', errors)
  if (!isObject(value.color) || !Object.values(value.color).every((entry) => typeof entry === 'string')) errors.push('semanticTokens.color is invalid')
  if (!Array.isArray(value.statuses)) { errors.push('semanticTokens.statuses must be an array'); return }
  value.statuses.forEach((status, index) => {
    if (!isObject(status)) { errors.push(`semanticTokens.statuses[${index}] must be an object`); return }
    exactKeys(status, new Set(['id', 'label', 'colorToken', 'nonColorCue']), `semanticTokens.statuses[${index}]`, errors)
    for (const key of ['id', 'label', 'colorToken', 'nonColorCue']) {
      if (typeof status[key] !== 'string') errors.push(`semanticTokens.statuses[${index}].${key} must be a string`)
    }
  })
}

function validateContracts(value: Record<string, unknown>, errors: string[]): void {
  const motion = value.motionContract
  if (!isObject(motion)) errors.push('motionContract must be an object')
  else {
    exactKeys(motion, new Set(['enabledByDefault', 'transitionDurationMs', 'easing', 'reducedMotion', 'noEssentialMotion']), 'motionContract', errors)
    if (typeof motion.enabledByDefault !== 'boolean') errors.push('motionContract.enabledByDefault must be boolean')
    if (!Number.isInteger(motion.transitionDurationMs) || Number(motion.transitionDurationMs) < 0) errors.push('motionContract.transitionDurationMs is invalid')
    if (typeof motion.easing !== 'string') errors.push('motionContract.easing must be a string')
    if (typeof motion.reducedMotion !== 'string' || !new Set(['disable', 'instant', 'crossfade']).has(motion.reducedMotion)) errors.push('motionContract.reducedMotion is invalid')
    if (motion.noEssentialMotion !== true) errors.push('motionContract.noEssentialMotion must be true')
  }
  const rendering = value.renderingConstraints
  if (!isObject(rendering)) errors.push('renderingConstraints must be an object')
  else {
    exactKeys(rendering, new Set(['semanticHtml', 'noSvgRequired', 'maximumNodes']), 'renderingConstraints', errors)
    if (rendering.semanticHtml !== true || rendering.noSvgRequired !== true) errors.push('renderingConstraints must require semantic HTML and no SVG')
    if (!Number.isInteger(rendering.maximumNodes) || Number(rendering.maximumNodes) < 1) errors.push('renderingConstraints.maximumNodes is invalid')
  }
}

function validateRootAccessibility(value: unknown, ids: Set<string>, errors: string[]): void {
  if (!isObject(value)) { errors.push('accessibility must be an object'); return }
  exactKeys(value, new Set(['landmarkLabel', 'readingOrder', 'keyboardOperable', 'reducedMotionEquivalent', 'directionAware']), 'accessibility', errors)
  requiredString(value, 'landmarkLabel', 'accessibility', errors)
  if (!strings(value.readingOrder, { unique: true })) errors.push('accessibility.readingOrder must contain unique strings')
  else for (const id of value.readingOrder) if (!ids.has(id)) errors.push(`accessibility.readingOrder references unknown node ${id}`)
  if (value.keyboardOperable !== true) errors.push('accessibility.keyboardOperable must be true')
  if (value.reducedMotionEquivalent !== true) errors.push('accessibility.reducedMotionEquivalent must be true')
  if (value.directionAware !== true) errors.push('accessibility.directionAware must be true')
}

export function validateVisualTemplate(value: unknown): readonly string[] {
  const errors: string[] = []
  if (!isObject(value)) return ['template must be an object']
  exactKeys(value, ROOT_KEYS, 'template', errors)
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  for (const field of ['id', 'version', 'name', 'description'] as const) requiredString(value, field, 'template', errors)
  if (typeof value.id === 'string' && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.id)) errors.push('id is invalid')
  if (typeof value.version === 'string' && !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value.version)) errors.push('version must be semantic')
  if (!strings(value.intendedUse, { min: 1 })) errors.push('intendedUse requires at least one string')
  if (!strings(value.excludedUses, { min: 1 })) errors.push('excludedUses requires at least one string')
  if (!isObject(value.inputSchema)) errors.push('inputSchema must be an object')
  if (!strings(value.requiredData, { unique: true })) errors.push('requiredData must contain unique strings')
  if (!strings(value.supportedRelations, { unique: true, allowed: RELATIONS })) errors.push('supportedRelations is invalid')
  validateLayout(value.layoutRules, errors)
  validateSemanticTokens(value.semanticTokens, errors)
  validateContracts(value, errors)
  if (!strings(value.rendererCompatibility, { unique: true, allowed: RENDERERS })) errors.push('rendererCompatibility is invalid')
  if (!strings(value.outputFormats, { unique: true, allowed: FORMATS })) errors.push('outputFormats is invalid')
  const alternative = value.textAlternative
  if (!isObject(alternative)) errors.push('textAlternative must be an object')
  else {
    exactKeys(alternative, new Set(['summary', 'binding', 'includesStatusAndRelationships']), 'textAlternative', errors)
    requiredString(alternative, 'summary', 'textAlternative', errors)
    if (alternative.binding !== undefined && typeof alternative.binding !== 'string') errors.push('textAlternative.binding must be a string')
    if (alternative.includesStatusAndRelationships !== true) errors.push('textAlternative.includesStatusAndRelationships must be true')
  }
  const ids = new Set<string>()
  if (!Array.isArray(value.regions) || value.regions.length === 0) errors.push('regions must be a non-empty array')
  else value.regions.forEach((node, index) => validateNode(node, `regions[${index}]`, ids, errors))
  validateRootAccessibility(value.accessibility, ids, errors)
  if (typeof value.integrity !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.integrity)) errors.push('integrity must be a SHA-256 digest')
  else {
    const body = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'integrity')) as JsonObject
    if (`sha256:${sha256(canonicalJson(body))}` !== value.integrity) errors.push('integrity does not match canonical template content')
  }
  return errors
}

export function assertVisualTemplate(value: unknown): asserts value is VisualTemplate {
  const errors = validateVisualTemplate(value)
  if (errors.length > 0) throw new PhasewireError(`Invalid visual template: ${errors.join('; ')}`, 'INVALID_TEMPLATE')
}
