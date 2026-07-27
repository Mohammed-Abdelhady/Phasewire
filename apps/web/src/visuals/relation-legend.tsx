const ITEMS = [
  { kind: 'sequence', label: 'Sequence' },
  { kind: 'blocks', label: 'Blocks' },
  { kind: 'return', label: 'Return loop' },
  { kind: 'evidence-for', label: 'Evidence' },
  { kind: 'handoff', label: 'Handoff' },
] as const

export function RelationLegend() {
  return (
    <ul className="relation-legend" aria-label="Connection types" data-testid="relation-legend">
      {ITEMS.map((item) => (
        <li key={item.kind} className={`relation-legend-item is-${item.kind}`}>
          <span className="relation-legend-swatch" aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
