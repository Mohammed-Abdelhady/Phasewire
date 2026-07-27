export type VisualStatus =
  | 'active'
  | 'blocked'
  | 'complete'
  | 'queued'
  | 'ready'
  | 'risk'
  | 'verified'
  | 'unverified'

export type RelationKind =
  | 'sequence'
  | 'depends-on'
  | 'blocks'
  | 'resolves'
  | 'evidence-for'
  | 'return'
  | 'handoff'
  | 'parent-child'

export type GraphNodeKind =
  | 'phase'
  | 'event'
  | 'finding'
  | 'artifact'
  | 'actor'
  | 'gate'
  | 'decision'
  | 'cycle'

export interface GraphPoint {
  readonly x: number
  readonly y: number
}

export interface GraphNode {
  readonly id: string
  readonly label: string
  readonly subtitle?: string
  readonly status: VisualStatus
  readonly kind?: GraphNodeKind
  readonly meta?: string
}

export interface GraphEdge {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly kind: RelationKind
  readonly label?: string
  readonly animated?: boolean
}

export interface PlacedNode extends GraphNode {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface RoutedEdge extends GraphEdge {
  readonly path: string
  readonly labelPoint: GraphPoint
}

export interface GraphModel {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly focusId?: string
}

export interface LayoutResult {
  readonly nodes: readonly PlacedNode[]
  readonly edges: readonly RoutedEdge[]
  readonly width: number
  readonly height: number
}

export type LayoutMode = 'horizontal' | 'vertical' | 'orbit' | 'adaptive'
