// Semua tanggal disimpan sebagai string lokal 'YYYY-MM-DD' supaya aman dari masalah zona waktu.

const pad = (n) => String(n).padStart(2, '0')

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = () => toISO(new Date())

export const addDays = (iso, n) => {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000)

export const rangeDays = (start, end) => {
  const out = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()

/** Tanggal gajian di bulan tertentu (dibatasi ke akhir bulan, mis. 31 -> 30/28). */
const paydayIn = (y, m, payday) => toISO(new Date(y, m, Math.min(payday, daysInMonth(y, m))))

/** Periode gaji yang memuat tanggal `iso` untuk tanggal gajian `payday`. */
export function cycleFor(iso, payday) {
  const d = fromISO(iso)
  let y = d.getFullYear()
  let m = d.getMonth()
  let start = paydayIn(y, m, payday)
  if (iso < start) {
    m -= 1
    if (m < 0) { m = 11; y -= 1 }
    start = paydayIn(y, m, payday)
  }
  let ny = y, nm = m + 1
  if (nm > 11) { nm = 0; ny += 1 }
  const end = addDays(paydayIn(ny, nm, payday), -1)
  return { start, end }
}

const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const DAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const fmtDay = (iso) => DAY[fromISO(iso).getDay()]
export const fmtShort = (iso) => { const d = fromISO(iso); return `${d.getDate()} ${MON[d.getMonth()]}` }
export const fmtLong = (iso) => { const d = fromISO(iso); return `${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` }
export const fmtRange = (a, b) => `${fmtShort(a)} – ${fmtShort(b)}`
