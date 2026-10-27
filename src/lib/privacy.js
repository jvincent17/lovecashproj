import { useState } from 'react'

// Mode privasi: sembunyikan semua nominal. Disimpan per perangkat.
const KEY = 'duitkara-privacy'

export function readPrivacy() {
  try { return localStorage.getItem(KEY) === 'on' } catch { return false }
}

export function applyPrivacy(on) {
  document.documentElement.dataset.privacy = on ? 'on' : 'off'
}

export function usePrivacy() {
  const [on, setOn] = useState(readPrivacy)
  const toggle = () => {
    const next = !on
    setOn(next)
    applyPrivacy(next)
    try { localStorage.setItem(KEY, next ? 'on' : 'off') } catch { /* */ }
  }
  return [on, toggle]
}
