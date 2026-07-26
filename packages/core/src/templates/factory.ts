import { canonicalJson, sha256 } from '../canonical.js'
import type {
  JsonObject, ScaffoldVisualTemplateOptions, VisualTemplate, VisualTemplateInput,
} from '../types.js'
import { assertVisualTemplate } from './validation.js'

function asJsonObject(value: object): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

export function createVisualTemplate(input: VisualTemplateInput): VisualTemplate {
  const integrity = `sha256:${sha256(canonicalJson(asJsonObject(input)))}` as const
  const template: VisualTemplate = Object.freeze({ ...input, integrity })
  assertVisualTemplate(template)
  return template
}

export function scaffoldVisualTemplate(options: ScaffoldVisualTemplateOptions): VisualTemplate {
  const mainRegionId = `${options.id.replace(/[^A-Za-z0-9._-]/gu, '-')}-canvas`
  const primaryKind = options.primaryKind ?? 'section'
  return createVisualTemplate({
    schemaVersion: 1,
    id: options.id,
    version: options.version ?? '1.0.0',
    name: options.name,
    description: options.description,
    intendedUse: ['Describe the intended use'],
    excludedUses: ['Describe an excluded use'],
    inputSchema: {
      type: 'object',
      required: [options.primaryBinding],
      properties: { [options.primaryBinding]: { type: ['array', 'object', 'string'] } },
    },
    requiredData: [options.primaryBinding],
    supportedRelations: ['sequence'],
    layoutRules: {
      preferredFlow: 'adaptive', minimumViewportWidth: 320, maximumColumns: 2,
      dense: false, rtlMirrored: true,
    },
    semanticTokens: {
      color: {
        neutral: 'var(--phasewire-neutral)', active: 'var(--phasewire-active)',
        positive: 'var(--phasewire-positive)', warning: 'var(--phasewire-warning)',
        blocking: 'var(--phasewire-blocking)',
      },
      statuses: [
        { id: 'active', label: 'Active', colorToken: 'active', nonColorCue: 'solid marker and Active label' },
        { id: 'passed', label: 'Passed', colorToken: 'positive', nonColorCue: 'check mark and Passed label' },
        { id: 'warning', label: 'Warning', colorToken: 'warning', nonColorCue: 'triangle and Warning label' },
        { id: 'blocking', label: 'Blocking', colorToken: 'blocking', nonColorCue: 'octagon and Blocking label' },
      ],
    },
    motionContract: {
      enabledByDefault: true, transitionDurationMs: 180,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', reducedMotion: 'instant', noEssentialMotion: true,
    },
    renderingConstraints: { semanticHtml: true, noSvgRequired: true, maximumNodes: 250 },
    rendererCompatibility: ['web', 'terminal', 'markdown'],
    outputFormats: ['interactive', 'html', 'markdown', 'json'],
    textAlternative: {
      summary: `${options.name}: ${options.description}`,
      binding: options.primaryBinding,
      includesStatusAndRelationships: true,
    },
    regions: [{
      id: mainRegionId,
      kind: primaryKind,
      label: options.name,
      binding: options.primaryBinding,
      accessibility: {
        role: 'region', label: options.name, headingLevel: 1,
        keyboardAction: 'Tab moves through interactive items; arrow keys follow ordered relationships',
        reducedMotionEquivalent: true, directionAware: true,
      },
    }],
    accessibility: {
      landmarkLabel: options.name, readingOrder: [mainRegionId], keyboardOperable: true,
      reducedMotionEquivalent: true, directionAware: true,
    },
  })
}
