import { useEffect, useRef, useState } from 'react'
import { Camera, Copy, LogOut, Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import Sheet from '../components/Sheet.jsx'
import Avatar from '../components/Avatar.jsx'
import CouplePhoto from '../components/CouplePhoto.jsx'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { profile, cashflow, members, myCashflows, categories,
    updateProfile, updateCashflow, regenerateCode, joinCashflow, switchCashflow, leaveCashflow } = useData()
  const [cat, setCat] = useState({ open: false, item: null })
  const [joinOpen, setJoinOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(cashflow.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pengaturan</h1>

      <ProfileCard profile={profile} email={user?.email} onSave={updateProfile} />

      {/* Cashflow bersama */}
      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-accent" />
          <h2 className="font-semibold">Cashflow bersama</h2>
        </div>

        <CashflowForm cashflow={cashflow} onSave={updateCashflow} />

        <div className="md:hidden">
          <p className="label">Foto bersama</p>
          <CouplePhoto className="max-w-[180px]" />
        </div>

        <div className="rounded-2xl bg-accent-soft p-4">
          <p className="text-xs text-muted">Kode undangan — bagikan ke pasangan</p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-2xl font-semibold tracking-[0.3em] tabular text-accent">{cashflow?.invite_code}</span>
            <div className="flex gap-1">
              <button onClick={copy} className="btn-ghost h-9 px-3 bg-card"><Copy size={15} /> {copied ? 'Tersalin' : 'Salin'}</button>
              <button onClick={() => { if (confirm('Buat kode baru? Kode lama tidak bisa dipakai lagi.')) regenerateCode() }}
                className="btn-ghost h-9 px-3 bg-card" aria-label="Buat kode baru"><RefreshCw size={15} /></button>
            </div>
          </div>
          <p className="text-xs text-muted mt-2">Pasangan Anda: Pengaturan → <b>Gabung dengan kode</b> → masukkan kode ini.</p>
        </div>

        <div>
          <p className="label">Anggota ({members.length})</p>
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                <Avatar path={m.profile?.avatar_path} name={m.profile?.display_name || m.profile?.username} className="size-9" ring={false} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">
                    {m.profile?.display_name || m.profile?.username || 'Tanpa nama'}{m.user_id === user.id && ' (Anda)'}
                  </span>
                  <span className="block text-xs text-muted">@{m.profile?.username || '—'} · {m.role === 'owner' ? 'pembuat' : 'anggota'}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {myCashflows.length > 1 && (
          <label className="block">
            <span className="label">Pindah cashflow</span>
            <select className="input" value={cashflow?.id} onChange={(e) => switchCashflow(e.target.value)}>
              {myCashflows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setJoinOpen(true)} className="btn-primary flex-1">Gabung dengan kode</button>
          <button
            onClick={() => {
              const last = members.length <= 1
              if (confirm(last ? 'Anda anggota terakhir. Keluar akan MENGHAPUS cashflow ini beserta seluruh datanya. Lanjutkan?'
                : 'Keluar dari cashflow ini? Data tetap ada untuk anggota lain.')) leaveCashflow()
            }}
            className="btn-danger">Keluar</button>
        </div>
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
          <p className="text-sm truncate">@{profile?.username || '—'} · {user?.email}</p>
        </div>
        <button onClick={signOut} className="btn-ghost shrink-0"><LogOut size={16} /> Keluar</button>
      </section>

      <CategorySheet open={cat.open} item={cat.item} onClose={() => setCat({ open: false, item: null })} />
      <JoinSheet open={joinOpen} onClose={() => setJoinOpen(false)} onJoin={joinCashflow} />
    </div>
  )
}

function AvatarPicker({ profile }) {
  const { setAvatar, removeAvatar } = useData()
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try { await setAvatar(f) } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await removeAvatar() } catch { /* */ } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} className="relative" aria-label="Ganti foto profil">
        <Avatar path={profile?.avatar_path} name={profile?.display_name || profile?.username} className="size-20 text-2xl" />
        <span className="absolute -bottom-1 -right-1 size-8 rounded-full bg-card border border-line grid place-items-center text-accent">
          <Camera size={15} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} />
      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn-ghost h-9 px-3">
          {busy ? 'Mengunggah…' : profile?.avatar_path ? 'Ganti foto' : 'Tambah foto'}
        </button>
        {profile?.avatar_path && (
          <button type="button" disabled={busy} onClick={remove} className="text-xs text-danger inline-flex items-center gap-1"><Trash2 size={12} /> Hapus foto</button>
        )}
      </div>
    </div>
  )
}

function ProfileCard({ profile, email, onSave }) {
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  useEffect(() => { setUsername(profile?.username ?? ''); setName(profile?.display_name ?? '') }, [profile])
  const dirty = username !== (profile?.username ?? '') || name !== (profile?.display_name ?? '')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true); setOk(false)
    try { await onSave({ username, display_name: name.trim() || null }); setOk(true) } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="card p-5 space-y-3">
      <h2 className="font-semibold">Profil</h2>
      <AvatarPicker profile={profile} />
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="label">Username (untuk login)</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())}
            autoCapitalize="none" spellCheck={false} placeholder="cth. kara" />
        </label>
        <label className="block"><span className="label">Nama tampilan</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Kara" />
        </label>
      </div>
      <p className="text-xs text-muted">Login bisa pakai username atau email ({email}).</p>
      <div className="flex items-center gap-3">
        <button disabled={busy || !dirty} className="btn-primary">Simpan profil</button>
        {ok && !dirty && <span className="text-xs text-accent">Tersimpan ✓</span>}
      </div>
    </form>
  )
}

function CashflowForm({ cashflow, onSave }) {
  const [name, setName] = useState('')
  const [payday, setPayday] = useState(25)
  useEffect(() => { if (cashflow) { setName(cashflow.name); setPayday(cashflow.payday) } }, [cashflow])
  const dirty = cashflow && (name !== cashflow.name || payday !== cashflow.payday)
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
      <label className="block"><span className="label">Nama cashflow</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block"><span className="label">Tgl gajian</span>
        <select className="input" value={payday} onChange={(e) => setPayday(Number(e.target.value))}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      {dirty && (
        <button onClick={() => onSave({ name: name.trim() || 'Dompet Kita', payday })} className="btn-primary col-span-2">Simpan</button>
      )}
    </div>
  )
}

function JoinSheet({ open, onClose, onJoin }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setCode('') }, [open])
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await onJoin(code); onClose() } catch { /* error tampil di banner */ } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Gabung cashflow">
      <form onSubmit={submit} className="space-y-4">
        <input className="input h-14 text-center text-2xl tracking-[0.4em] uppercase font-semibold" maxLength={6}
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KODE" autoFocus required />
        <p className="text-xs text-muted">Setelah bergabung, Anda melihat dan mengisi data yang sama dengan pasangan. Cashflow lama Anda tetap ada dan bisa dipilih lagi di sini.</p>
        <button disabled={busy || code.length < 6} className="btn-primary w-full">{busy ? 'Memproses…' : 'Gabung'}</button>
      </form>
    </Sheet>
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
