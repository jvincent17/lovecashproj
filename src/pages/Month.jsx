import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Check } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { addDays, cycleFor, fmtRange } from '../lib/dates.js'
import Sheet from '../components/Sheet.jsx'
import AmountInput from '../components/AmountInput.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'
import Bar from '../components/Bar.jsx'

const KIND = {
  bill: { label: 'Tagihan', cls: 'bg-soft text-muted' },
  saving: { label: 'Tabungan', cls: 'bg-accent-soft text-accent' },
  debt: { label: 'Cicilan', cls: 'bg-danger-soft text-danger' },
}

export default function Month() {
  const { period, periods, plan, fixedItems, expenses, selectPeriod, toggleFixedPaid, deletePeriod } = useData()
  const [newPeriod, setNewPeriod] = useState(false)
  const [editSalary, setEditSalary] = useState(false)
  const [fixed, setFixed] = useState({ open: false, item: null })

  if (!period) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Gaji bulanan</h1>
        <div className="card p-5"><PeriodForm onDone={() => {}} /></div>
      </div>
    )
  }

  const spent = expenses.reduce((a, e) => a + Number(e.amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select className="input flex-1" value={period.id} onChange={(e) => selectPeriod(e.target.value)}>
          {periods.map((p) => <option key={p.id} value={p.id}>{fmtRange(p.start_date, p.end_date)}</option>)}
        </select>
        <button onClick={() => setNewPeriod(true)} className="btn-ghost shrink-0"><Plus size={16} /> Periode baru</button>
      </div>

      <section className="hero p-5">
        <img src="/img/hero-month.webp" alt="" className="hero-photo" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted">Gaji</p>
            <p className="text-3xl font-semibold tabular">{rupiah(plan.salary)}</p>
          </div>
          <button onClick={() => setEditSalary(true)} className="btn-ghost h-9 px-3"><Pencil size={15} /> Ubah</button>
        </div>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Pos tetap</dt><dd className="tabular">-{rupiah(plan.fixedTotal)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-medium"><dt>Budget fleksibel</dt><dd className="tabular">{rupiah(plan.flexible)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Sudah terpakai</dt><dd className="tabular">{rupiah(spent)}</dd></div>
        </dl>
        <Bar value={spent} max={plan.flexible} className="mt-3" />
        {plan.fixedTotal > plan.salary && (
          <p className="text-xs text-danger mt-3">Pos tetap melebihi gaji sebesar {rupiah(plan.fixedTotal - plan.salary)}.</p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Pos tetap</h2>
          <button onClick={() => setFixed({ open: true, item: null })} className="btn-ghost h-9 px-3"><Plus size={15} /> Tambah</button>
        </div>
        {fixedItems.length === 0 && <p className="text-sm text-muted py-4 text-center">Contoh: kos, listrik, tabungan, cicilan.</p>}
        <ul className="divide-y divide-line">
          {fixedItems.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-3">
              <button onClick={() => toggleFixedPaid(f)} aria-label="Tandai sudah dibayar"
                className={`size-6 shrink-0 rounded-lg border grid place-items-center ${f.paid ? 'bg-accent border-accent text-white dark:text-[#2b1d28]' : 'border-line'}`}>
                {f.paid && <Check size={14} />}
              </button>
              <button onClick={() => setFixed({ open: true, item: f })} className="flex-1 min-w-0 text-left">
                <span className={`block text-sm truncate ${f.paid ? 'line-through text-muted' : ''}`}>{f.name}</span>
                <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${KIND[f.kind].cls}`}>{KIND[f.kind].label}</span>
              </button>
              <span className="text-sm tabular">{rupiah(f.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Pembagian mingguan</h2>
        <ul className="space-y-2 text-sm">
          {plan.weeks.map((w) => (
            <li key={w.index} className="flex justify-between">
              <span className="text-muted">Minggu {w.index + 1} · {fmtRange(w.start, w.end)}</span>
              <span className="tabular">{rupiah(w.amount)}{w.isCustom && <span className="text-accent"> *</span>}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted mt-3">Ubah budget per minggu atau per hari di halaman Minggu. (* = diatur manual)</p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Pengeluaran per kategori</h2>
        <CategoryBreakdown items={expenses} />
      </section>

      <button
        onClick={() => { if (confirm('Hapus periode ini beserta pos tetap & pengaturan budgetnya? Pengeluaran tidak ikut terhapus.')) deletePeriod(period.id) }}
        className="btn-danger w-full">
        <Trash2 size={16} /> Hapus periode ini
      </button>

      <Sheet open={newPeriod} onClose={() => setNewPeriod(false)} title="Periode baru">
        <PeriodForm onDone={() => setNewPeriod(false)} />
      </Sheet>
      <SalarySheet open={editSalary} onClose={() => setEditSalary(false)} />
      <FixedSheet open={fixed.open} item={fixed.item} onClose={() => setFixed({ open: false, item: null })} />
    </div>
  )
}

function PeriodForm({ onDone }) {
  const { settings, periods, today, createPeriod } = useData()
  const payday = settings?.payday ?? 25
  const latest = periods[0]
  const base = latest && latest.end_date >= today ? addDays(latest.end_date, 1) : today
  const def = latest && latest.end_date >= today
    ? { start: base, end: cycleFor(base, payday).end }
    : cycleFor(today, payday)

  const [start, setStart] = useState(def.start)
  const [end, setEnd] = useState(def.end)
  const [salary, setSalary] = useState(latest ? Number(latest.salary) : 0)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await createPeriod({ start_date: start, end_date: end, salary }); onDone() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">Gaji periode ini</span>
        <AmountInput big value={salary} onChange={setSalary} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Mulai (tgl gajian)</span>
          <input type="date" className="input" value={start} onChange={(e) => { setStart(e.target.value); setEnd(cycleFor(e.target.value, payday).end) }} required />
        </label>
        <label><span className="label">Sampai</span>
          <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      <p className="text-xs text-muted">
        Tanggal gajian Anda: {payday} (ubah di Pengaturan).{latest && ' Pos tetap dari periode sebelumnya akan disalin otomatis.'}
      </p>
      <button disabled={busy} className="btn-primary w-full">{busy ? 'Menyimpan…' : 'Mulai periode'}</button>
    </form>
  )
}

function SalarySheet({ open, onClose }) {
  const { period, updatePeriod } = useData()
  const [v, setV] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setV(Number(period.salary)) }, [open, period])
  const save = async () => {
    setBusy(true)
    try { await updatePeriod(period.id, { salary: v }); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Ubah gaji">
      <div className="space-y-4">
        <AmountInput big autoFocus value={v} onChange={setV} />
        <button disabled={busy} onClick={save} className="btn-primary w-full">Simpan</button>
      </div>
    </Sheet>
  )
}

function FixedSheet({ open, item, onClose }) {
  const { debts, addFixed, updateFixed, deleteFixed } = useData()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [kind, setKind] = useState('bill')
  const [debtId, setDebtId] = useState('')
  const [busy, setBusy] = useState(false)
  const payable = debts.filter((d) => d.type === 'payable' && (!d.done || d.id === item?.debt_id))

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setAmount(item ? Number(item.amount) : 0)
    setKind(item?.kind ?? 'bill')
    setDebtId(item?.debt_id ?? '')
  }, [open, item])

  const pickDebt = (id) => {
    setDebtId(id)
    const d = debts.find((x) => x.id === id)
    if (d && !name) setName(`Cicilan ${d.person}`)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = { name: name.trim(), amount, kind, debt_id: kind === 'debt' && debtId ? debtId : null }
    try {
      if (item) await updateFixed(item.id, payload)
      else await addFixed(payload)
      onClose()
    } catch { /* */ } finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    try { await deleteFixed(item); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah pos tetap' : 'Tambah pos tetap'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-1 p-1 bg-soft rounded-xl">
          {Object.entries(KIND).map(([k, v]) => (
            <button type="button" key={k} onClick={() => setKind(k)}
              className={`h-9 rounded-lg text-sm ${kind === k ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{v.label}</button>
          ))}
        </div>
        {kind === 'debt' && (
          <label className="block"><span className="label">Hubungkan ke hutang (opsional)</span>
            <select className="input" value={debtId} onChange={(e) => pickDebt(e.target.value)}>
              <option value="">— Tidak dihubungkan —</option>
              {payable.map((d) => <option key={d.id} value={d.id}>{d.person} · sisa {rupiah(d.rest)}</option>)}
            </select>
            <span className="block text-xs text-muted mt-1.5">Saat dicentang "sudah dibayar", otomatis tercatat sebagai pembayaran hutang.</span>
          </label>
        )}
        <label className="block"><span className="label">Nama</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="cth. Kos, Listrik, Tabungan" />
        </label>
        <div><span className="label">Nominal</span><AmountInput value={amount} onChange={setAmount} /></div>
        <div className="flex gap-2">
          {item && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !name.trim()} className="btn-primary flex-1">Simpan</button>
        </div>
      </form>
    </Sheet>
  )
}
