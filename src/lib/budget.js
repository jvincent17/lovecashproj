import { rangeDays, addDays } from './dates.js'

/**
 * Bagi periode menjadi minggu per 7 hari mulai tanggal gajian.
 * Sisa hari ≤ 3 di akhir digabung ke minggu terakhir.
 */
export function buildWeeks(start, end) {
  const days = rangeDays(start, end)
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  if (weeks.length > 1 && weeks[weeks.length - 1].length <= 3) {
    const last = weeks.pop()
    weeks[weeks.length - 1].push(...last)
  }
  return weeks.map((d, index) => ({ index, start: d[0], end: d[d.length - 1], days: d }))
}

/**
 * Bagi `total` ke beberapa unit. Unit yang punya override memakai nilai override,
 * sisanya dibagi proporsional sesuai bobot (jumlah hari). Hasil dibulatkan ke rupiah
 * dan selisih pembulatan diberikan ke unit bebas terakhir.
 */
export function allocate(units, total, overrides = {}) {
  const out = {}
  let fixed = 0
  const free = []
  for (const u of units) {
    if (overrides[u.key] != null) { out[u.key] = Number(overrides[u.key]); fixed += out[u.key] }
    else free.push(u)
  }
  const rest = Math.max(0, total - fixed)
  const W = free.reduce((s, u) => s + u.weight, 0)
  // Metode sisa terbesar: tiap unit dapat floor(bagian), sisa rupiah dibagikan ke pecahan terbesar
  const exact = free.map((u) => rest * (W > 0 ? u.weight / W : 1 / free.length))
  const base = exact.map((x) => Math.floor(x + 1e-6))
  let left = rest - base.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0 && free.length; k = (k + 1) % free.length, left--) base[order[k][1]] += 1
  free.forEach((u, i) => { out[u.key] = base[i] })
  return { amounts: out, overAllocated: fixed > total ? fixed - total : 0 }
}

/**
 * Bobot dana per hari.
 * Tagihan dipotong dulu dari pemasukan paling awal. Sisa setiap pemasukan dibagi rata
 * ke hari-hari mulai TANGGAL MASUKNYA sampai akhir periode — jadi dana tambahan di
 * tengah bulan hanya menambah jatah hari itu dan seterusnya.
 */
export function dayWeights(period, incomes, billsTotal) {
  const days = rangeDays(period.start_date, period.end_date)
  const w = Object.fromEntries(days.map((d) => [d, 0]))
  const clamp = (d) => (!d || d < period.start_date ? period.start_date : d > period.end_date ? period.end_date : d)
  const list = incomes
    .map((i) => ({ amount: Number(i.amount) || 0, date: clamp(i.date) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let billsLeft = billsTotal
  for (const inc of list) {
    const take = Math.min(inc.amount, billsLeft)
    billsLeft -= take
    const net = inc.amount - take
    if (net <= 0) continue
    const span = days.filter((d) => d >= inc.date)
    for (const d of span) w[d] += net / span.length
  }
  return w
}

/**
 * Susun rencana budget lengkap untuk satu periode.
 * incomes: dana masuk periode ini; bills: tagihan yang jatuh tempo di periode ini.
 * Budget fleksibel = total dana masuk − semua tagihan (dicentang maupun belum).
 */
export function computePlan({ period, incomes = [], bills = [], overrides = [] }) {
  const income = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const billsTotal = bills.reduce((s, b) => s + Number(b.amount), 0)
  const billsPaid = bills.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0)
  const flexible = Math.max(0, income - billsTotal)
  const w = dayWeights(period, incomes, billsTotal)

  const weekOv = {}
  const dayOv = {}
  for (const o of overrides) {
    if (o.week_index != null) weekOv[o.week_index] = Number(o.amount)
    else if (o.day) dayOv[o.day] = Number(o.amount)
  }

  const weeks = buildWeeks(period.start_date, period.end_date)
  const wAlloc = allocate(weeks.map((wk) => ({ key: wk.index, weight: wk.days.reduce((a, d) => a + w[d], 0) })), flexible, weekOv)

  const dayAlloc = {}
  const outWeeks = weeks.map((wk) => {
    const amount = wAlloc.amounts[wk.index]
    const dOv = {}
    wk.days.forEach((d) => { if (dayOv[d] != null) dOv[d] = dayOv[d] })
    const dA = allocate(wk.days.map((d) => ({ key: d, weight: w[d] })), amount, dOv)
    wk.days.forEach((d) => { dayAlloc[d] = dA.amounts[d] })
    return {
      ...wk,
      amount,
      isCustom: weekOv[wk.index] != null,
      overAllocated: dA.overAllocated,
      days: wk.days.map((d) => ({ date: d, amount: dA.amounts[d], isCustom: dayOv[d] != null })),
    }
  })

  return {
    income,
    billsTotal,
    billsPaid,
    flexible,
    overAllocated: wAlloc.overAllocated,
    weeks: outWeeks,
    dayAlloc,
  }
}

/**
 * Hitung status setiap hari.
 * - Sisa (plus) selalu dibawa penuh ke hari berikutnya.
 * - Minus, tergantung mode:
 *   'next'   → dibawa penuh ke hari berikutnya (muncul di "Dari kemarin").
 *   'spread' → dibagi rata ke sisa hari di minggu yang sama (jatah hari-hari itu dikurangi).
 *              Kalau sudah hari terakhir minggu itu, dibawa ke hari berikutnya.
 * spentByDate: { 'YYYY-MM-DD': total }
 */
export function dailyStatus(plan, spentByDate, start, end, mode = 'next') {
  const out = {}
  const adj = {} // potongan jatah dari minus hari sebelumnya (mode spread)
  const weekOf = {}
  for (const w of plan.weeks || []) for (const d of w.days) weekOf[d.date ?? d] = w
  let carry = 0
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const baseAlloc = plan.dayAlloc[d] || 0
    const adjust = adj[d] || 0
    const alloc = baseAlloc + adjust
    const available = alloc + carry
    const spent = spentByDate[d] || 0
    const remaining = available - spent
    out[d] = { alloc, baseAlloc, adjust, carryIn: carry, available, spent, remaining }

    carry = remaining
    if (mode === 'spread' && remaining < 0) {
      const w = weekOf[d]
      const later = w ? w.days.map((x) => x.date ?? x).filter((x) => x > d && x <= end) : []
      if (later.length) {
        // bagi rata; sisa pembulatan ke hari-hari pertama
        const deficit = -remaining
        const base = Math.floor(deficit / later.length)
        let extra = deficit - base * later.length
        for (const x of later) {
          const cut = base + (extra > 0 ? 1 : 0)
          if (extra > 0) extra--
          adj[x] = (adj[x] || 0) - cut
        }
        carry = 0
      }
    }
  }
  return out
}

export function sumBy(list, keyFn, valFn = (x) => Number(x.amount)) {
  const m = {}
  for (const x of list) { const k = keyFn(x); m[k] = (m[k] || 0) + valFn(x) }
  return m
}
