import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { fmtLong } from '../lib/dates.js'
import Bar from '../components/Bar.jsx'
import NoPeriod from '../components/NoPeriod.jsx'
import ExpenseSheet from '../components/ExpenseSheet.jsx'
import ExpenseList from '../components/ExpenseList.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'

export default function Today() {
  const { period, periods, plan, status, expenses, today, selectPeriod } = useData()
  const [sheet, setSheet] = useState({ open: false, expense: null })

  const current = periods.find((p) => p.start_date <= today && p.end_date >= today)
  if (!current) return <NoPeriod />
  if (!period || period.id !== current.id) {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-sm text-muted">Anda sedang melihat periode lain.</p>
        <button className="btn-primary" onClick={() => selectPeriod(current.id)}>Kembali ke periode sekarang</button>
      </div>
    )
  }
  if (!plan) return null

  const s = status[today]
  const week = plan.weeks.find((w) => w.start <= today && w.end >= today)
  const weekSpent = expenses.filter((e) => e.date >= week.start && e.date <= week.end).reduce((a, e) => a + Number(e.amount), 0)
  const periodSpent = expenses.reduce((a, e) => a + Number(e.amount), 0)
  const todayItems = expenses.filter((e) => e.date === today)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{fmtLong(today)}</p>

      <section className="hero p-6">
        <img src="/img/hero-today.webp" alt="" className="hero-photo" />
        <p className="text-sm text-muted">Sisa uang hari ini</p>
        <p className={`text-4xl md:text-5xl font-semibold tabular mt-1 ${s.remaining < 0 ? 'text-danger' : ''}`}>
          {rupiah(s.remaining)}
        </p>
        <Bar value={s.spent} max={Math.max(0, s.available)} className="mt-5" />
        <dl className="grid grid-cols-3 gap-2 mt-4 text-sm">
          <div><dt className="text-muted text-xs">Jatah hari ini</dt><dd className="tabular font-medium">{rupiah(s.alloc)}</dd></div>
          <div>
            <dt className="text-muted text-xs">Dari kemarin</dt>
            <dd className={`tabular font-medium ${s.carryIn < 0 ? 'text-danger' : s.carryIn > 0 ? 'text-accent' : ''}`}>
              {s.carryIn > 0 ? '+' : ''}{rupiah(s.carryIn)}
            </dd>
          </div>
          <div><dt className="text-muted text-xs">Terpakai</dt><dd className="tabular font-medium">{rupiah(s.spent)}</dd></div>
        </dl>
        <button onClick={() => setSheet({ open: true, expense: null })} className="btn-primary w-full mt-5 hidden md:flex">
          <Plus size={18} /> Catat pengeluaran
        </button>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Sisa minggu ini</p>
          <p className={`font-semibold tabular mt-1 ${week.amount - weekSpent < 0 ? 'text-danger' : ''}`}>{rupiah(week.amount - weekSpent)}</p>
          <p className="text-xs text-muted mt-0.5">dari {rupiah(week.amount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Sisa bulan ini</p>
          <p className={`font-semibold tabular mt-1 ${plan.flexible - periodSpent < 0 ? 'text-danger' : ''}`}>{rupiah(plan.flexible - periodSpent)}</p>
          <p className="text-xs text-muted mt-0.5">dari {rupiah(plan.flexible)}</p>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold mb-1">Pengeluaran hari ini</h2>
        <ExpenseList items={todayItems} onPick={(e) => setSheet({ open: true, expense: e })} />
      </section>

      {todayItems.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold mb-4">Per kategori hari ini</h2>
          <CategoryBreakdown items={todayItems} />
        </section>
      )}

      {/* Tombol mengambang di mobile */}
      <button onClick={() => setSheet({ open: true, expense: null })}
        className="md:hidden fixed right-4 bottom-20 z-40 size-14 rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white dark:text-[#2b1d28] shadow-lg grid place-items-center"
        aria-label="Catat pengeluaran">
        <Plus size={26} />
      </button>

      <ExpenseSheet open={sheet.open} expense={sheet.expense} onClose={() => setSheet({ open: false, expense: null })} />
    </div>
  )
}
