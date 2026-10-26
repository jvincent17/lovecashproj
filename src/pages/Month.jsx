import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, Repeat } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { addDays, cycleFor, fmtRange, fmtShort } from '../lib/dates.js'
import Sheet from '../components/Sheet.jsx'
import AmountInput from '../components/AmountInput.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'
import Bar from '../components/Bar.jsx'

const KIND = {
  bill: { label: 'Tagihan', cls: 'bg-soft text-muted' },
  saving: { label: 'Tabungan', cls: 'bg-accent-soft text-accent' },
  debt: { label: 'Cicilan/Kredit', cls: 'bg-danger-soft text-danger' },
}

export default function Month() {
  const { period, periods, plan, incomes, billsThis, billsNext, nextRange, expenses, saldo, spentTotal,
    selectPeriod, deletePeriod, memberName, members } = useData()
  const [newPeriod, setNewPeriod] = useState(false)
  const [income, setIncome] = useState({ open: false, item: null })
  const [bill, setBill] = useState({ open: false, item: null, defaultDue: null })
  const [billTab, setBillTab] = useState('this')

  if (!period) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Mulai periode pertama</h1>
        <div className="card p-5"><PeriodForm onDone={() => {}} /></div>
      </div>
    )
  }

  const shownBills = billTab === 'this' ? billsThis : billsNext
  const shownTotal = shownBills.reduce((a, b) => a + Number(b.amount), 0)
  const shownPaid = shownBills.filter((b) => b.paid).reduce((a, b) => a + Number(b.amount), 0)
  const shared = members.length > 1

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select className="input flex-1" value={period.id} onChange={(e) => selectPeriod(e.target.value)}>
          {periods.map((p) => <option key={p.id} value={p.id}>{fmtRange(p.start_date, p.end_date)}</option>)}
        </select>
        <button onClick={() => setNewPeriod(true)} className="btn-ghost shrink-0"><Plus size={16} /> Periode</button>
      </div>

      {/* Ringkasan */}
      <section className="hero p-5">
        <img src="/img/hero-month.webp" alt="" className="hero-photo" />
        <p className="text-sm text-muted">Saldo sekarang</p>
        <p className={`text-3xl font-semibold tabular ${saldo < 0 ? 'text-danger' : ''}`}>{rupiah(saldo)}</p>
        <p className="text-xs text-muted mt-0.5">Pemasukan − tagihan dibayar − pengeluaran</p>
        <dl className="mt-5 space-y-2 text-sm max-w-xs">
          <Row label="Total pemasukan" value={rupiah(plan.income)} />
          <Row label="Tagihan bulan ini" value={`-${rupiah(plan.billsTotal)}`} />
          <Row label="Budget harian/mingguan" value={rupiah(plan.flexible)} bold />
          <Row label="Sudah terpakai" value={rupiah(spentTotal)} />
        </dl>
        <Bar value={spentTotal} max={plan.flexible} className="mt-3 max-w-xs" />
        {plan.billsTotal > plan.income && (
          <p className="text-xs text-danger mt-3">Tagihan melebihi pemasukan sebesar {rupiah(plan.billsTotal - plan.income)}.</p>
        )}
      </section>

      {/* Pemasukan */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-semibold">Pemasukan</h2>
            <p className="text-xs text-muted">Gaji, bonus, freelance, kiriman, dll.</p>
          </div>
          <button onClick={() => setIncome({ open: true, item: null })} className="btn-ghost h-9 px-3"><Plus size={15} /> Tambah</button>
        </div>
        {incomes.length === 0 && <p className="text-sm text-muted py-4 text-center">Belum ada pemasukan di periode ini.</p>}
        <ul className="divide-y divide-line">
          {incomes.map((i) => (
            <li key={i.id}>
              <button onClick={() => setIncome({ open: true, item: i })} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="size-9 rounded-xl bg-accent-soft text-accent grid place-items-center text-sm">＋</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">{i.name}</span>
                  <span className="block text-xs text-muted">{fmtShort(i.date)}{shared && i.created_by ? ` · ${memberName(i.created_by)}` : ''}</span>
                </span>
                <span className="text-sm tabular font-medium text-accent">+{rupiah(i.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
        {incomes.length > 0 && (
          <div className="flex justify-between border-t border-line pt-3 mt-1 text-sm font-medium">
            <span>Total</span><span className="tabular">{rupiah(plan.income)}</span>
          </div>
        )}
      </section>

      {/* Tagihan */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Tagihan</h2>
            <p className="text-xs text-muted">Centang kalau sudah dibayar — saldo otomatis berkurang.</p>
          </div>
          <button onClick={() => setBill({ open: true, item: null, defaultDue: billTab === 'this' ? null : nextRange.start })}
            className="btn-ghost h-9 px-3 shrink-0"><Plus size={15} /> Tambah</button>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-soft rounded-xl mb-2">
          {[['this', 'Bulan ini'], ['next', 'Bulan depan']].map(([k, l]) => (
            <button key={k} onClick={() => setBillTab(k)}
              className={`h-9 rounded-lg text-sm ${billTab === k ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        <p className="text-xs text-muted mb-1">
          {billTab === 'this' ? fmtRange(period.start_date, period.end_date) : fmtRange(nextRange.start, nextRange.end)}
        </p>
        {shownBills.length === 0 && <p className="text-sm text-muted py-4 text-center">Belum ada tagihan.</p>}
        <ul className="divide-y divide-line">
          {shownBills.map((b) => <BillRow key={b.id} b={b} onEdit={() => setBill({ open: true, item: b })} />)}
        </ul>
        {shownBills.length > 0 && (
          <div className="flex justify-between border-t border-line pt-3 mt-1 text-sm">
            <span className="text-muted">Dibayar {rupiah(shownPaid)}</span>
            <span className="font-medium tabular">Total {rupiah(shownTotal)}</span>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Pembagian mingguan</h2>
        <ul className="space-y-2 text-sm">
          {plan.weeks.map((w) => (
            <li key={w.index} className="flex justify-between gap-2">
              <span className="text-muted">Minggu {w.index + 1} · {fmtRange(w.start, w.end)}</span>
              <span className="tabular">{rupiah(w.amount)}{w.isCustom && <span className="text-accent"> *</span>}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted mt-3">Ubah per minggu di halaman Minggu, per hari di halaman Hari ini. (* = manual)</p>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Pengeluaran per kategori</h2>
        <CategoryBreakdown items={expenses} />
      </section>

      <button
        onClick={() => { if (confirm('Hapus periode ini beserta pemasukan & pengaturan budgetnya? Pengeluaran dan tagihan tidak ikut terhapus.')) deletePeriod(period.id) }}
        className="btn-danger w-full">
        <Trash2 size={16} /> Hapus periode ini
      </button>

      <Sheet open={newPeriod} onClose={() => setNewPeriod(false)} title="Periode baru">
        <PeriodForm onDone={() => setNewPeriod(false)} />
      </Sheet>
      <IncomeSheet open={income.open} item={income.item} onClose={() => setIncome({ open: false, item: null })} />
      <BillSheet open={bill.open} item={bill.item} defaultDue={bill.defaultDue} onClose={() => setBill({ open: false, item: null })} />
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between gap-4 ${bold ? 'font-medium border-t border-line pt-2' : ''}`}>
      <dt className={bold ? '' : 'text-muted'}>{label}</dt><dd className="tabular">{value}</dd>
    </div>
  )
}

function BillRow({ b, onEdit }) {
  const { toggleBillPaid, today } = useData()
  const overdue = !b.paid && b.due_date < today
  return (
    <li className="flex items-center gap-3 py-3">
      <button onClick={() => toggleBillPaid(b)} aria-label="Tandai sudah dibayar"
        className={`size-6 shrink-0 rounded-lg border grid place-items-center ${b.paid ? 'bg-accent border-accent text-white dark:text-[#2b1d28]' : 'border-line'}`}>
        {b.paid && <Check size={14} />}
      </button>
      <button onClick={onEdit} className="flex-1 min-w-0 text-left">
        <span className={`block text-sm truncate ${b.paid ? 'line-through text-muted' : ''}`}>{b.name}</span>
        <span className="flex items-center gap-1.5 mt-0.5 text-[11px]">
          <span className={`px-1.5 py-0.5 rounded ${KIND[b.kind].cls}`}>{KIND[b.kind].label}</span>
          <span className={overdue ? 'text-danger font-medium' : 'text-muted'}>
            {b.paid ? `dibayar ${fmtShort(b.paid_at || b.due_date)}` : `${overdue ? 'lewat ' : 'jatuh tempo '}${fmtShort(b.due_date)}`}
          </span>
          {b.recurring && <Repeat size={11} className="text-muted" aria-label="Berulang" />}
        </span>
      </button>
      <span className="text-sm tabular">{rupiah(b.amount)}</span>
    </li>
  )
}

function PeriodForm({ onDone }) {
  const { payday, periods, today, createPeriod } = useData()
  const latest = periods[0]
  const def = latest && latest.end_date >= today
    ? (() => { const s = addDays(latest.end_date, 1); return { start: s, end: cycleFor(s, payday).end } })()
    : cycleFor(today, payday)

  const [start, setStart] = useState(def.start)
  const [end, setEnd] = useState(def.end)
  const [name, setName] = useState('Gaji')
  const [amount, setAmount] = useState(0)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await createPeriod({ start_date: start, end_date: end, firstIncome: { name, amount } }); onDone() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Mulai (tgl gajian)</span>
          <input type="date" className="input" value={start} onChange={(e) => { setStart(e.target.value); setEnd(cycleFor(e.target.value, payday).end) }} required />
        </label>
        <label><span className="label">Sampai</span>
          <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
        </label>
      </div>
      <div>
        <span className="label">Pemasukan pertama (opsional, bisa ditambah nanti)</span>
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gaji" />
          <AmountInput value={amount} onChange={setAmount} />
        </div>
      </div>
      <p className="text-xs text-muted">
        Tanggal gajian: {payday} (ubah di Pengaturan).{latest && ' Tagihan berulang dari periode sebelumnya disalin otomatis.'}
      </p>
      <button disabled={busy} className="btn-primary w-full">{busy ? 'Menyimpan…' : 'Mulai periode'}</button>
    </form>
  )
}

function IncomeSheet({ open, item, onClose }) {
  const { period, saveIncome, deleteIncome, today } = useData()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setAmount(item ? Number(item.amount) : 0)
    const d = item?.date ?? today
    setDate(d < period.start_date || d > period.end_date ? period.start_date : d)
  }, [open, item, today, period])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await saveIncome({ id: item?.id, name: name.trim(), amount, date }); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteIncome(item.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah pemasukan' : 'Tambah pemasukan'}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="label">Nama pemasukan</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="cth. Gaji, Bonus, Freelance" />
        </label>
        <div><span className="label">Nominal</span><AmountInput big value={amount} onChange={setAmount} /></div>
        <label className="block"><span className="label">Tanggal masuk</span>
          <input type="date" className="input" value={date} min={period.start_date} max={period.end_date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="flex gap-2">
          {item && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !amount || !name.trim()} className="btn-primary flex-1">Simpan</button>
        </div>
      </form>
    </Sheet>
  )
}

function BillSheet({ open, item, defaultDue, onClose }) {
  const { debts, period, saveBill, deleteBill } = useData()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [due, setDue] = useState('')
  const [kind, setKind] = useState('bill')
  const [debtId, setDebtId] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const payable = debts.filter((d) => d.type === 'payable' && (!d.done || d.id === item?.debt_id))

  useEffect(() => {
    if (!open) return
    setName(item?.name ?? '')
    setAmount(item ? Number(item.amount) : 0)
    setDue(item?.due_date ?? defaultDue ?? period.start_date)
    setKind(item?.kind ?? 'bill')
    setDebtId(item?.debt_id ?? '')
    setRecurring(item?.recurring ?? false)
    setNote(item?.note ?? '')
  }, [open, item, defaultDue, period])

  const pickDebt = (id) => {
    setDebtId(id)
    const d = debts.find((x) => x.id === id)
    if (d && !name) setName(`Cicilan ${d.person}`)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const payload = {
      id: item?.id, name: name.trim(), amount, due_date: due, kind, recurring,
      note: note.trim() || null, debt_id: kind === 'debt' && debtId ? debtId : null,
    }
    try { await saveBill(payload); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteBill(item); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah tagihan' : 'Tambah tagihan'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-1 p-1 bg-soft rounded-xl">
          {Object.entries(KIND).map(([k, v]) => (
            <button type="button" key={k} onClick={() => setKind(k)}
              className={`h-9 rounded-lg text-xs sm:text-sm ${kind === k ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{v.label}</button>
          ))}
        </div>
        <label className="block"><span className="label">Nama tagihan</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required
            placeholder={kind === 'debt' ? 'cth. Kredit BCA periode Oktober' : kind === 'saving' ? 'cth. Tabungan nikah' : 'cth. Kos, Listrik, Internet'} />
        </label>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <div><span className="label">Nominal</span><AmountInput value={amount} onChange={setAmount} /></div>
          <label><span className="label">Jatuh tempo</span>
            <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} required />
          </label>
        </div>
        {kind === 'debt' && (
          <label className="block"><span className="label">Hubungkan ke catatan hutang (opsional)</span>
            <select className="input" value={debtId} onChange={(e) => pickDebt(e.target.value)}>
              <option value="">— Tidak dihubungkan —</option>
              {payable.map((d) => <option key={d.id} value={d.id}>{d.person} · sisa {rupiah(d.rest)}</option>)}
            </select>
            <span className="block text-xs text-muted mt-1.5">Saat dicentang, otomatis tercatat sebagai pembayaran hutang tersebut.</span>
          </label>
        )}
        <label className="block"><span className="label">Catatan (opsional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. no. kartu, rekening tujuan" />
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Ulangi setiap bulan (otomatis disalin ke periode baru)
        </label>
        <div className="flex gap-2">
          {item && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !name.trim()} className="btn-primary flex-1">Simpan</button>
        </div>
      </form>
    </Sheet>
  )
}
