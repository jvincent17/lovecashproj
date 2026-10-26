const nf = new Intl.NumberFormat('id-ID')

export const rupiah = (n) => {
  const v = Math.round(Number(n) || 0)
  return (v < 0 ? '-Rp ' : 'Rp ') + nf.format(Math.abs(v))
}

/** Ringkas: 1.250.000 -> 1,25 jt ; 75.000 -> 75 rb */
export const rupiahShort = (n) => {
  const v = Math.round(Number(n) || 0)
  const a = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
  if (a >= 1_000) return `${sign}${(a / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb`
  return `${sign}${a}`
}

/** "1.250.000" -> 1250000 */
export const parseAmount = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0

export const formatAmountInput = (s) => {
  const n = parseAmount(s)
  return n ? nf.format(n) : ''
}
