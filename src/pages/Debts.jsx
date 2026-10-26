import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { fmtShort } from '../lib/dates.js'
import Sheet from '../components/Sheet.jsx'
import AmountInput from '../components/AmountInput.jsx'
import Bar from '../components/Bar.jsx'

const TABS = [
  { key: 'payable', label: 'Saya berhutang', empty: 'Tidak ada hutang. Mantap!' },
  { key: 'receivable', label: 'Piutang', empty: 'Belum ada yang berhutang ke Anda.' },
]

export default function Debts() {
  const { debts, today } = useData()
  const [tab, setTab] = useState('payable')
  const [showDone, setShowDone] = useState(false)
  const [form, setForm] = useState({ open: false, debt: null })
  const [detailId, setDetailId] = useState(null)

  const list = debts.filter((d) => d.type === tab)
  const active = list.filter((d) => !d.done)
  const done = list.filter((d) => d.done)
  const totalRest = active.reduce((a, d) => a + d.rest, 0)
  const t = TABS.find((x) => x.key === tab)
  const detail = debts.find((d) => d.id === detailId) || null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 bg-soft rounded-xl">
        {TABS.map((x) => (
          <button key={x.key} onClick={() => setTab(x.key)}
            className={`h-10 rounded-lg text-sm ${tab === x.key ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{x.label}</button>
        ))}
      </div>

      <section className="hero p-5 flex items-end justify-between gap-3">
        <img src="/img/hero-debts.webp" alt="" className="hero-photo" />
        <div>
          <p className="text-sm text-muted">{tab === 'payable' ? 'Total hutang belum lunas' : 'Total piutang belum kembali'}</p>
          <p className={`text-3xl font-semibold tabular mt-1 ${tab === 'payable' && totalRest > 0 ? 'text-danger' : ''}`}>{rupiah(totalRest)}</p>
          <p className="text-xs text-muted mt-1">{active.length} catatan aktif</p>
        </div>
        <button onClick={() => setForm({ open: true, debt: null })} className="btn-primary"><Plus size={16} /> Tambah</button>
      </section>

      {active.length === 0 && <p className="text-sm text-muted text-center py-6">{t.empty}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {active.map((d) => <DebtCard key={d.id} d={d} today={today} onClick={() => setDetailId(d.id)} />)}
      </div>

      {done.length > 0 && (
        <div>
          <button onClick={() => setShowDone((v) => !v)} className="text-sm text-muted underline underline-offset-4">
            {showDone ? 'Sembunyikan' : 'Tampilkan'} yang sudah lunas ({done.length})
          </button>
          {showDone && (
            <div className="grid gap-3 md:grid-cols-2 mt-3 opacity-70">
              {done.map((d) => <DebtCard key={d.id} d={d} today={today} onClick={() => setDetailId(d.id)} />)}
            </div>
          )}
        </div>
      )}

      <DebtForm open={form.open} debt={form.debt} type={tab} onClose={() => setForm({ open: false, debt: null })} />
      <DebtDetail debt={detail} onClose={() => setDetailId(null)}
        onEdit={() => { setForm({ open: true, debt: detail }); setDetailId(null) }} />
    </div>
  )
}

function DebtCard({ d, today, onClick }) {
  const overdue = !d.done && d.due_date && d.due_date < today
  return (
    <button onClick={onClick} className="card p-4 text-left hover:border-accent transition">
      <div className="flex justify-between gap-2">
        <span className="font-medium truncate">{d.person}</span>
        {d.done
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent">Lunas</span>
          : d.due_date && <span className={`text-xs ${overdue ? 'text-danger font-medium' : 'text-muted'}`}>{overdue ? 'Lewat ' : 'Jatuh tempo '}{fmtShort(d.due_date)}</span>}
      </div>
      <p className="text-xl font-semibold tabular mt-2">{rupiah(d.rest)}</p>
      <p className="text-xs text-muted">sisa dari {rupiah(d.amount)}</p>
      <Bar value={d.paid} max={Number(d.amount)} className="mt-3" />
      {d.note && <p className="text-xs text-muted mt-2 truncate">{d.note}</p>}
    </button>
  )
}

function DebtForm({ open, debt, type, onClose }) {
  const { saveDebt } = useData()
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState(0)
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPerson(debt?.person ?? '')
    setAmount(debt ? Number(debt.amount) : 0)
    setDue(debt?.due_date ?? '')
    setNote(debt?.note ?? '')
  }, [open, debt])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveDebt({ id: debt?.id, type: debt?.type ?? type, person: person.trim(), amount, due_date: due || null, note: note.trim() || null })
      onClose()
    } catch { /* */ } finally { setBusy(false) }
  }

  const isPayable = (debt?.type ?? type) === 'payable'
  return (
    <Sheet open={open} onClose={onClose} title={debt ? 'Ubah catatan' : isPayable ? 'Tambah hutang' : 'Tambah piutang'}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="label">{isPayable ? 'Berhutang kepada' : 'Yang berhutang'}</span>
          <input className="input" value={person} onChange={(e) => setPerson(e.target.value)} required placeholder="Nama orang / instansi" autoFocus />
        </label>
        <div><span className="label">Jumlah</span><AmountInput value={amount} onChange={setAmount} /></div>
        <label className="block"><span className="label">Jatuh tempo (opsional)</span>
          <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="block"><span className="label">Catatan (opsional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button disabled={busy || !amount || !person.trim()} className="btn-primary w-full">Simpan</button>
      </form>
    </Sheet>
  )
}

function DebtDetail({ debt, onClose, onEdit }) {
  const { addPayment, deletePayment, deleteDebt, today } = useData()
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (debt) { setAmount(debt.rest); setDate(today) } }, [debt?.id, debt?.rest, today]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!debt) return null
  const isPayable = debt.type === 'payable'

  const pay = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await addPayment({ debt_id: debt.id, amount: Math.min(amount, debt.rest), date }) } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`Hapus catatan ${debt.person} beserta riwayat pembayarannya?`)) return
    setBusy(true)
    try { await deleteDebt(debt.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} title={debt.person}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div><p className="text-xs text-muted">Total</p><p className="tabular font-medium">{rupiah(debt.amount)}</p></div>
          <div><p className="text-xs text-muted">{isPayable ? 'Dibayar' : 'Diterima'}</p><p className="tabular font-medium">{rupiah(debt.paid)}</p></div>
          <div><p className="text-xs text-muted">Sisa</p><p className="tabular font-medium">{rupiah(debt.rest)}</p></div>
        </div>
        <Bar value={debt.paid} max={Number(debt.amount)} />

        {!debt.done && (
          <form onSubmit={pay} className="space-y-3">
            <span className="label">{isPayable ? 'Catat pembayaran' : 'Catat uang diterima'}</span>
            <AmountInput value={amount} onChange={setAmount} />
            <div className="flex gap-2">
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
              <button disabled={busy || !amount} className="btn-primary shrink-0">Simpan</button>
            </div>
            <button type="button" disabled={busy} onClick={() => setAmount(debt.rest)} className="text-xs text-accent">Isi lunas ({rupiah(debt.rest)})</button>
          </form>
        )}

        <div>
          <p className="font-medium text-sm mb-1">Riwayat</p>
          {debt.payments.length === 0 && <p className="text-sm text-muted py-3">Belum ada pembayaran.</p>}
          <ul className="divide-y divide-line">
            {debt.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="text-muted w-16 shrink-0">{fmtShort(p.date)}</span>
                <span className="flex-1 truncate text-muted">{p.note}</span>
                <span className="tabular">{rupiah(p.amount)}</span>
                <button onClick={() => deletePayment(p.id)} className="text-muted hover:text-danger" aria-label="Hapus"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button onClick={remove} disabled={busy} className="btn-danger"><Trash2 size={16} /></button>
          <button onClick={onEdit} className="btn-ghost flex-1">Ubah data</button>
        </div>
      </div>
    </Sheet>
  )
}
