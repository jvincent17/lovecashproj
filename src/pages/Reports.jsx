import { useEffect, useMemo, useState } from 'react'
import { TrendingDown, TrendingUp, Table2, BarChart3 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { supabase } from '../lib/supabase.js'
import { rupiah } from '../lib/format.js'
import { fmtDay, fmtRange, fmtShort, rangeDays, fromISO } from '../lib/dates.js'
import { sumBy } from '../lib/budget.js'
import ColumnChart from '../components/ColumnChart.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'
import NoPeriod from '../components/NoPeriod.jsx'
import Avatar from '../components/Avatar.jsx'

export default function Reports() {
  const { period, periods, plan, expenses, spentByDate, selectPeriod, today, members, memberName } = useData()
  const [history, setHistory] = useState([]) // total pengeluaran per periode (6 terakhir)
  const [table, setTable] = useState(false)

  // 6 periode terakhir s/d periode terpilih, untuk perbandingan
  const recent = useMemo(() => {
    if (!period) return []
    const idx = periods.findIndex((p) => p.id === period.id)
    return periods.slice(idx, idx + 6).reverse()
  }, [periods, period])

  useEffect(() => {
    if (!recent.length) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('expenses').select('amount,date')
        .eq('cashflow_id', period.cashflow_id).gte('date', recent[0].start_date).lte('date', recent[recent.length - 1].end_date)
      if (!alive || !data) return
      setHistory(recent.map((p) => ({
        period: p,
        total: data.filter((e) => e.date >= p.start_date && e.date <= p.end_date).reduce((a, e) => a + Number(e.amount), 0),
      })))
    })()
    return () => { alive = false }
  }, [recent, period, expenses])

  if (!period || !plan) return <NoPeriod />

  const days = rangeDays(period.start_date, period.end_date)
  const elapsed = days.filter((d) => d <= today)
  const daysCount = Math.max(1, elapsed.length)
  const total = expenses.reduce((a, e) => a + Number(e.amount), 0)
  const avg = total / daysCount
  const topDay = Object.entries(spentByDate).sort((a, b) => b[1] - a[1])[0]
  const prev = history.length > 1 ? history[history.length - 2] : null
  const delta = prev && prev.total > 0 ? (total - prev.total) / prev.total : null
  const overDays = elapsed.filter((d) => (spentByDate[d] || 0) > (plan.dayAlloc[d] || 0)).length

  const daily = days.map((d) => ({
    key: d, label: String(fromISO(d).getDate()), title: `${fmtDay(d)}, ${fmtShort(d)}`,
    value: spentByDate[d] || 0, line: plan.dayAlloc[d] || 0, highlight: d <= today,
  }))
  const byPerson = sumBy(expenses, (e) => e.created_by ?? 'none')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Laporan</h1>
        <select className="input w-auto" value={period.id} onChange={(e) => selectPeriod(e.target.value)}>
          {periods.map((p) => <option key={p.id} value={p.id}>{fmtRange(p.start_date, p.end_date)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total pengeluaran" value={rupiah(total)}
          delta={delta} hint={prev ? `vs ${fmtRange(prev.period.start_date, prev.period.end_date)}` : 'periode ini'} />
        <Stat label="Rata-rata per hari" value={rupiah(avg)} hint={`${daysCount} hari berjalan`} />
        <Stat label="Hari terboros" value={topDay ? rupiah(topDay[1]) : '—'} hint={topDay ? `${fmtDay(topDay[0])}, ${fmtShort(topDay[0])}` : 'belum ada'} />
        <Stat label="Lewat jatah" value={`${overDays} hari`} hint={`dari ${daysCount} hari`} plain />
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Pengeluaran harian</h2>
            <p className="text-xs text-muted">Kolom merah = melebihi jatah hari itu</p>
          </div>
          <button onClick={() => setTable((v) => !v)} className="btn-ghost h-8 px-3 text-xs">
            {table ? <><BarChart3 size={14} /> Grafik</> : <><Table2 size={14} /> Tabel</>}
          </button>
        </div>
        {table ? (
          <div className="max-h-80 overflow-y-auto -mx-1">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted sticky top-0 bg-card">
                <tr><th className="text-left font-normal py-1.5 px-1">Tanggal</th><th className="text-right font-normal px-1">Jatah</th><th className="text-right font-normal px-1">Terpakai</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {daily.map((d) => (
                  <tr key={d.key}>
                    <td className="py-1.5 px-1">{d.title}</td>
                    <td className="text-right tabular px-1 text-muted">{rupiah(d.line)}</td>
                    <td className={`text-right tabular px-1 ${d.value > d.line ? 'text-danger' : ''}`}>{rupiah(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ColumnChart data={daily} lineLabel="Jatah harian" tickEvery={Math.ceil(days.length / 10)} />
        )}
      </section>

      {history.length > 1 && (
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Perbandingan antar periode</h2>
          <ColumnChart height={160}
            data={history.map((h) => ({
              key: h.period.id, label: fmtShort(h.period.start_date), title: fmtRange(h.period.start_date, h.period.end_date),
              value: h.total, highlight: h.period.id === period.id,
            }))} />
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Per kategori</h2>
        <CategoryBreakdown items={expenses} withLimits />
      </section>

      {members.length > 1 && (
        <section className="card p-5">
          <h2 className="font-semibold mb-4">Per orang</h2>
          <ul className="space-y-3">
            {members.map((m) => {
              const v = byPerson[m.user_id] || 0
              const pct = total ? Math.round((v / total) * 100) : 0
              return (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar path={m.profile?.avatar_path} name={memberName(m.user_id)} className="size-8" ring={false} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{memberName(m.user_id)}</span>
                      <span className="tabular text-muted">{rupiah(v)} · {pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-ink/[.06] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, hint, delta, plain }) {
  const up = delta != null && delta > 0
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${plain ? '' : 'tabular'}`}>{value}</p>
      <p className="text-[11px] text-muted mt-0.5 flex items-center gap-1">
        {delta != null && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${up ? 'text-danger' : 'text-accent'}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{Math.round(delta * 100)}%
          </span>
        )}
        <span className="truncate">{hint}</span>
      </p>
    </div>
  )
}
