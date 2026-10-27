import { Link } from 'react-router-dom'
import { AlertTriangle, BellRing } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { addDays, fmtShort } from '../lib/dates.js'
import { sumBy } from '../lib/budget.js'

/** Pengingat: tagihan & hutang jatuh tempo ≤ 3 hari / lewat, dan kategori yang mendekati batas. */
export default function Reminders() {
  const { bills, debts, today, categories, expenses } = useData()
  const soon = addDays(today, 3)
  const items = []

  for (const b of bills) {
    if (b.paid || b.due_date > soon) continue
    const late = b.due_date < today
    items.push({ key: `b${b.id}`, to: '/bulan', late, text: `${b.name} ${rupiah(b.amount)}`,
      when: late ? `lewat ${fmtShort(b.due_date)}` : b.due_date === today ? 'jatuh tempo hari ini' : `jatuh tempo ${fmtShort(b.due_date)}` })
  }
  for (const d of debts) {
    if (d.done || !d.due_date || d.due_date > soon) continue
    const late = d.due_date < today
    items.push({ key: `d${d.id}`, to: '/hutang', late,
      text: `${d.type === 'payable' ? 'Hutang ke' : 'Piutang dari'} ${d.person} · sisa ${rupiah(d.rest)}`,
      when: late ? `lewat ${fmtShort(d.due_date)}` : `jatuh tempo ${fmtShort(d.due_date)}` })
  }
  const byCat = sumBy(expenses, (e) => e.category_id)
  for (const c of categories) {
    if (!c.monthly_limit) continue
    const used = byCat[c.id] || 0
    const pct = used / Number(c.monthly_limit)
    if (pct < 0.8) continue
    items.push({ key: `c${c.id}`, to: '/bulan', late: pct > 1, text: `${c.icon} ${c.name} ${Math.round(pct * 100)}% dari batas`,
      when: pct > 1 ? `lewat ${rupiah(used - c.monthly_limit)}` : `sisa ${rupiah(c.monthly_limit - used)}` })
  }
  if (!items.length) return null
  items.sort((a, b) => Number(b.late) - Number(a.late))

  return (
    <section className="card p-4 border-accent/40">
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        <BellRing size={16} className="text-accent" /> Pengingat
      </div>
      <ul className="space-y-1.5">
        {items.slice(0, 5).map((it) => (
          <li key={it.key}>
            <Link to={it.to} className="flex items-start gap-2 text-sm hover:text-accent">
              {it.late ? <AlertTriangle size={14} className="text-danger mt-0.5 shrink-0" /> : <span className="size-1.5 rounded-full bg-accent mt-2 shrink-0" />}
              <span className="flex-1 money">{it.text}</span>
              <span className={`text-xs shrink-0 money ${it.late ? 'text-danger' : 'text-muted'}`}>{it.when}</span>
            </Link>
          </li>
        ))}
      </ul>
      {items.length > 5 && <p className="text-xs text-muted mt-2">+{items.length - 5} lainnya</p>}
    </section>
  )
}
