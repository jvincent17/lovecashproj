import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Sun, CalendarDays, Wallet, HandCoins, PiggyBank, Settings as Cog, X, History, BarChart3,
  MoreHorizontal, Eye, EyeOff, WifiOff,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { greeting } from '../lib/photos.js'
import { usePrivacy } from '../lib/privacy.js'
import Avatar from './Avatar.jsx'
import CouplePhoto from './CouplePhoto.jsx'
import Sheet from './Sheet.jsx'

const MAIN = [
  { to: '/', label: 'Hari ini', icon: Sun, end: true },
  { to: '/minggu', label: 'Minggu', icon: CalendarDays },
  { to: '/bulan', label: 'Bulan', icon: Wallet },
  { to: '/lokasi', label: 'Lokasi', icon: PiggyBank },
]
const MORE = [
  { to: '/hutang', label: 'Hutang', icon: HandCoins, hint: 'Hutang & piutang' },
  { to: '/riwayat', label: 'Riwayat', icon: History, hint: 'Cari & filter semua transaksi' },
  { to: '/laporan', label: 'Laporan', icon: BarChart3, hint: 'Grafik & perbandingan bulanan' },
  { to: '/pengaturan', label: 'Pengaturan', icon: Cog, hint: 'Profil, tema, cashflow, kategori' },
]

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export default function Layout() {
  const { ready, error, clearError, profile } = useData()
  const [hello, setHello] = useState(greeting())
  const [privacy, togglePrivacy] = usePrivacy()
  const [moreOpen, setMoreOpen] = useState(false)
  const online = useOnline()
  const { pathname } = useLocation()
  useEffect(() => {
    const t = setInterval(() => setHello(greeting()), 60_000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => setMoreOpen(false), [pathname])
  const name = profile?.display_name || profile?.username || 'kamu'
  const moreActive = MORE.some((m) => pathname.startsWith(m.to))

  const PrivacyBtn = ({ className = '' }) => (
    <button onClick={togglePrivacy} aria-label={privacy ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
      title={privacy ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
      className={`size-10 grid place-items-center rounded-xl hover:bg-soft ${privacy ? 'text-accent' : 'text-muted'} ${className}`}>
      {privacy ? <EyeOff size={19} /> : <Eye size={19} />}
    </button>
  )

  const navCls = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 h-10 text-sm transition ${isActive ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:bg-soft'}`

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line px-4 py-6 sticky top-0 h-dvh overflow-y-auto">
        <div className="flex items-center gap-2 mb-6">
          <NavLink to="/pengaturan" className="flex items-center gap-3 px-2 rounded-xl flex-1 min-w-0">
            <Avatar path={profile?.avatar_path} name={name} className="size-10" />
            <span className="min-w-0 leading-tight">
              <span className="block text-xs text-muted">{hello},</span>
              <span className="block font-semibold truncate">{name}</span>
            </span>
          </NavLink>
          <PrivacyBtn />
        </div>
        <nav className="space-y-1">
          {MAIN.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navCls}><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <nav className="space-y-1 mt-4 pt-4 border-t border-line flex-1">
          {MORE.filter((m) => m.to !== '/pengaturan').map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navCls}><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <CouplePhoto className="my-4" />
        <NavLink to="/pengaturan" className={navCls}><Cog size={18} /> Pengaturan</NavLink>
      </aside>

      {/* Konten */}
      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between gap-2 px-4 pt-4">
          <NavLink to="/pengaturan" className="flex items-center gap-2.5 min-w-0">
            <Avatar path={profile?.avatar_path} name={name} className="size-9" />
            <span className="min-w-0 leading-tight">
              <span className="block text-[11px] text-muted">{hello},</span>
              <span className="block font-semibold truncate">{name} 👋</span>
            </span>
          </NavLink>
          <div className="flex items-center">
            <PrivacyBtn />
            <NavLink to="/pengaturan" className="size-10 grid place-items-center rounded-xl text-muted hover:bg-soft" aria-label="Pengaturan">
              <Cog size={20} />
            </NavLink>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-12">
          {!online && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-soft text-muted px-4 py-2.5 text-sm">
              <WifiOff size={16} /> Sedang offline — menampilkan data terakhir. Perubahan baru bisa disimpan saat online.
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-danger-soft text-danger px-4 py-3 text-sm">
              <span className="flex-1">{error}</span>
              <button onClick={clearError} aria-label="Tutup"><X size={16} /></button>
            </div>
          )}
          {ready ? <Outlet /> : <p className="text-muted text-sm">Memuat data…</p>}
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-line safe-bottom z-30">
        <div className="grid grid-cols-5">
          {MAIN.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'text-accent font-medium' : 'text-muted'}`}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${moreActive ? 'text-accent font-medium' : 'text-muted'}`}>
            <MoreHorizontal size={20} /> Lainnya
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu lainnya">
        <div className="grid gap-2">
          {MORE.map(({ to, label, icon: Icon, hint }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex items-center gap-3 rounded-2xl border px-4 py-3 ${isActive ? 'border-accent bg-accent-soft' : 'border-line'}`}>
              <span className="size-10 rounded-xl bg-accent-soft text-accent grid place-items-center"><Icon size={19} /></span>
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </NavLink>
          ))}
        </div>
      </Sheet>
    </div>
  )
}
