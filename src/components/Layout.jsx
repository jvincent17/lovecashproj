import { NavLink, Outlet } from 'react-router-dom'
import { Sun, CalendarDays, Wallet, HandCoins, Settings as Cog, X } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'

const NAV = [
  { to: '/', label: 'Hari ini', icon: Sun, end: true },
  { to: '/minggu', label: 'Minggu', icon: CalendarDays },
  { to: '/bulan', label: 'Bulan', icon: Wallet },
  { to: '/hutang', label: 'Hutang', icon: HandCoins },
]

export default function Layout() {
  const { ready, error, clearError } = useData()

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-line px-4 py-6 sticky top-0 h-dvh">
        <div className="flex items-center gap-2 px-2 mb-8">
          <img src="/img/avatar.webp" alt="" className="size-9 rounded-full object-cover ring-2 ring-accent-soft" />
          <span className="font-semibold text-lg">Duit Kara</span>
        </div>
        <nav className="space-y-1 flex-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 h-11 text-sm transition ${
                  isActive ? 'bg-accent-soft text-accent font-medium' : 'text-muted hover:bg-soft'}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <figure className="mb-4">
          <img src="/img/couple.webp" alt="" className="w-full aspect-[4/5] object-cover rounded-2xl" />
          <figcaption className="text-xs text-muted text-center mt-2">Kita berdua 💗</figcaption>
        </figure>
        <NavLink to="/pengaturan"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 h-11 text-sm ${isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-soft'}`}>
          <Cog size={18} /> Pengaturan
        </NavLink>
      </aside>

      {/* Konten */}
      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <img src="/img/avatar.webp" alt="" className="size-8 rounded-full object-cover ring-2 ring-accent-soft" />
            <span className="font-semibold">Duit Kara</span>
          </div>
          <NavLink to="/pengaturan" className="size-10 grid place-items-center rounded-xl text-muted hover:bg-soft" aria-label="Pengaturan">
            <Cog size={20} />
          </NavLink>
        </header>

        <div className="mx-auto max-w-3xl px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-12">
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
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? 'text-accent font-medium' : 'text-muted'}`}>
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
