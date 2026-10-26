import { usePhotoUrl } from '../lib/photos.js'

/** Foto profil bulat; kalau belum ada foto, tampilkan huruf depan nama. */
export default function Avatar({ path, name, className = 'size-9', ring = true }) {
  const url = usePhotoUrl(path)
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  const base = `${className} rounded-full shrink-0 ${ring ? 'ring-2 ring-accent-soft' : ''}`
  if (url) return <img src={url} alt="" className={`${base} object-cover`} />
  return (
    <span className={`${base} grid place-items-center bg-gradient-to-br from-accent-2 to-accent text-white font-semibold`}>
      {initial}
    </span>
  )
}
