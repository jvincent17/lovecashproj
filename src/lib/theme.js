import { useState } from 'react'

// Tema disimpan per perangkat (localStorage). Tidak mengikuti setelan browser.
const KEY = 'duitkara-theme'
export const PALETTES = { pink: 'Pink', blue: 'Biru' }
export const MODES = { light: 'Terang', dark: 'Gelap' }

export function readTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '{}')
    return { palette: PALETTES[t.palette] ? t.palette : 'pink', mode: MODES[t.mode] ? t.mode : 'light' }
  } catch {
    return { palette: 'pink', mode: 'light' }
  }
}

export function applyTheme({ palette, mode }) {
  const root = document.documentElement
  root.dataset.palette = palette
  root.dataset.mode = mode
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#fdf6f9')
}

export function useTheme() {
  const [theme, setThemeState] = useState(readTheme)
  const setTheme = (patch) => {
    const next = { ...theme, ...patch }
    setThemeState(next)
    applyTheme(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* mode privat: abaikan */ }
  }
  return [theme, setTheme]
}
