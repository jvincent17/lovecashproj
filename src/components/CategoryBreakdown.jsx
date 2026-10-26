import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { sumBy } from '../lib/budget.js'

/** Ringkasan pengeluaran per kategori (bar horizontal). */
export default function CategoryBreakdown({ items }) {
  const { catById } = useData()
  const by = sumBy(items, (e) => e.category_id ?? 'none')
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, v]) => s + v, 0)
  if (!rows.length) return <p className="text-sm text-muted py-4 text-center">Belum ada data.</p>
  return (
    <ul className="space-y-3">
      {rows.map(([id, v]) => {
        const c = catById[id]
        const pct = total ? Math.round((v / total) * 100) : 0
        return (
          <li key={id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="truncate">{c?.icon ?? '📦'} {c?.name ?? 'Tanpa kategori'}</span>
              <span className="tabular text-muted">{rupiah(v)} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink/[.06] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
