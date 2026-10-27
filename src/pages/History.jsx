import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Search, SlidersHorizontal, X } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { supabase } from '../lib/supabase.js'
import { rupiah, rupiahShort } from '../lib/format.js'
import { addDays, fmtLong } from '../lib/dates.js'
import { exportRows } from '../lib/exportXlsx.js'
import ExpenseSheet from '../components/ExpenseSheet.jsx'
import WalletIcon from '../components/WalletIcon.jsx'

const ALL = '__all'

export default function History() {
  const { period, today, categories, catById, wallets, walletById, members, memberName, expenses: ctxExpenses } = useData()
  const [from, setFrom] = useState(period?.start_date ?? addDays(today, -30))
  const [to, setTo] = useState(period?.end_date && period.end_date < today ? period.end_date : today)
  const [type, setType] = useState('all')
  const [cat, setCat] = useState(ALL)
  const [wallet, setWallet] = useState(ALL)
  const [who, setWho] = useState(ALL)
  const [q, setQ] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [edit, setEdit] = useState({ open: false, expense: null })
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!period) return
    setLoading(true)
    const cf = period.cashflow_id
    const [e, i] = await Promise.all([
      supabase.from('expenses').select('*').eq('cashflow_id', cf).gte('date', from).lte('date', to),
      supabase.from('incomes').select('*').eq('cashflow_id', cf).gte('date', from).lte('date', to),
    ])
    setRows([
      ...(e.data || []).map((x) => ({ ...x, kind: 'expense' })),
      ...(i.data || []).map((x) => ({ ...x, kind: 'income' })),
    ])
    setLoading(false)
  }, [period, from, to])

  // muat ulang juga saat data di context berubah (input baru / realtime pasangan)
  useEffect(() => { load() }, [load, ctxExpenses])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows
      .filter((r) => type === 'all' || r.kind === type)
      .filter((r) => cat === ALL || (r.kind === 'expense' && (r.category_id ?? 'none') === cat))
      .filter((r) => wallet === ALL || (r.wallet_id ?? 'none') === wallet)
      .filter((r) => who === ALL || r.created_by === who)
      .filter((r) => {
        if (!term) return true
        const text = r.kind === 'income' ? r.name : `${r.note ?? ''} ${catById[r.category_id]?.name ?? ''}`
        return text.toLowerCase().includes(term) || String(r.amount).includes(term.replace(/\D/g, '') || '§')
      })
      .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1))
  }, [rows, type, cat, wallet, who, q, catById])

  const outTotal = filtered.filter((r) => r.kind === 'expense').reduce((a, r) => a + Number(r.amount), 0)
  const inTotal = filtered.filter((r) => r.kind === 'income').reduce((a, r) => a + Number(r.amount), 0)
  const groups = useMemo(() => {
    const m = new Map()
    for (const r of filtered) { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r) }
    return [...m.entries()]
  }, [filtered])
  const activeFilters = [type !== 'all', cat !== ALL, wallet !== ALL, who !== ALL].filter(Boolean).length

  const doExport = async () => {
    setExporting(true)
    try { await exportRows(filtered, { catById, walletById, memberName }, `duit-kara_riwayat_${from}_${to}.xlsx`) } finally { setExporting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Riwayat</h1>
        <button disabled={exporting || !filtered.length} onClick={doExport} className="btn-ghost h-9 px-3 text-sm">
          <Download size={15} /> {exporting ? 'Menyiapkan…' : 'Excel'}
        </button>
      </div>

      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 input">
          <Search size={16} className="text-muted shrink-0" />
          <input className="flex-1 bg-transparent outline-none" placeholder="Cari catatan, kategori, nominal…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ('')} aria-label="Hapus pencarian"><X size={15} className="text-muted" /></button>}
        </label>
        <button onClick={() => setShowFilter((v) => !v)} className={`btn-ghost px-3 relative ${showFilter ? 'bg-accent-soft text-accent' : ''}`} aria-label="Filter">
          <SlidersHorizontal size={17} />
          {activeFilters > 0 && <span className="absolute -top-1 -right-1 size-5 rounded-full bg-accent text-on-accent text-[10px] grid place-items-center">{activeFilters}</span>}
        </button>
      </div>

      {showFilter && (
        <section className="card p-4 grid grid-cols-2 gap-3">
          <label><span className="label">Dari</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">Sampai</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          <label><span className="label">Jenis</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Semua</option><option value="expense">Pengeluaran</option><option value="income">Dana masuk</option>
            </select>
          </label>
          <label><span className="label">Kategori</span>
            <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value={ALL}>Semua kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              <option value="none">Tanpa kategori</option>
            </select>
          </label>
          <label><span className="label">Lokasi</span>
            <select className="input" value={wallet} onChange={(e) => setWallet(e.target.value)}>
              <option value={ALL}>Semua lokasi</option>
              <option value="none">Unlocated Money</option>
              {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          {members.length > 1 ? (
            <label><span className="label">Diinput oleh</span>
              <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value={ALL}>Semua</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{memberName(m.user_id)}</option>)}
              </select>
            </label>
          ) : <span />}
          {activeFilters > 0 && (
            <button onClick={() => { setType('all'); setCat(ALL); setWallet(ALL); setWho(ALL) }} className="col-span-2 text-xs text-accent text-left">Reset filter</button>
          )}
        </section>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3.5"><p className="text-[11px] text-muted">Transaksi</p><p className="font-semibold">{filtered.length}</p></div>
        <div className="card p-3.5"><p className="text-[11px] text-muted">Keluar</p><p className="font-semibold tabular text-sm whitespace-nowrap">Rp {rupiahShort(outTotal)}</p></div>
        <div className="card p-3.5"><p className="text-[11px] text-muted">Masuk</p><p className="font-semibold tabular text-sm text-accent whitespace-nowrap">Rp {rupiahShort(inTotal)}</p></div>
      </div>

      {loading && !rows.length && <p className="text-sm text-muted">Memuat…</p>}
      {!loading && groups.length === 0 && <p className="text-sm text-muted text-center py-8">Tidak ada transaksi yang cocok.</p>}

      {groups.map(([date, items]) => {
        const out = items.filter((r) => r.kind === 'expense').reduce((a, r) => a + Number(r.amount), 0)
        return (
          <section key={date} className="card px-4 py-2">
            <div className="flex justify-between text-xs text-muted py-2 border-b border-line">
              <span>{fmtLong(date)}</span>
              {out > 0 && <span className="tabular">-{rupiah(out)}</span>}
            </div>
            <ul className="divide-y divide-line">
              {items.map((r) => {
                const c = catById[r.category_id]
                const w = r.wallet_id ? walletById[r.wallet_id] : null
                const isIn = r.kind === 'income'
                return (
                  <li key={`${r.kind}${r.id}`}>
                    <button disabled={isIn} onClick={() => setEdit({ open: true, expense: r })}
                      className="w-full flex items-center gap-3 py-2.5 text-left disabled:cursor-default">
                      <span className="size-9 rounded-xl bg-soft grid place-items-center">{isIn ? '＋' : c?.icon ?? '📦'}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm truncate">{isIn ? r.name : r.note || c?.name || 'Tanpa kategori'}</span>
                        <span className="flex items-center gap-1 text-xs text-muted truncate">
                          <WalletIcon wallet={w} className="size-3.5" rounded="rounded" />
                          {w?.name ?? 'Unlocated'}{!isIn && c ? ` · ${c.name}` : ''}{members.length > 1 && r.created_by ? ` · ${memberName(r.created_by)}` : ''}
                        </span>
                      </span>
                      <span className={`text-sm tabular font-medium ${isIn ? 'text-accent' : ''}`}>{isIn ? '+' : '-'}{rupiah(r.amount)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      <ExpenseSheet open={edit.open} expense={edit.expense} onClose={() => { setEdit({ open: false, expense: null }); load() }} />
    </div>
  )
}
