import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'

export default function ExpenseList({ items, onPick, empty = 'Belum ada pengeluaran.' }) {
  const { catById } = useData()
  if (!items.length) return <p className="text-sm text-muted py-6 text-center">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {items.map((e) => {
        const c = catById[e.category_id]
        return (
          <li key={e.id}>
            <button onClick={() => onPick?.(e)} className="w-full flex items-center gap-3 py-3 text-left hover:bg-soft/60 rounded-lg px-1">
              <span className="size-10 rounded-xl bg-soft grid place-items-center text-lg">{c?.icon ?? '📦'}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{e.note || c?.name || 'Tanpa kategori'}</span>
                <span className="block text-xs text-muted truncate">{c?.name ?? 'Tanpa kategori'}</span>
              </span>
              <span className="text-sm font-medium tabular">-{rupiah(e.amount)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
