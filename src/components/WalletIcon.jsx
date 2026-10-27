import { CircleDashed } from 'lucide-react'
import { usePhotoUrl } from '../lib/photos.js'

/** Ikon lokasi dana: logo yang diunggah, emoji, atau ikon "Unlocated" kalau wallet = null. */
export default function WalletIcon({ wallet, className = 'size-10', rounded = 'rounded-xl' }) {
  const url = usePhotoUrl(wallet?.icon_path)
  const base = `${className} ${rounded} shrink-0 grid place-items-center overflow-hidden`
  if (!wallet) return <span className={`${base} bg-soft text-muted`}><CircleDashed size={18} /></span>
  if (url) return <img src={url} alt="" className={`${base} object-cover bg-card border border-line`} />
  return <span className={`${base} bg-accent-soft text-lg`}>{wallet.emoji || '👛'}</span>
}
