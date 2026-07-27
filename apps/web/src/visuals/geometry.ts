import type {
  GraphEdge,
  GraphModel,
  GraphNode,
  GraphPoint,
  LayoutMode,
  LayoutResult,
  PlacedNode,
  RoutedEdge,
} from './types'

const NODE_W = 148
const NODE_H = 64
const H_GAP = 48
const V_GAP = 36
const PAD = 28

export function nodeCenter(node: PlacedNode): GraphPoint {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

export function cubicPath(from: GraphPoint, to: GraphPoint, vertical = false): string {
  if (vertical) {
    const mid = (from.y + to.y) / 2
    return `M ${from.x} ${from.y} C ${from.x} ${mid}, ${to.x} ${mid}, ${to.x} ${to.y}`
  }
  const mid = (from.x + to.x) / 2
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`
}

export function loopPath(from: GraphPoint, to: GraphPoint, bulge = 56): string {
  const midY = Math.min(from.y, to.y) - bulge
  return `M ${from.x} ${from.y} C ${from.x + 20} ${midY}, ${to.x - 20} ${midY}, ${to.x} ${to.y}`
}

function placeHorizontal(nodes: readonly GraphNode[]): PlacedNode[] {
  return nodes.map((node, index) => ({
    ...node,
    x: PAD + index * (NODE_W + H_GAP),
    y: PAD + 24,
    width: NODE_W,
    height: NODE_H,
  }))
}

function placeVertical(nodes: readonly GraphNode[]): PlacedNode[] {
  return nodes.map((node, index) => ({
    ...node,
    x: PAD + 40,
    y: PAD + index * (NODE_H + V_GAP),
    width: NODE_W,
    height: NODE_H,
  }))
}

function placeOrbit(nodes: readonly GraphNode[]): PlacedNode[] {
  if (nodes.length === 0) return []
  const cx = 220
  const cy = 150
  const radius = Math.max(88, nodes.length * 18)
  return nodes.map((node, index) => {
    const angle = (-Math.PI / 2) + (index * (2 * Math.PI)) / nodes.length
    return {
      ...node,
      x: cx + Math.cos(angle) * radius - NODE_W / 2,
      y: cy + Math.sin(angle) * radius - NODE_H / 2,
      width: NODE_W,
      height: NODE_H,
    }
  })
}

function routeEdges(
  nodes: readonly PlacedNode[],
  edges: readonly GraphEdge[],
  mode: LayoutMode,
): RoutedEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return edges.flatMap((edge) => {
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    if (from === undefined || to === undefined) return []
    const start = nodeCenter(from)
    const end = nodeCenter(to)
    const isReturn = edge.kind === 'return'
    const path = isReturn
      ? loopPath(start, end, 72)
      : cubicPath(start, end, mode === 'vertical')
    const labelPoint = {
      x: (start.x + end.x) / 2,
      y: isReturn ? Math.min(start.y, end.y) - 56 : (start.y + end.y) / 2 - 10,
    }
    return [{ ...edge, path, labelPoint }]
  })
}

export function layoutGraph(model: GraphModel, mode: LayoutMode = 'adaptive'): LayoutResult {
  const resolved: LayoutMode =
    mode === 'adaptive'
      ? model.nodes.length > 5
        ? 'orbit'
        : 'horizontal'
      : mode

  const placed =
    resolved === 'vertical'
      ? placeVertical(model.nodes)
      : resolved === 'orbit'
        ? placeOrbit(model.nodes)
        : placeHorizontal(model.nodes)

  const edges = routeEdges(placed, model.edges, resolved)
  const maxX = placed.reduce((max, node) => Math.max(max, node.x + node.width), 0)
  const maxY = placed.reduce((max, node) => Math.max(max, node.y + node.height), 0)
  const loopExtra = edges.some((edge) => edge.kind === 'return') ? 80 : 0

  return {
    nodes: placed,
    edges,
    width: Math.max(320, maxX + PAD),
    height: Math.max(180, maxY + PAD + loopExtra),
  }
}

export function connectedIds(
  edges: readonly GraphEdge[],
  focusId: string | undefined,
): ReadonlySet<string> {
  if (focusId === undefined) return new Set()
  const ids = new Set<string>([focusId])
  for (const edge of edges) {
    if (edge.from === focusId) ids.add(edge.to)
    if (edge.to === focusId) ids.add(edge.from)
  }
  return ids
}

export function neighborsOf(
  edges: readonly GraphEdge[],
  focusId: string,
  direction: 'next' | 'prev',
): string | undefined {
  if (direction === 'next') {
    return edges.find((edge) => edge.from === focusId)?.to
  }
  return edges.find((edge) => edge.to === focusId)?.from
}
