import { useEffect, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Plus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { fmtShort } from '../lib/dates.js'
import Sheet from './Sheet.jsx'
import AmountInput from './AmountInput.jsx'

const EMOJI = ['🌴', '🍕', '🛟', '🎁', '🎮', '✈️', '💄', '🍰', '🐱', '📚', '💍', '🏥']

export const MOVE_LABEL = {
  fund: 'Isi dari dana bulan ini',
  from_week: 'Tarik dari jatah minggu',
  to_day: 'Pindah ke jatah harian',
}

/** Kartu ringkas satu kantong */
export function PocketCard({ k, onClick }) {
  const used = k.perOut
  const filled = k.perIn
  return (
    <button onClick={onClick} className="card p-4 text-left hover:border-accent transition">
      <div className="flex items-center justify-between">
        <span className="size-10 rounded-xl bg-accent-soft grid place-items-center text-lg">{k.icon}</span>
        {k.carry_over && <span className="text-[10px] px-1.5 py-0.5 rounded bg-soft text-muted">numpuk</span>}
      </div>
      <p className="text-sm font-medium mt-3 truncate">{k.name}</p>
      <p className={`text-lg font-semibold tabular ${k.balance < 0 ? 'text-danger' : ''}`}>{rupiah(k.balance)}</p>
      <p className="text-[11px] text-muted mt-0.5 money truncate">
        periode ini +{rupiah(filled)} · terpakai {rupiah(used)}
      </p>
    </button>
  )
}

/** Buat / ubah kantong */
export function PocketFormSheet({ open, pocket, onClose }) {
  const { savePocket, deletePocket } = useData()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🎁')
  const [carry, setCarry] = useState(false)
  const [def, setDef] = useState(0)
  const [fundNow, setFundNow] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(pocket?.name ?? '')
    setIcon(pocket?.icon ?? '🎁')
    setCarry(pocket?.carry_over ?? false)
    setDef(pocket ? Number(pocket.default_amount) : 0)
    setFundNow(0)
  }, [open, pocket])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await savePocket({ id: pocket?.id, name: name.trim(), icon, carry_over: carry, default_amount: def, fundNow: pocket ? 0 : fundNow })
      onClose()
    } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`Hapus kantong "${pocket.name}"? Pengeluaran dari kantong ini akan dihitung sebagai pengeluaran harian biasa.`)) return
    setBusy(true)
    try { await deletePocket(pocket.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={pocket ? 'Ubah kantong' : 'Kantong baru'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-6 gap-1">
          {EMOJI.map((em) => (
            <button type="button" key={em} onClick={() => setIcon(em)}
              className={`aspect-square rounded-lg text-xl ${icon === em ? 'bg-accent-soft ring-1 ring-accent' : 'hover:bg-soft'}`}>{em}</button>
          ))}
        </div>
        <label className="block"><span className="label">Nama kantong</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!pocket} placeholder="cth. Healing, Cheating, Dana Darurat" />
        </label>
        <div className="grid grid-cols-2 gap-1 p-1 bg-soft rounded-xl">
          {[[false, 'Reset tiap periode'], [true, 'Numpuk terus']].map(([v, l]) => (
            <button type="button" key={l} onClick={() => setCarry(v)}
              className={`h-9 rounded-lg text-sm ${carry === v ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        <p className="text-xs text-muted -mt-2">
          {carry
            ? 'Sisa kantong disimpan & bertambah tiap periode (cocok untuk Dana Darurat). Tidak ikut "Sisa bulan lalu".'
            : 'Sisa kantong di akhir periode ikut terbawa lewat "Sisa bulan lalu", lalu kantong mulai dari nol lagi (cocok untuk Healing/Cheating).'}
        </p>
        <div>
          <span className="label">Isi otomatis tiap periode baru (opsional)</span>
          <AmountInput value={def} onChange={setDef} placeholder="0" />
        </div>
        {!pocket && (
          <div>
            <span className="label">Isi sekarang dari dana bulan ini (opsional)</span>
            <AmountInput value={fundNow} onChange={setFundNow} placeholder="0" />
          </div>
        )}
        <div className="flex gap-2">
          {pocket && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !name.trim()} className="btn-primary flex-1">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </Sheet>
  )
}

/**
 * Isi / pindah ke jatah / tarik dari minggu untuk satu kantong.
 * initialKind & initialDate opsional (mis. dari halaman Minggu).
 */
export function PocketMoveSheet({ open, pocket: initialPocket, initialKind = 'fund', initialDate, onClose, onEdit }) {
  const { pockets, pocketMoves, addPocketMove, deletePocketMove, today, period, plan, status } = useData()
  const [pocketId, setPocketId] = useState(null)
  const [kind, setKind] = useState(initialKind)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)

  useEffect(() => {
    if (!open) return
    setPocketId(initialPocket?.id ?? pockets[0]?.id ?? null)
    setKind(initialKind)
    setAmount(0)
    const d = initialDate ?? today
    setDate(period && (d < period.start_date || d > period.end_date) ? period.start_date : d)
    // sengaja hanya saat sheet dibuka, supaya input tidak ter-reset oleh sinkron realtime
  }, [open, initialPocket?.id, initialKind, initialDate]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null
  const k = pockets.find((x) => x.id === pocketId)
  const week = plan?.weeks.find((w) => w.start <= date && w.end >= date)
  const weekLeft = week ? week.days.filter((d) => d.date >= date).reduce((a, d) => a + (status[d.date]?.alloc ?? d.amount) - (status[d.date]?.spent ?? 0), 0) : 0
  const moves = pocketMoves.filter((m) => m.pocket_id === pocketId)

  const submit = (e) => {
    e.preventDefault()
    if (!amount || !k) return
    addPocketMove({ pocket_id: k.id, kind, amount, date })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Kantong khusus">
      <form onSubmit={submit} className="space-y-4">
        {pockets.length === 0 ? (
          <p className="text-sm text-muted">Belum ada kantong. Buat dulu di menu Bulan → Kantong khusus.</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
              {pockets.map((x) => (
                <button type="button" key={x.id} onClick={() => setPocketId(x.id)}
                  className={`shrink-0 flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-left ${pocketId === x.id ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                  <span className="text-lg">{x.icon}</span>
                  <span className="leading-tight">
                    <span className={`block text-xs ${pocketId === x.id ? 'text-accent font-medium' : ''}`}>{x.name}</span>
                    <span className="block text-[10px] text-muted tabular">{rupiah(x.balance)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-1.5">
              {Object.entries(MOVE_LABEL).map(([key, label]) => (
                <button type="button" key={key} onClick={() => setKind(key)}
                  className={`flex items-center gap-2 rounded-xl border px-3 h-10 text-sm text-left ${kind === key ? 'border-accent bg-accent-soft text-accent font-medium' : 'border-line'}`}>
                  {key === 'to_day' ? <ArrowUpFromLine size={15} /> : <ArrowDownToLine size={15} />} {label}
                </button>
              ))}
            </div>

            <div>
              <span className="label">Nominal</span>
              <AmountInput big value={amount} onChange={setAmount} autoFocus />
              <p className="text-xs text-muted mt-1.5 money">
                {kind === 'fund' && 'Mengurangi budget harian periode ini (dibagi ulang ke semua hari).'}
                {kind === 'from_week' && `Jatah hari ${fmtShort(date)} s/d akhir minggu dipotong. Sisa jatah minggu itu ${rupiah(weekLeft)}.`}
                {kind === 'to_day' && `Menambah jatah tanggal ${fmtShort(date)}. Saldo kantong ${rupiah(k?.balance ?? 0)}.`}
              </p>
            </div>
            {kind !== 'fund' && (
              <label className="block"><span className="label">{kind === 'to_day' ? 'Masuk ke jatah tanggal' : 'Mulai tanggal'}</span>
                <input type="date" className="input" value={date} min={period?.start_date} max={period?.end_date} onChange={(e) => setDate(e.target.value)} required />
              </label>
            )}
            <button disabled={!amount || !k} className="btn-primary w-full">Simpan</button>

            {moves.length > 0 && (
              <div>
                <p className="label">Riwayat kantong ini (periode ini)</p>
                <ul className="divide-y divide-line">
                  {moves.slice().reverse().map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="text-xs text-muted w-12 shrink-0">{fmtShort(m.date)}</span>
                      <span className="flex-1 truncate">{MOVE_LABEL[m.kind]}</span>
                      <span className={`tabular ${m.kind === 'to_day' ? 'text-muted' : 'text-accent'}`}>{m.kind === 'to_day' ? '−' : '+'}{rupiah(m.amount)}</span>
                      <button type="button" onClick={() => deletePocketMove(m.id)} className="text-muted hover:text-danger" aria-label="Hapus"><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {k && onEdit && <button type="button" onClick={() => onEdit(k)} className="text-xs text-accent">Ubah pengaturan kantong {k.name}</button>}
          </>
        )}
      </form>
    </Sheet>
  )
}

/** Bagian "Kantong khusus" di menu Bulan */
export function PocketSection() {
  const { pockets, plan } = useData()
  const [form, setForm] = useState({ open: false, pocket: null })
  const [move, setMove] = useState({ open: false, pocket: null })
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><PiggyBank size={17} className="text-accent" /> Kantong khusus</h2>
          <p className="text-xs text-muted">Healing, cheating, dana darurat — di luar jatah harian.</p>
        </div>
        <button onClick={() => setForm({ open: true, pocket: null })} className="btn-ghost h-9 px-3 shrink-0"><Plus size={15} /> Kantong</button>
      </div>
      {pockets.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">Belum ada kantong.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            {pockets.map((k) => <PocketCard key={k.id} k={k} onClick={() => setMove({ open: true, pocket: k })} />)}
          </div>
          {plan?.pocketFund > 0 && (
            <p className="text-xs text-muted mt-3 money">Disisihkan dari dana bulan ini: {rupiah(plan.pocketFund)}</p>
          )}
        </>
      )}
      <PocketFormSheet open={form.open} pocket={form.pocket} onClose={() => setForm({ open: false, pocket: null })} />
      <PocketMoveSheet open={move.open} pocket={move.pocket} onClose={() => setMove({ open: false, pocket: null })}
        onEdit={(k) => { setMove({ open: false, pocket: null }); setForm({ open: true, pocket: k }) }} />
    </section>
  )
}

/** Pilih sumber dana saat mencatat pengeluaran: jatah harian atau kantong */
export function SourcePicker({ value, onChange }) {
  const { pockets } = useData()
  if (!pockets.length) return null
  const opts = [{ id: null, name: 'Jatah harian', icon: '📅' }, ...pockets]
  return (
    <div>
      <span className="label">Pakai dari</span>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {opts.map((o) => {
          const active = (value ?? null) === o.id
          return (
            <button type="button" key={o.id ?? 'daily'} onClick={() => onChange(o.id)}
              className={`shrink-0 flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-left ${active ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'}`}>
              <span>{o.icon}</span>
              <span className="leading-tight">
                <span className={`block text-xs ${active ? 'text-accent font-medium' : ''}`}>{o.name}</span>
                {o.id && <span className="block text-[10px] text-muted tabular">{rupiah(o.balance)}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
