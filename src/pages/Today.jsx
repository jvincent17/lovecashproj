import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah, rupiahShort } from '../lib/format.js'
import { addDays, fmtLong } from '../lib/dates.js'
import { greeting } from '../lib/photos.js'
import Bar from '../components/Bar.jsx'
import Sheet from '../components/Sheet.jsx'
import AmountInput from '../components/AmountInput.jsx'
import NoPeriod from '../components/NoPeriod.jsx'
import ExpenseSheet from '../components/ExpenseSheet.jsx'
import ExpenseList from '../components/ExpenseList.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'

export default function Today() {
  const { period, periods, plan, status, expenses, today, saldo, spentTotal, selectPeriod, profile } = useData()
  const [day, setDay] = useState(today)
  const [sheet, setSheet] = useState({ open: false, expense: null })
  const [editJatah, setEditJatah] = useState(false)

  // Halaman ini selalu memakai periode yang memuat hari ini
  const current = periods.find((p) => p.start_date <= today && p.end_date >= today)
  useEffect(() => {
    if (current && period?.id !== current.id) selectPeriod(current.id)
  }, [current, period, selectPeriod])

  if (!current) return <NoPeriod />
  if (!plan || period?.id !== current.id) return null

  const s = status[day]
  if (!s) return null

  const week = plan.weeks.find((w) => w.start <= day && w.end >= day)
  const dayInfo = week.days.find((d) => d.date === day)
  const weekSpent = expenses.filter((e) => e.date >= week.start && e.date <= week.end).reduce((a, e) => a + Number(e.amount), 0)
  const dayItems = expenses.filter((e) => e.date === day)
  const isToday = day === today
  const canPrev = day > period.start_date
  const canNext = day < period.end_date

  return (
    <div className="space-y-4">
      <h1 className="hidden md:block text-2xl font-semibold">
        {greeting()}, {profile?.display_name || profile?.username || 'kamu'} 👋
      </h1>
      {/* Navigasi hari */}
      <div className="flex items-center justify-between gap-2">
        <button disabled={!canPrev} onClick={() => setDay(addDays(day, -1))}
          className="size-10 grid place-items-center rounded-xl bg-card border border-line disabled:opacity-30" aria-label="Hari sebelumnya">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium">{isToday ? 'Hari ini' : fmtLong(day).split(',')[0]}</p>
          <p className="text-xs text-muted">{fmtLong(day)}</p>
        </div>
        <button disabled={!canNext} onClick={() => setDay(addDays(day, 1))}
          className="size-10 grid place-items-center rounded-xl bg-card border border-line disabled:opacity-30" aria-label="Hari berikutnya">
          <ChevronRight size={18} />
        </button>
      </div>

      <section className="hero p-6">
        <img src="/img/hero-today.webp" alt="" className="hero-photo" />
        <p className="text-sm text-muted">Dana tersedia {isToday ? 'hari ini' : 'hari itu'}</p>
        <p className={`text-4xl md:text-5xl font-semibold tabular mt-1 ${s.remaining < 0 ? 'text-danger' : ''}`}>
          {rupiah(s.remaining)}
        </p>
        <Bar value={s.spent} max={Math.max(0, s.available)} className="mt-5" />
        <dl className="grid grid-cols-3 gap-2 mt-4 text-sm">
          <div>
            <dt className="text-muted text-xs">Jatah</dt>
            <dd>
              <button onClick={() => setEditJatah(true)} className="tabular font-medium inline-flex items-center gap-1 hover:text-accent">
                {rupiah(s.alloc)} <Pencil size={12} className="text-muted" />
              </button>
              {dayInfo?.isCustom && <span className="block text-[10px] text-accent">diatur manual</span>}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Dari kemarin</dt>
            <dd className={`tabular font-medium ${s.carryIn < 0 ? 'text-danger' : s.carryIn > 0 ? 'text-accent' : ''}`}>
              {s.carryIn > 0 ? '+' : ''}{rupiah(s.carryIn)}
            </dd>
          </div>
          <div><dt className="text-muted text-xs">Terpakai</dt><dd className="tabular font-medium">{rupiah(s.spent)}</dd></div>
        </dl>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={() => setEditJatah(true)} className="btn-ghost bg-card/70"><Pencil size={16} /> Atur jatah</button>
          <button onClick={() => setSheet({ open: true, expense: null })} className="btn-primary"><Plus size={18} /> Catat</button>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Saldo" value={saldo} hint="uang di tangan" />
        <MiniStat label="Sisa minggu" value={week.amount - weekSpent} hint={`dari ${rupiah(week.amount)}`} />
        <MiniStat label="Sisa budget" value={plan.flexible - spentTotal} hint="bulan ini" />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Pengeluaran {isToday ? 'hari ini' : 'hari itu'}</h2>
          <button onClick={() => setSheet({ open: true, expense: null })} className="btn-ghost h-8 px-3 text-xs"><Plus size={14} /> Tambah</button>
        </div>
        <ExpenseList items={dayItems} onPick={(e) => setSheet({ open: true, expense: e })} />
      </section>

      {dayItems.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold mb-4">Per kategori</h2>
          <CategoryBreakdown items={dayItems} />
        </section>
      )}

      {/* Tombol mengambang di mobile */}
      <button onClick={() => setSheet({ open: true, expense: null })}
        className="md:hidden fixed right-4 bottom-20 z-40 size-14 rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white dark:text-[#2b1d28] shadow-lg grid place-items-center"
        aria-label="Catat pengeluaran">
        <Plus size={26} />
      </button>

      <ExpenseSheet open={sheet.open} expense={sheet.expense} defaultDate={day}
        onClose={() => setSheet({ open: false, expense: null })} />
      <JatahSheet open={editJatah} onClose={() => setEditJatah(false)} day={day} info={dayInfo} />
    </div>
  )
}

function MiniStat({ label, value, hint }) {
  return (
    <div className="card p-3.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-sm md:text-base font-semibold tabular mt-0.5 whitespace-nowrap ${value < 0 ? 'text-danger' : ''}`}>
        <span className="md:hidden">Rp {rupiahShort(value)}</span><span className="hidden md:inline">{rupiah(value)}</span>
      </p>
      <p className="text-[10px] text-muted mt-0.5 truncate">{hint}</p>
    </div>
  )
}

function JatahSheet({ open, onClose, day, info }) {
  const { setDayAmount } = useData()
  const [v, setV] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setV(info?.amount ?? 0) }, [open, info])
  const save = async (val) => {
    setBusy(true)
    try { await setDayAmount(day, val); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Jatah ${fmtLong(day)}`}>
      <div className="space-y-4">
        <AmountInput big autoFocus value={v} onChange={setV} />
        <p className="text-xs text-muted">Hari lain di minggu yang sama akan dibagi ulang otomatis, jadi total minggu tetap sama.</p>
        <div className="flex gap-2">
          {info?.isCustom && <button disabled={busy} onClick={() => save(null)} className="btn-ghost">Otomatis</button>}
          <button disabled={busy} onClick={() => save(v)} className="btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </Sheet>
  )
}
