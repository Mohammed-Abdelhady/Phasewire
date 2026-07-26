interface ReturnTraceProps {
  cycleCount: number
  blockerCount: number
}

export function ReturnTrace({ cycleCount, blockerCount }: ReturnTraceProps) {
  if (cycleCount < 2 && blockerCount === 0) {
    return null
  }

  return (
    <>
      <svg
        className="return-trace"
        viewBox="0 0 204 330"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="return-trace-path"
          pathLength="1"
          d="M 156 221 C 194 221, 194 74, 153 74"
        />
        <path className="return-trace-arrow" d="M 158 68 L 147 74 L 158 80" />
      </svg>
      <p className="return-trace-label">
        <span>Review returned to Plan</span>
        <strong>Cycle {String(cycleCount).padStart(2, '0')}</strong>
        <small>{blockerCount} blocking findings</small>
      </p>
    </>
  )
}
