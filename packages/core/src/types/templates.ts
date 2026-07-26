import type { JsonObject } from './json.js'

export type VisualNodeKind =
  | 'section' | 'stack' | 'grid' | 'text' | 'metric' | 'list' | 'timeline' | 'evidence' | 'action'

export interface AccessibilityMetadata {
  readonly role?: string
  readonly label?: string
  readonly description?: string
  readonly headingLevel?: 1 | 2 | 3 | 4 | 5 | 6
  readonly live?: 'off' | 'polite' | 'assertive'
  readonly keyboardAction?: string
  readonly reducedMotionEquivalent?: boolean
  readonly directionAware?: boolean
}

export interface VisualNode {
  readonly id: string
  readonly kind: VisualNodeKind
  readonly label?: string
  readonly binding?: string
  readonly action?: 'approve-plan' | 'record-decision' | 'request-review' | 'record-authorization'
  readonly accessibility: AccessibilityMetadata
  readonly children?: readonly VisualNode[]
}

export interface VisualTemplate {
  readonly schemaVersion: 1
  readonly id: string
  readonly version: string
  readonly name: string
  readonly description: string
  readonly intendedUse: readonly string[]
  readonly excludedUses: readonly string[]
  readonly inputSchema: JsonObject
  readonly requiredData: readonly string[]
  readonly supportedRelations: readonly (
    | 'sequence' | 'depends-on' | 'blocks' | 'resolves' | 'evidence-for' | 'parent-child'
  )[]
  readonly layoutRules: {
    readonly preferredFlow: 'horizontal' | 'vertical' | 'radial' | 'adaptive'
    readonly minimumViewportWidth: number
    readonly maximumColumns: number
    readonly dense: boolean
    readonly rtlMirrored: boolean
  }
  readonly semanticTokens: {
    readonly color: Readonly<Record<string, string>>
    readonly statuses: readonly {
      readonly id: string
      readonly label: string
      readonly colorToken: string
      readonly nonColorCue: string
    }[]
  }
  readonly motionContract: {
    readonly enabledByDefault: boolean
    readonly transitionDurationMs: number
    readonly easing: string
    readonly reducedMotion: 'disable' | 'instant' | 'crossfade'
    readonly noEssentialMotion: true
  }
  readonly renderingConstraints: {
    readonly semanticHtml: true
    readonly noSvgRequired: true
    readonly maximumNodes: number
  }
  readonly rendererCompatibility: readonly ('web' | 'terminal' | 'markdown')[]
  readonly outputFormats: readonly ('interactive' | 'html' | 'markdown' | 'json')[]
  readonly textAlternative: {
    readonly summary: string
    readonly binding?: string
    readonly includesStatusAndRelationships: true
  }
  readonly regions: readonly VisualNode[]
  readonly accessibility: {
    readonly landmarkLabel: string
    readonly readingOrder: readonly string[]
    readonly keyboardOperable: true
    readonly reducedMotionEquivalent: true
    readonly directionAware: true
  }
  readonly integrity: `sha256:${string}`
}

export type VisualTemplateInput = Omit<VisualTemplate, 'integrity'>
export type TemplateLayer = 'builtin' | 'user' | 'project'

export interface TemplatePin {
  readonly version: string
  readonly integrity: `sha256:${string}`
  readonly layer: TemplateLayer
}

export interface TemplateLock {
  readonly schemaVersion: 1
  readonly templates: Readonly<Record<string, TemplatePin>>
}

export interface TemplateDescriptor {
  readonly template: VisualTemplate
  readonly layer: TemplateLayer
  readonly path?: string
}

export interface TemplateRegistryOptions {
  readonly userTemplateRoot?: string
}

export interface ScaffoldVisualTemplateOptions {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly primaryBinding: string
  readonly version?: string
  readonly primaryKind?: VisualNodeKind
}
