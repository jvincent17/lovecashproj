import { useEffect, useState } from 'react'
import { LogOut, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import Sheet from '../components/Sheet.jsx'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { settings, setPayday, categories } = useData()
  const [payday, setPd] = useState(settings?.payday ?? 25)
  const [cat, setCat] = useState({ open: false, item: null })

  useEffect(() => { if (settings) setPd(settings.payday) }, [settings])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pengaturan</h1>

      <section className="card p-5 space-y-3">
        <label className="block">
          <span className="label">Tanggal gajian setiap bulan</span>
          <div className="flex gap-2">
            <select className="input" value={payday} onChange={(e) => setPd(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Tanggal {d}</option>)}
            </select>
            <button disabled={payday === settings?.payday} onClick={() => setPayday(payday)} className="btn-primary shrink-0">Simpan</button>
          </div>
        </label>
        <p className="text-xs text-muted">Dipakai sebagai default saat membuat periode baru. Kalau bulan itu tidak punya tanggal tersebut, dipakai hari terakhir bulan.</p>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Kategori pengeluaran</h2>
          <button onClick={() => setCat({ open: true, item: null })} className="btn-ghost h-9 px-3"><Plus size={15} /> Tambah</button>
        </div>
        <ul className="divide-y divide-line">
          {categories.map((c) => (
            <li key={c.id}>
              <button onClick={() => setCat({ open: true, item: c })} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="size-9 rounded-xl bg-soft grid place-items-center">{c.icon}</span>
                <span className="text-sm">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">Masuk sebagai</p>
          <p className="text-sm truncate">{user?.email}</p>
        </div>
        <button onClick={signOut} className="btn-ghost shrink-0"><LogOut size={16} /> Keluar</button>
      </section>

      <CategorySheet open={cat.open} item={cat.item} onClose={() => setCat({ open: false, item: null })} />
    </div>
  )
}

const EMOJI = ['🍜', '☕', '🛵', '🚗', '⛽', '🛒', '👕', '💡', '📱', '🏠', '🎬', '🎮', '💊', '🎁', '👨‍👩‍👧', '🐱', '📚', '✈️', '💇', '📦']

function CategorySheet({ open, item, onClose }) {
  const { saveCategory, deleteCategory } = useData()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📦')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setName(item?.name ?? ''); setIcon(item?.icon ?? '📦') } }, [open, item])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await saveCategory({ id: item?.id, name: name.trim(), icon }); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`Hapus kategori "${item.name}"? Pengeluaran lama akan menjadi "Tanpa kategori".`)) return
    setBusy(true)
    try { await deleteCategory(item.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah kategori' : 'Kategori baru'}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="label">Nama</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <div>
          <span className="label">Ikon</span>
          <div className="grid grid-cols-10 gap-1">
            {EMOJI.map((em) => (
              <button type="button" key={em} onClick={() => setIcon(em)}
                className={`aspect-square rounded-lg text-lg ${icon === em ? 'bg-accent-soft ring-1 ring-accent' : 'hover:bg-soft'}`}>{em}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {item && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !name.trim()} className="btn-primary flex-1">Simpan</button>
        </div>
      </form>
    </Sheet>
  )
}
