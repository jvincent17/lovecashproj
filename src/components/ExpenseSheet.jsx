import { useEffect, useState } from 'react'
import Sheet from './Sheet.jsx'
import AmountInput from './AmountInput.jsx'
import { useData } from '../context/DataContext.jsx'
import WalletPicker from './WalletPicker.jsx'
import { SourcePicker } from './Pockets.jsx'

const LAST = 'duitkara-last-wallet'
const lastWallet = () => { try { return localStorage.getItem(LAST) || null } catch { return null } }

/** Form tambah/edit pengeluaran. `expense` = null untuk tambah baru. */
export default function ExpenseSheet({ open, onClose, expense, defaultDate, defaultPocket = null }) {
  const { categories, saveExpense, deleteExpense, today, walletById, pocketById } = useData()
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState(null)
  const [walletId, setWalletId] = useState(null)
  const [pocketId, setPocketId] = useState(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(expense ? Number(expense.amount) : 0)
    setCategoryId(expense?.category_id ?? categories[0]?.id ?? null)
    setNote(expense?.note ?? '')
    setWalletId(expense ? expense.wallet_id : (walletById[lastWallet()] ? lastWallet() : null))
    setDate(expense?.date ?? defaultDate ?? today)
    setPocketId(expense ? (expense.pocket_id ?? null) : defaultPocket)
  }, [open, expense, defaultDate, defaultPocket, today, categories])

  const submit = async (e) => {
    e.preventDefault()
    if (!amount) return
    setBusy(true)
    try {
      await saveExpense({ id: expense?.id, amount, category_id: categoryId, wallet_id: walletId, pocket_id: pocketId && pocketById[pocketId] ? pocketId : null, note: note.trim() || null, date })
      try { walletId ? localStorage.setItem(LAST, walletId) : localStorage.removeItem(LAST) } catch { /* */ }
      onClose()
    } catch { /* error tampil di banner */ } finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true)
    try { await deleteExpense(expense.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={expense ? 'Ubah pengeluaran' : 'Catat pengeluaran'}>
      <form onSubmit={submit} className="space-y-4">
        <AmountInput big autoFocus value={amount} onChange={setAmount} />

        <div>
          <span className="label">Kategori</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button type="button" key={c.id} onClick={() => setCategoryId(c.id)}
                className={`chip ${categoryId === c.id ? 'border-accent bg-accent-soft text-accent' : 'text-ink'}`}>
                <span>{c.icon}</span>{c.name}
              </button>
            ))}
          </div>
        </div>

        <SourcePicker value={pocketId} onChange={setPocketId} />

        <WalletPicker label="Bayar dari" value={walletId} onChange={setWalletId} />

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 sm:col-span-1">
            <span className="label">Catatan</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="cth. makan siang" />
          </label>
          <label className="col-span-2 sm:col-span-1">
            <span className="label">Tanggal</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          {expense && <button type="button" onClick={remove} disabled={busy} className="btn-danger">Hapus</button>}
          <button disabled={busy || !amount} className="btn-primary flex-1">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </Sheet>
  )
}
