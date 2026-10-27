import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Plus } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiahShort } from '../lib/format.js'

/** Tombol satu-ketuk untuk transaksi rutin + notifikasi "Batal". */
export default function QuickTemplates({ day }) {
  const { templates, catById, walletById, quickAdd, deleteExpense } = useData()
  const [toast, setToast] = useState(null)
  const [busy, setBusy] = useState(null)

  const add = async (t) => {
    setBusy(t.id)
    try {
      const row = await quickAdd(t, day)
      setToast({ id: row.id, text: `${t.label} ditambahkan` })
      setTimeout(() => setToast((x) => (x?.id === row.id ? null : x)), 5000)
    } catch { /* */ } finally { setBusy(null) }
  }
  const undo = async () => {
    const id = toast.id
    setToast(null)
    try { await deleteExpense(id) } catch { /* */ }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-muted flex items-center gap-1"><Zap size={13} /> Catat cepat</span>
        <Link to="/pengaturan#template" className="text-xs text-accent">Atur</Link>
      </div>
      {templates.length === 0 ? (
        <Link to="/pengaturan#template" className="card px-4 py-3 flex items-center gap-2 text-sm text-muted hover:border-accent">
          <Plus size={16} className="text-accent" /> Buat template, mis. "Kopi 20rb · GoPay"
        </Link>
      ) : (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {templates.map((t) => (
            <button key={t.id} disabled={busy === t.id} onClick={() => add(t)}
              className="shrink-0 card px-3.5 py-2.5 text-left hover:border-accent active:scale-[.97] transition disabled:opacity-50">
              <span className="block text-sm font-medium">{catById[t.category_id]?.icon ?? '⚡'} {t.label}</span>
              <span className="block text-[11px] text-muted tabular">
                Rp {rupiahShort(t.amount)}{t.wallet_id && walletById[t.wallet_id] ? ` · ${walletById[t.wallet_id].name}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 flex items-center gap-4 rounded-2xl bg-ink text-bg px-4 py-3 text-sm shadow-lg">
          <span>{toast.text}</span>
          <button onClick={undo} className="font-semibold text-accent-2">Batal</button>
        </div>
      )}
    </section>
  )
}
