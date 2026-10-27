import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowRightLeft, ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { rupiah } from '../lib/format.js'
import { fmtShort } from '../lib/dates.js'
import Sheet from '../components/Sheet.jsx'
import AmountInput from '../components/AmountInput.jsx'
import WalletIcon from '../components/WalletIcon.jsx'
import WalletPicker, { UNLOCATED } from '../components/WalletPicker.jsx'
import { usePhotoUrl } from '../lib/photos.js'

export default function Locations() {
  const { wallets, balances, totalMoney, transfers, walletById } = useData()
  const [walletSheet, setWalletSheet] = useState({ open: false, wallet: null })
  const [transfer, setTransfer] = useState({ open: false, item: null, from: null, to: undefined })
  const unlocated = balances[''] || 0
  const located = totalMoney - unlocated
  const name = (id) => (id ? walletById[id]?.name ?? 'Lokasi terhapus' : UNLOCATED)

  return (
    <div className="space-y-4">
      <section className="hero p-5">
        <p className="text-sm text-muted">Total uang di semua lokasi</p>
        <p className={`text-3xl md:text-4xl font-semibold tabular ${totalMoney < 0 ? 'text-danger' : ''}`}>{rupiah(totalMoney)}</p>
        <div className="mt-4 h-2.5 rounded-full bg-ink/[.06] overflow-hidden flex">
          {totalMoney > 0 && wallets.map((w, i) => {
            const v = Math.max(0, balances[w.id] || 0)
            return v > 0 ? <div key={w.id} className="h-full" style={{ width: `${(v / totalMoney) * 100}%`, background: i % 2 ? 'var(--accent-2)' : 'var(--accent)' }} /> : null
          })}
        </div>
        <div className="flex justify-between text-xs text-muted mt-2">
          <span>Sudah dialokasikan {rupiah(located)}</span>
          <span>Belum {rupiah(unlocated)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={() => setWalletSheet({ open: true, wallet: null })} className="btn-ghost bg-card/70"><Plus size={16} /> Lokasi baru</button>
          <button onClick={() => setTransfer({ open: true, item: null, from: null, to: wallets[0]?.id })} className="btn-primary">
            <ArrowRightLeft size={16} /> Pindah dana
          </button>
        </div>
      </section>

      {/* Unlocated */}
      <section className={`card p-4 flex items-center gap-3 ${unlocated !== 0 ? 'border-dashed border-accent' : ''}`}>
        <WalletIcon wallet={null} className="size-11" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{UNLOCATED}</p>
          <p className="text-xs text-muted">
            {unlocated > 0 ? 'Belum ditentukan lokasinya — pindahkan ke GoPay, Cash, dll.' : unlocated < 0 ? 'Minus: ada pengeluaran tanpa lokasi melebihi dana tanpa lokasi.' : 'Semua dana sudah punya lokasi.'}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold tabular ${unlocated < 0 ? 'text-danger' : ''}`}>{rupiah(unlocated)}</p>
          {unlocated > 0 && wallets.length > 0 && (
            <button onClick={() => setTransfer({ open: true, item: null, from: null, to: wallets[0].id })} className="text-xs text-accent">Alokasikan →</button>
          )}
        </div>
      </section>

      {/* Lokasi */}
      {wallets.length === 0 ? (
        <div className="card p-6 text-center space-y-2">
          <p className="text-sm font-medium">Belum ada lokasi dana</p>
          <p className="text-xs text-muted">Contoh: GoPay, OVO, DANA, Cash, BCA, Tabungan.</p>
          <button onClick={() => setWalletSheet({ open: true, wallet: null })} className="btn-primary mt-2"><Plus size={16} /> Tambah lokasi</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {wallets.map((w) => {
            const bal = balances[w.id] || 0
            const pct = totalMoney > 0 ? Math.round((Math.max(0, bal) / totalMoney) * 100) : 0
            return (
              <button key={w.id} onClick={() => setWalletSheet({ open: true, wallet: w })}
                className="card p-4 text-left hover:border-accent transition">
                <div className="flex items-center justify-between">
                  <WalletIcon wallet={w} className="size-11" />
                  <span className="text-[11px] text-muted">{pct}%</span>
                </div>
                <p className="text-sm font-medium mt-3 truncate">{w.name}</p>
                <p className={`text-lg font-semibold tabular ${bal < 0 ? 'text-danger' : ''}`}>{rupiah(bal)}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Riwayat pindah dana */}
      <section className="card p-5">
        <h2 className="font-semibold mb-1">Riwayat pindah dana</h2>
        {transfers.length === 0 && <p className="text-sm text-muted py-4 text-center">Belum ada perpindahan dana.</p>}
        <ul className="divide-y divide-line">
          {transfers.slice(0, 30).map((t) => (
            <li key={t.id}>
              <button onClick={() => setTransfer({ open: true, item: t })} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="text-xs text-muted w-12 shrink-0">{fmtShort(t.date)}</span>
                <span className="flex-1 min-w-0 text-sm truncate flex items-center gap-1.5">
                  {name(t.from_wallet)} <ArrowRight size={13} className="text-muted shrink-0" /> {name(t.to_wallet)}
                </span>
                <span className="text-sm tabular">{rupiah(t.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted px-1">
        Saldo lokasi dihitung otomatis: dana masuk + pindahan masuk − pengeluaran − tagihan dibayar − pindahan keluar.
        Transaksi yang tidak dipilih lokasinya masuk ke {UNLOCATED}.
      </p>

      <WalletSheet open={walletSheet.open} wallet={walletSheet.wallet} onClose={() => setWalletSheet({ open: false, wallet: null })} />
      <TransferSheet {...transfer} onClose={() => setTransfer({ open: false, item: null })} />
    </div>
  )
}

const EMOJI = ['👛', '💵', '💳', '🏦', '📱', '💚', '💙', '💜', '🧡', '🐷', '🪙', '💰']

function WalletSheet({ open, wallet, onClose }) {
  const { saveWallet, deleteWallet, balances } = useData()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('👛')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [removeIcon, setRemoveIcon] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const currentUrl = usePhotoUrl(wallet?.icon_path)

  useEffect(() => {
    if (!open) return
    setName(wallet?.name ?? '')
    setEmoji(wallet?.emoji ?? '👛')
    setFile(null); setPreview(null); setRemoveIcon(false)
  }, [open, wallet])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const shownIcon = preview || (!removeIcon && currentUrl)
  const bal = wallet ? balances[wallet.id] || 0 : 0

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await saveWallet({ id: wallet?.id, name: name.trim(), emoji, iconFile: file, removeIcon: removeIcon && !file }, wallet)
      onClose()
    } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(`Hapus lokasi "${wallet.name}"? Saldonya (${rupiah(bal)}) dan semua transaksinya akan kembali ke ${UNLOCATED}.`)) return
    setBusy(true)
    try { await deleteWallet(wallet); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={wallet ? 'Ubah lokasi dana' : 'Lokasi dana baru'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => input.current?.click()}
            className="size-20 rounded-2xl border-2 border-dashed border-line hover:border-accent grid place-items-center overflow-hidden shrink-0">
            {shownIcon
              ? <img src={shownIcon} alt="" className="w-full h-full object-cover" />
              : <span className="text-3xl">{emoji}</span>}
          </button>
          <input ref={input} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); setRemoveIcon(false) } }} />
          <div className="flex flex-col gap-2 items-start">
            <button type="button" onClick={() => input.current?.click()} className="btn-ghost h-9 px-3"><ImagePlus size={15} /> Unggah logo</button>
            {shownIcon && (
              <button type="button" onClick={() => { setFile(null); setPreview(null); setRemoveIcon(true) }} className="text-xs text-danger">Pakai emoji saja</button>
            )}
          </div>
        </div>
        {!shownIcon && (
          <div className="grid grid-cols-6 gap-1">
            {EMOJI.map((em) => (
              <button type="button" key={em} onClick={() => setEmoji(em)}
                className={`aspect-square rounded-lg text-xl ${emoji === em ? 'bg-accent-soft ring-1 ring-accent' : 'hover:bg-soft'}`}>{em}</button>
            ))}
          </div>
        )}
        <label className="block"><span className="label">Nama lokasi</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!wallet} placeholder="cth. GoPay, Cash, BCA" />
        </label>
        {wallet && <p className="text-sm">Saldo saat ini: <b className="tabular">{rupiah(bal)}</b></p>}
        <div className="flex gap-2">
          {wallet && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || !name.trim()} className="btn-primary flex-1">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </Sheet>
  )
}

function TransferSheet({ open, item, from: defFrom, to: defTo, onClose }) {
  const { saveTransfer, deleteTransfer, balances, today } = useData()
  const [from, setFrom] = useState(null)
  const [to, setTo] = useState(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFrom(item ? item.from_wallet : defFrom ?? null)
    setTo(item ? item.to_wallet : defTo ?? null)
    setAmount(item ? Number(item.amount) : 0)
    setDate(item?.date ?? today)
    setNote(item?.note ?? '')
  }, [open, item, defFrom, defTo, today])

  const same = (from ?? null) === (to ?? null)
  const available = balances[from ?? ''] || 0

  const submit = async (e) => {
    e.preventDefault()
    if (same || !amount) return
    setBusy(true)
    try { await saveTransfer({ id: item?.id, from_wallet: from, to_wallet: to, amount, date, note: note.trim() || null }); onClose() } catch { /* */ } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await deleteTransfer(item.id); onClose() } catch { /* */ } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Ubah pindah dana' : 'Pindah dana'}>
      <form onSubmit={submit} className="space-y-4">
        <WalletPicker label="Dari" value={from} onChange={setFrom} />
        <WalletPicker label="Ke" value={to} onChange={setTo} />
        <div>
          <span className="label">Nominal</span>
          <AmountInput big value={amount} onChange={setAmount} />
          <div className="flex justify-between text-xs mt-1.5">
            <span className={amount > available && !item ? 'text-danger' : 'text-muted'}>Tersedia {rupiah(available)}</span>
            {available > 0 && <button type="button" onClick={() => setAmount(available)} className="text-accent">Pindahkan semua</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Tanggal</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label><span className="label">Catatan</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" />
          </label>
        </div>
        {same && <p className="text-xs text-danger">Lokasi asal dan tujuan tidak boleh sama.</p>}
        <div className="flex gap-2">
          {item && <button type="button" disabled={busy} onClick={remove} className="btn-danger"><Trash2 size={16} /></button>}
          <button disabled={busy || same || !amount} className="btn-primary flex-1">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </form>
    </Sheet>
  )
}
