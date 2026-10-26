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
  let used = 0
  free.forEach((u, i) => {
    const v = i === free.length - 1 ? rest - used : Math.floor((rest * u.weight) / W)
    out[u.key] = v
    used += v
  })
  return { amounts: out, overAllocated: fixed > total ? fixed - total : 0 }
}

/**
 * Susun rencana budget lengkap untuk satu periode.
 * incomes: pemasukan periode ini; bills: tagihan yang jatuh tempo di periode ini.
 * Budget fleksibel = total pemasukan − semua tagihan (dicentang maupun belum).
 */
export function computePlan({ period, incomes = [], bills = [], overrides = [] }) {
  const income = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const billsTotal = bills.reduce((s, b) => s + Number(b.amount), 0)
  const billsPaid = bills.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0)
  const flexible = Math.max(0, income - billsTotal)

  const weekOv = {}
  const dayOv = {}
  for (const o of overrides) {
    if (o.week_index != null) weekOv[o.week_index] = Number(o.amount)
    else if (o.day) dayOv[o.day] = Number(o.amount)
  }

  const weeks = buildWeeks(period.start_date, period.end_date)
  const wAlloc = allocate(weeks.map((w) => ({ key: w.index, weight: w.days.length })), flexible, weekOv)

  const dayAlloc = {}
  const outWeeks = weeks.map((w) => {
    const amount = wAlloc.amounts[w.index]
    const dOv = {}
    w.days.forEach((d) => { if (dayOv[d] != null) dOv[d] = dayOv[d] })
    const dA = allocate(w.days.map((d) => ({ key: d, weight: 1 })), amount, dOv)
    w.days.forEach((d) => { dayAlloc[d] = dA.amounts[d] })
    return {
      ...w,
      amount,
      isCustom: weekOv[w.index] != null,
      overAllocated: dA.overAllocated,
      days: w.days.map((d) => ({ date: d, amount: dA.amounts[d], isCustom: dayOv[d] != null })),
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
 * Hitung status setiap hari dengan sisa/minus dibawa ke hari berikutnya.
 * spentByDate: { 'YYYY-MM-DD': total }
 */
export function dailyStatus(plan, spentByDate, start, end) {
  const out = {}
  let carry = 0
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const alloc = plan.dayAlloc[d] || 0
    const available = alloc + carry
    const spent = spentByDate[d] || 0
    const remaining = available - spent
    out[d] = { alloc, carryIn: carry, available, spent, remaining }
    carry = remaining
  }
  return out
}

export function sumBy(list, keyFn, valFn = (x) => Number(x.amount)) {
  const m = {}
  for (const x of list) { const k = keyFn(x); m[k] = (m[k] || 0) + valFn(x) }
  return m
}
