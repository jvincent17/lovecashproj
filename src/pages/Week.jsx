import { useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { fmtDay, fmtShort, fmtRange, fmtLong } from '../lib/dates.js'
import Bar from '../components/Bar.jsx'
import Sheet from '../components/Sheet.jsx'
import AmountInput from '../components/AmountInput.jsx'
import NoPeriod from '../components/NoPeriod.jsx'
import ExpenseSheet from '../components/ExpenseSheet.jsx'
import ExpenseList from '../components/ExpenseList.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'

export default function Week() {
  const { period, plan, status, expenses, today, setWeekAmount } = useData()
  const [idx, setIdx] = useState(null)
  const [editWeek, setEditWeek] = useState(false)
  const [day, setDay] = useState(null)

  useEffect(() => {
    if (!plan) return
    const cur = plan.weeks.find((w) => w.start <= today && w.end >= today)
    setIdx((i) => (i != null && i < plan.weeks.length ? i : cur?.index ?? 0))
  }, [plan, today])

  if (!period || !plan) return <NoPeriod />
  const week = plan.weeks[idx ?? 0]
  if (!week) return null

  const weekItems = expenses.filter((e) => e.date >= week.start && e.date <= week.end)
  const spent = weekItems.reduce((a, e) => a + Number(e.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {plan.weeks.map((w) => (
          <button key={w.index} onClick={() => setIdx(w.index)}
            className={`chip shrink-0 ${w.index === week.index ? 'border-accent bg-accent-soft text-accent font-medium' : 'text-muted'}`}>
            Minggu {w.index + 1}
          </button>
        ))}
      </div>

      <section className="hero p-5">
        <img src="/img/hero-week.webp" alt="" className="hero-photo" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{fmtRange(week.start, week.end)} · {week.days.length} hari</p>
            <p className="text-3xl font-semibold tabular mt-1">{rupiah(week.amount)}</p>
            <p className="text-xs text-muted mt-1">{week.isCustom ? 'Diatur manual' : 'Dibagi otomatis dari budget bulanan'}</p>
          </div>
          <button onClick={() => setEditWeek(true)} className="btn-ghost h-9 px-3"><Pencil size={15} /> Ubah</button>
        </div>
        <Bar value={spent} max={week.amount} className="mt-5" />
        <div className="flex justify-between text-sm mt-2">
          <span className="text-muted">Terpakai <span className="tabular text-ink">{rupiah(spent)}</span></span>
          <span className="text-muted">Sisa <span className={`tabular font-medium ${week.amount - spent < 0 ? 'text-danger' : 'text-ink'}`}>{rupiah(week.amount - spent)}</span></span>
        </div>
        {week.overAllocated > 0 && (
          <p className="text-xs text-danger mt-3 money">Jatah harian manual melebihi budget minggu ini sebesar {rupiah(week.overAllocated)}.</p>
        )}
      </section>

      <section className="card divide-y divide-line">
        {week.days.map((d) => {
          const s = status[d.date]
          const isToday = d.date === today
          return (
            <button key={d.date} onClick={() => setDay(d)} className="w-full text-left px-5 py-4 hover:bg-soft/50">
              <div className="flex items-center gap-3">
                <div className={`w-12 shrink-0 text-center rounded-xl py-1.5 ${isToday ? 'bg-gradient-to-br from-accent to-accent-2 text-on-accent' : 'bg-soft'}`}>
                  <div className="text-[11px] leading-none opacity-80">{fmtDay(d.date)}</div>
                  <div className="font-semibold leading-tight">{fmtShort(d.date).split(' ')[0]}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm">
                    <span>Jatah <span className="tabular font-medium">{rupiah(s.alloc)}</span>
                      {d.isCustom && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-accent-soft text-accent">manual</span>}

                    </span>
                    <span className={`tabular font-medium ${s.remaining < 0 ? 'text-danger' : ''}`}>{rupiah(s.remaining)}</span>
                  </div>
                  <Bar value={s.spent} max={Math.max(0, s.available)} className="mt-2" />
                  <div className="flex justify-between text-xs text-muted mt-1.5 money">
                    <span>Terpakai {rupiah(s.spent)}{s.adjust < 0 && <span className="text-danger"> · potong {rupiah(-s.adjust)}</span>}{s.adjust > 0 && <span className="text-accent"> · +{rupiah(s.adjust)} dari sisa</span>}</span>
                    <span>{s.carryIn !== 0 && `${s.carryIn > 0 ? '+' : ''}${rupiah(s.carryIn)} dari kemarin`}</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Per kategori minggu ini</h2>
        <CategoryBreakdown items={weekItems} />
      </section>

      <WeekSheet open={editWeek} onClose={() => setEditWeek(false)} week={week}
        onSave={(v) => setWeekAmount(week.index, v)} />
      <DaySheet day={day} onClose={() => setDay(null)} />
    </div>
  )
}

function WeekSheet({ open, onClose, week, onSave }) {
  const [v, setV] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setV(week.amount) }, [open, week])
  const save = async (val) => {
    setBusy(true)
    try { await onSave(val); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Budget Minggu ${week.index + 1}`}>
      <div className="space-y-4">
        <AmountInput big autoFocus value={v} onChange={setV} />
        <p className="text-xs text-muted">Minggu lain akan menyesuaikan otomatis supaya total tetap sama dengan budget bulanan.</p>
        <div className="flex gap-2">
          {week.isCustom && <button disabled={busy} onClick={() => save(null)} className="btn-ghost">Kembalikan otomatis</button>}
          <button disabled={busy} onClick={() => save(v)} className="btn-primary flex-1">Simpan</button>
        </div>
      </div>
    </Sheet>
  )
}

function DaySheet({ day, onClose }) {
  const { status, expenses, setDayAmount } = useData()
  const [v, setV] = useState(0)
  const [busy, setBusy] = useState(false)
  const [exp, setExp] = useState({ open: false, expense: null })

  useEffect(() => { if (day) setV(day.amount) }, [day])
  if (!day) return null
  const s = status[day.date]
  const items = expenses.filter((e) => e.date === day.date)

  const save = async (val) => {
    setBusy(true)
    try { await setDayAmount(day.date, val); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <>
      <Sheet open={!exp.open} onClose={onClose} title={fmtLong(day.date)}>
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div><p className="text-xs text-muted">Tersedia</p><p className="tabular font-medium">{rupiah(s.available)}</p></div>
            <div><p className="text-xs text-muted">Terpakai</p><p className="tabular font-medium">{rupiah(s.spent)}</p></div>
            <div><p className="text-xs text-muted">Sisa</p><p className={`tabular font-medium ${s.remaining < 0 ? 'text-danger' : ''}`}>{rupiah(s.remaining)}</p></div>
          </div>

          <div>
            <span className="label">Jatah hari ini</span>
            <AmountInput value={v} onChange={setV} />
            <p className="text-xs text-muted mt-1.5">Hari lain di minggu ini akan dibagi ulang otomatis.</p>
            <div className="flex gap-2 mt-3">
              {day.isCustom && <button disabled={busy} onClick={() => save(null)} className="btn-ghost">Otomatis</button>}
              <button disabled={busy} onClick={() => save(v)} className="btn-primary flex-1">Simpan jatah</button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">Pengeluaran</span>
              <button onClick={() => setExp({ open: true, expense: null })} className="btn-ghost h-8 px-3 text-xs"><Plus size={14} /> Tambah</button>
            </div>
            <ExpenseList items={items} onPick={(e) => setExp({ open: true, expense: e })} />
          </div>
        </div>
      </Sheet>
      <ExpenseSheet open={exp.open} expense={exp.expense} defaultDate={day.date}
        onClose={() => setExp({ open: false, expense: null })} />
    </>
  )
}
