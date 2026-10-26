import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const BUCKET = 'photos'
const cache = new Map() // path -> { url, exp }

/** Perkecil foto di browser (maks `max` px) lalu jadikan WebP supaya ringan. */
export async function resizeImage(file, max = 720, quality = 0.82) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  return await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Gagal memproses foto'))), 'image/webp', quality))
}

/** Upload foto ke `<folder>/<prefix>-<waktu>.webp`, kembalikan path-nya. */
export async function uploadPhoto(folder, prefix, file, max) {
  const blob = await resizeImage(file, max)
  const path = `${folder}/${prefix}-${Date.now()}.webp`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/webp', upsert: true })
  if (error) throw error
  return path
}

export async function removePhoto(path) {
  if (!path) return
  cache.delete(path)
  await supabase.storage.from(BUCKET).remove([path])
}

/** URL sementara (berlaku 7 hari) untuk foto privat. */
export async function photoUrl(path) {
  if (!path) return null
  const hit = cache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error) return null
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 1000 * 60 * 60 * 24 * 6 })
  return data.signedUrl
}

export function usePhotoUrl(path) {
  const [url, setUrl] = useState(() => (path && cache.get(path)?.url) || null)
  useEffect(() => {
    let alive = true
    if (!path) { setUrl(null); return }
    photoUrl(path).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [path])
  return url
}

/** Sapaan sesuai jam lokal. */
export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h >= 4 && h < 11) return 'Selamat pagi'
  if (h >= 11 && h < 15) return 'Selamat siang'
  if (h >= 15 && h < 18) return 'Selamat sore'
  return 'Selamat malam'
}
