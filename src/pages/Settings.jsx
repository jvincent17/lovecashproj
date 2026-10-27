import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Copy, LogOut, Moon, Palette, Plus, RefreshCw, Sun, Trash2, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import Sheet from '../components/Sheet.jsx'
import Avatar from '../components/Avatar.jsx'
import CouplePhoto from '../components/CouplePhoto.jsx'
import AmountInput from '../components/AmountInput.jsx'
import WalletPicker from '../components/WalletPicker.jsx'
import { rupiah } from '../lib/format.js'
import { MODES, PALETTES, useTheme } from '../lib/theme.js'

export default function Settings() {
  const { user, signOut } = useAuth()
  const { profile, cashflow, members, myCashflows, categories,
    updateProfile, updateCashflow, regenerateCode, joinCashflow, switchCashflow, leaveCashflow } = useData()
  const [cat, setCat] = useState({ open: false, item: null })
  const [tpl, setTpl] = useState({ open: false, item: null })
  const { templates, catById, walletById } = useData()
  useEffect(() => {
    if (window.location.hash === '#template') document.getElementById('template')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const [joinOpen, setJoinOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try { await navigator.clipboard.writeText(cashflow.invite_code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pengaturan</h1>

      <ProfileCard profile={profile} email={user?.email} onSave={updateProfile} />

      <ThemeCard />

      <CarryModeCard />

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
                <span className="text-sm flex-1">{c.name}</span>
                {c.monthly_limit && <span className="text-xs text-muted tabular">batas {rupiah(c.monthly_limit)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section id="template" className="card p-5 scroll-mt-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Template catat cepat</h2>
          <button onClick={() => setTpl({ open: true, item: null })} className="btn-ghost h-9 px-3"><Plus size={15} /> Tambah</button>
        </div>
        <p className="text-xs text-muted mb-2">Muncul di halaman Hari ini — sekali ketuk langsung tercatat.</p>
        {templates.length === 0 && <p className="text-sm text-muted py-3 text-center">Belum ada template.</p>}
        <ul className="divide-y divide-line">
          {templates.map((t) => (
            <li key={t.id}>
              <button onClick={() => setTpl({ open: true, item: t })} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="size-9 rounded-xl bg-soft grid place-items-center">{catById[t.category_id]?.icon ?? '⚡'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">{t.label}</span>
                  <span className="block text-xs text-muted">{catById[t.category_id]?.name ?? 'Tanpa kategori'} · {t.wallet_id ? walletById[t.wallet_id]?.name ?? '-' : 'Unlocated Money'}</span>
                </span>
                <span className="text-sm tabular">{rupiah(t.amount)}</span>
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
      <TemplateSheet open={tpl.open} item={tpl.item} onClose={() => setTpl({ open: false, item: null })} />
      <JoinSheet open={joinOpen} onClose={() => setJoinOpen(false)} onJoin={joinCashflow} />
    </div>
  )
}

const SWATCH = {
  pink: { light: ['#fde4f1', '#f472b6', '#c026a5'], dark: ['#3a1b33', '#f9a8d4', '#f5a3e3'] },
  blue: { light: ['#e2edfd', '#8fb6f7', '#4470d4'], dark: ['#1a2a47', '#c4d7ff', '#9dc1ff'] },
}

const CARRY = [
  { key: 'next', title: 'Potong penuh jatah hari berikutnya',
    hint: 'Seluruh minus hari ini memotong jatah besok (mis. jatah 31rb − minus 13rb = 18rb). Jatah hari-hari lain tidak berubah.' },
  { key: 'spread', title: 'Bagi rata ke sisa hari minggu ini',
    hint: 'Minus dibagi rata ke hari-hari tersisa di minggu itu, jadi jatah harian ikut menyesuaikan. Kalau sudah hari terakhir minggu, memotong jatah besok.' },
]

function CarryModeCard() {
  const { cashflow, updateCashflow } = useData()
  const mode = cashflow?.carry_mode || 'next'
  return (
    <section className="card p-5 space-y-3">
      <div>
        <h2 className="font-semibold">Kalau pengeluaran harian minus</h2>
        <p className="text-xs text-muted mt-0.5">Berlaku untuk semua anggota cashflow. Sisa (plus) selalu dibawa ke hari berikutnya.</p>
      </div>
      <div className="grid gap-2">
        {CARRY.map((c) => (
          <button key={c.key} onClick={() => mode !== c.key && updateCashflow({ carry_mode: c.key })}
            className={`text-left rounded-2xl border p-3.5 flex gap-3 transition ${mode === c.key ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'}`}>
            <span className={`mt-0.5 size-4 rounded-full border-2 shrink-0 ${mode === c.key ? 'border-accent bg-accent' : 'border-line'}`} />
            <span>
              <span className="block text-sm font-medium">{c.title}</span>
              <span className="block text-xs text-muted mt-0.5">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ThemeCard() {
  const [theme, setTheme] = useTheme()
  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-accent" />
        <h2 className="font-semibold">Tampilan</h2>
      </div>
      <div>
        <p className="label">Warna</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PALETTES).map(([key, label]) => {
            const active = theme.palette === key
            const [a, b, c] = SWATCH[key][theme.mode]
            return (
              <button key={key} onClick={() => setTheme({ palette: key })}
                className={`relative rounded-2xl border p-3 text-left transition ${active ? 'border-accent ring-2 ring-accent-soft' : 'border-line hover:border-accent'}`}>
                <span className="flex gap-1.5">
                  {[a, b, c].map((col) => <span key={col} className="size-6 rounded-full border border-black/5" style={{ background: col }} />)}
                </span>
                <span className="block text-sm font-medium mt-2">{label}</span>
                {active && <Check size={16} className="absolute top-3 right-3 text-accent" />}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="label">Mode</p>
        <div className="grid grid-cols-2 gap-1 p-1 bg-soft rounded-xl">
          {Object.entries(MODES).map(([key, label]) => (
            <button key={key} onClick={() => setTheme({ mode: key })}
              className={`h-10 rounded-lg text-sm inline-flex items-center justify-center gap-2 ${theme.mode === key ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>
              {key === 'light' ? <Sun size={16} /> : <Moon size={16} />} {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">Tersimpan di perangkat ini, tidak mengikuti setelan browser.</p>
    </section>
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
  const [limit, setLimit] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setName(item?.name ?? ''); setIcon(item?.icon ?? '📦'); setLimit(item?.monthly_limit ? Number(item.monthly_limit) : 0) } }, [open, item])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await saveCategory({ id: item?.id, name: name.trim(), icon, monthly_limit: limit || null }); onClose() } catch { /* */ } finally { setBusy(false) }
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
          <span className="label">Batas per periode (opsional)</span>
          <AmountInput value={limit} onChange={setLimit} placeholder="Tanpa batas" />
          <span className="block text-xs text-muted mt-1.5">Ada peringatan saat pengeluaran kategori ini mencapai 80% atau lewat batas.</span>
        </div>
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

function TemplateSheet({ open, item, onClose }) {
  const { categories, saveTemplate, deleteTemplate } = useData()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState(null)
  const [walletId, setWalletId] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setLabel(item?.label ?? '')
    setAmount(item ? Number(item.amount) : 0)
    setCategoryId(item?.category_id ?? categories[0]?.id ?? null)
    setWalletId(item?.wallet_id ?? null)
  }, [open, item, categories])
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await saveTemplate({ id: item?.id, label: label.trim(), amount, category_id: categoryId, wallet_id: walletId }); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteTemplate(item.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah template' : 'Template baru'}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block"><span className="label">Nama</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} required autoFocus placeholder="cth. Kopi pagi, Bensin, Parkir" />
        </label>
        <div><span className="label">Nominal</span><AmountInput value={amount} onChange={setAmount} /></div>
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
        <WalletPicker label="Bayar dari" value={walletId} onChange={setWalletId} showBalance={false} />
        <div className="flex gap-2">
          {item && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !label.trim() || !amount} className="btn-primary flex-1">Simpan</button>
        </div>
      </form>
    </Sheet>
  )
}
