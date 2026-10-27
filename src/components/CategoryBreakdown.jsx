import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { sumBy } from '../lib/budget.js'

/**
 * Ringkasan pengeluaran per kategori (bar horizontal).
 * withLimits: tampilkan batas bulanan kategori (untuk tampilan satu periode penuh).
 */
export default function CategoryBreakdown({ items, withLimits = false }) {
  const { catById, categories } = useData()
  const by = sumBy(items, (e) => e.category_id ?? 'none')
  if (withLimits) {
    // kategori yang punya batas tetap ditampilkan walau belum ada pengeluaran
    categories.forEach((c) => { if (c.monthly_limit && by[c.id] == null) by[c.id] = 0 })
  }
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, v]) => s + v, 0)
  if (!rows.length) return <p className="text-sm text-muted py-4 text-center">Belum ada data.</p>
  return (
    <ul className="space-y-3.5">
      {rows.map(([id, v]) => {
        const c = catById[id]
        const limit = withLimits && c?.monthly_limit ? Number(c.monthly_limit) : null
        const pct = limit ? Math.round((v / limit) * 100) : total ? Math.round((v / total) * 100) : 0
        const state = limit ? (v > limit ? 'over' : pct >= 80 ? 'warn' : 'ok') : 'ok'
        const barCls = state === 'over' ? 'bg-danger' : state === 'warn' ? 'bg-gradient-to-r from-accent-2 to-danger' : 'bg-gradient-to-r from-accent-2 to-accent'
        return (
          <li key={id}>
            <div className="flex items-center justify-between gap-2 text-sm mb-1">
              <span className="truncate">{c?.icon ?? '📦'} {c?.name ?? 'Tanpa kategori'}</span>
              <span className={`tabular text-right ${state === 'over' ? 'text-danger font-medium' : 'text-muted'}`}>
                {limit ? `${rupiah(v)} / ${rupiah(limit)}` : `${rupiah(v)} · ${pct}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-ink/[.06] overflow-hidden">
              <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            {limit && state !== 'ok' && (
              <p className={`text-[11px] mt-1 money ${state === 'over' ? 'text-danger' : 'text-muted'}`}>
                {state === 'over' ? `Lewat batas ${rupiah(v - limit)}` : `Sudah ${pct}% dari batas · sisa ${rupiah(limit - v)}`}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
