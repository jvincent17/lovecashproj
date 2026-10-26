import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { usePhotoUrl } from '../lib/photos.js'
import Sheet from './Sheet.jsx'

/** Foto bersama cashflow + keterangan. Klik untuk mengubah. */
export default function CouplePhoto({ className = '' }) {
  const { cashflow } = useData()
  const url = usePhotoUrl(cashflow?.photo_path)
  const [open, setOpen] = useState(false)
  const caption = cashflow?.photo_caption || 'Kita berdua 💗'

  return (
    <>
      <button onClick={() => setOpen(true)} className={`block w-full text-left group ${className}`} aria-label="Ubah foto bersama">
        {url ? (
          <img src={url} alt="" className="w-full aspect-[4/5] object-cover rounded-2xl group-hover:opacity-90 transition" />
        ) : (
          <span className="w-full aspect-[4/5] rounded-2xl border-2 border-dashed border-line grid place-items-center text-muted
            group-hover:border-accent group-hover:text-accent transition">
            <span className="flex flex-col items-center gap-2 text-xs"><ImagePlus size={24} /> Tambah foto</span>
          </span>
        )}
        <span className="block text-xs text-muted text-center mt-2 truncate">{caption}</span>
      </button>
      <CoupleSheet open={open} onClose={() => setOpen(false)} url={url} />
    </>
  )
}

function CoupleSheet({ open, onClose, url }) {
  const { cashflow, setCashflowPhoto, removeCashflowPhoto, updateCashflow } = useData()
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  useEffect(() => { if (open) setCaption(cashflow?.photo_caption || 'Kita berdua 💗') }, [open, cashflow])

  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try { await setCashflowPhoto(f) } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await removeCashflowPhoto() } catch { /* */ } finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true)
    try { await updateCashflow({ photo_caption: caption.trim() || 'Kita berdua 💗' }); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Foto bersama">
      <div className="space-y-4">
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className="block w-48 mx-auto aspect-[4/5] rounded-2xl overflow-hidden border-2 border-dashed border-line hover:border-accent">
          {url
            ? <img src={url} alt="" className="w-full h-full object-cover" />
            : <span className="w-full h-full grid place-items-center text-muted text-xs"><span className="flex flex-col items-center gap-2"><ImagePlus size={24} />{busy ? 'Mengunggah…' : 'Pilih foto'}</span></span>}
        </button>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
        <div className="flex gap-2 justify-center">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-ghost">
            <ImagePlus size={16} /> {busy ? 'Mengunggah…' : url ? 'Ganti foto' : 'Pilih foto'}
          </button>
          {url && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /> Hapus</button>}
        </div>
        <label className="block"><span className="label">Keterangan</span>
          <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={60} placeholder="Kita berdua 💗" />
        </label>
        <p className="text-xs text-muted">Foto dan keterangan ini terlihat oleh semua anggota cashflow.</p>
        <button disabled={busy} onClick={save} className="btn-primary w-full">Simpan</button>
      </div>
    </Sheet>
  )
}
