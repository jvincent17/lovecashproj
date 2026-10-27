import { useData } from '../context/DataContext.jsx'
import { rupiahShort } from '../lib/format.js'
import WalletIcon from './WalletIcon.jsx'

export const UNLOCATED = 'Unlocated Money'

/** Pilih lokasi dana. value: wallet id, atau null untuk Unlocated Money. */
export default function WalletPicker({ value, onChange, label = 'Lokasi dana', showBalance = true }) {
  const { wallets, balances } = useData()
  const options = [{ id: null, name: UNLOCATED, wallet: null }, ...wallets.map((w) => ({ id: w.id, name: w.name, wallet: w }))]
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {options.map((o) => {
          const active = (value ?? null) === o.id
          return (
            <button type="button" key={o.id ?? 'none'} onClick={() => onChange(o.id)}
              className={`shrink-0 flex items-center gap-2 rounded-2xl border pl-1.5 pr-3 py-1.5 text-left transition
                ${active ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent'}`}>
              <WalletIcon wallet={o.wallet} className="size-7" rounded="rounded-lg" />
              <span className="leading-tight">
                <span className={`block text-xs ${active ? 'text-accent font-medium' : ''}`}>{o.name}</span>
                {showBalance && <span className="block text-[10px] text-muted tabular">Rp {rupiahShort(balances[o.id ?? ''] || 0)}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
