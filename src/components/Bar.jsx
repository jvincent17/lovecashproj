/** Progress bar sederhana. value / max; merah kalau lewat. */
export default function Bar({ value, max, className = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0
  const over = value > max
  return (
    <div className={`h-2 rounded-full bg-ink/[.06] overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-gradient-to-r from-accent-2 to-accent'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
