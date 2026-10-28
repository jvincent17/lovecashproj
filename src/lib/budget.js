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

/** Bagi `total` (bulat) ke daftar hari sesuai bobot, metode sisa terbesar. */
function splitBy(days, total, weightOf) {
  const W = days.reduce((a, d) => a + Math.max(0, weightOf(d)), 0)
  const exact = days.map((d) => total * (W > 0 ? Math.max(0, weightOf(d)) / W : 1 / days.length))
  const base = exact.map((x) => Math.floor(x + 1e-6))
  let left = total - base.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0 && days.length; k = (k + 1) % days.length, left--) base[order[k][1]] += 1
  return Object.fromEntries(days.map((d, i) => [d, base[i]]))
}

/**
 * Susun rencana budget lengkap untuk satu periode.
 * incomes: dana masuk periode ini; bills: tagihan yang jatuh tempo di periode ini.
 * pocketMoves: pergerakan kantong khusus di periode ini (fund / from_week / to_day).
 * Budget fleksibel = dana masuk − semua tagihan − uang yang disisihkan ke kantong (fund).
 */
export function computePlan({ period, incomes = [], bills = [], overrides = [], pocketMoves = [] }) {
  const income = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const billsTotal = bills.reduce((s, b) => s + Number(b.amount), 0)
  const billsPaid = bills.filter((b) => b.paid).reduce((s, b) => s + Number(b.amount), 0)
  const sumKind = (k) => pocketMoves.filter((m) => m.kind === k).reduce((s, m) => s + Number(m.amount), 0)
  const pocketFund = sumKind('fund')
  const pocketFromWeek = sumKind('from_week')
  const pocketToDay = sumKind('to_day')
  const flexible = Math.max(0, income - billsTotal - pocketFund)
  const w = dayWeights(period, incomes, billsTotal + pocketFund)

  const weekOv = {}
  const dayOv = {}
  for (const o of overrides) {
    if (o.week_index != null) weekOv[o.week_index] = Number(o.amount)
    else if (o.day) dayOv[o.day] = Number(o.amount)
  }

  const weeks = buildWeeks(period.start_date, period.end_date)
  const wAlloc = allocate(weeks.map((wk) => ({ key: wk.index, weight: wk.days.reduce((a, d) => a + w[d], 0) })), flexible, weekOv)

  const dayAlloc = {}
  const dayOverAlloc = {}
  weeks.forEach((wk) => {
    const dOv = {}
    wk.days.forEach((d) => { if (dayOv[d] != null) dOv[d] = dayOv[d] })
    const dA = allocate(wk.days.map((d) => ({ key: d, weight: w[d] })), wAlloc.amounts[wk.index], dOv)
    wk.days.forEach((d) => { dayAlloc[d] = dA.amounts[d] })
    dayOverAlloc[wk.index] = dA.overAllocated
  })

  // Kantong: tarik dari jatah minggu (hari-hari mulai tanggal tarik, di minggu yang sama) & masukkan ke jatah hari
  const pocketDay = {} // efek kantong per hari (untuk keterangan di UI)
  const clampDay = (d) => (d < period.start_date ? period.start_date : d > period.end_date ? period.end_date : d)
  for (const m of pocketMoves) {
    const amt = Number(m.amount)
    const date = clampDay(m.date)
    if (m.kind === 'to_day') {
      dayAlloc[date] = (dayAlloc[date] || 0) + amt
      pocketDay[date] = (pocketDay[date] || 0) + amt
    } else if (m.kind === 'from_week') {
      const wk = weeks.find((x) => x.days.includes(date))
      const targets = wk ? wk.days.filter((d) => d >= date) : [date]
      const cut = splitBy(targets, amt, (d) => dayAlloc[d])
      for (const d of targets) {
        dayAlloc[d] -= cut[d]
        pocketDay[d] = (pocketDay[d] || 0) - cut[d]
      }
    }
  }

  const outWeeks = weeks.map((wk) => ({
    ...wk,
    amount: wk.days.reduce((a, d) => a + dayAlloc[d], 0),
    isCustom: weekOv[wk.index] != null,
    overAllocated: dayOverAlloc[wk.index],
    days: wk.days.map((d) => ({ date: d, amount: dayAlloc[d], isCustom: dayOv[d] != null, pocket: pocketDay[d] || 0 })),
  }))

  return {
    income,
    billsTotal,
    billsPaid,
    pocketFund,
    pocketFromWeek,
    pocketToDay,
    flexible,
    /** Total yang benar-benar dibagi ke jatah harian */
    dailyBudget: flexible - pocketFromWeek + pocketToDay,
    overAllocated: wAlloc.overAllocated,
    weeks: outWeeks,
    dayAlloc,
  }
}

/**
 * Saldo periode = dana masuk − tagihan dibayar − pengeluaran harian − pengeluaran kantong biasa
 *                 − uang bersih yang masuk ke kantong "numpuk" (dianggap sudah ditabung).
 */
export function periodSaldo({ plan, expenses = [], pockets = [], pocketMoves = [] }) {
  const carry = new Set(pockets.filter((k) => k.carry_over).map((k) => k.id))
  const spent = expenses.filter((e) => !e.pocket_id || !carry.has(e.pocket_id)).reduce((a, e) => a + Number(e.amount), 0)
  const toCarry = pocketMoves.filter((m) => carry.has(m.pocket_id))
    .reduce((a, m) => a + (m.kind === 'to_day' ? -1 : 1) * Number(m.amount), 0)
  return plan.income - plan.billsPaid - spent - toCarry
}

/**
 * Hitung status setiap hari.
 * Sisa atau minus sebuah hari dipindah PENUH ke jatah 1 hari berikutnya.
 * - Hanya hari yang sudah lewat (< today) yang menghasilkan sisa, karena hari ini & ke depan
 *   belum selesai (pengeluarannya belum diketahui). Jadi hari-hari ke depan tetap tampil normal.
 * - Minus hari ini langsung memotong jatah besok (pengeluaran tidak mungkin berkurang lagi).
 * spentByDate: { 'YYYY-MM-DD': total }
 */
export function dailyStatus(plan, spentByDate, start, end, today = null) {
  const out = {}
  const adj = {} // penyesuaian jatah dari sisa/minus hari sebelumnya
  let leftover = 0 // sisa di hari terakhir periode (tidak ada "besok")
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const baseAlloc = plan.dayAlloc[d] || 0
    const adjust = adj[d] || 0
    const alloc = baseAlloc + adjust
    const spent = spentByDate[d] || 0
    const remaining = alloc - spent
    out[d] = { alloc, baseAlloc, adjust, carryIn: 0, available: alloc, spent, remaining }

    const finished = today == null || d < today
    const moves = remaining < 0 || (remaining > 0 && finished)
    const tomorrow = addDays(d, 1)
    if (moves && tomorrow <= end) adj[tomorrow] = (adj[tomorrow] || 0) + remaining
    else leftover = remaining
  }
  void leftover
  return out
}

export function sumBy(list, keyFn, valFn = (x) => Number(x.amount)) {
  const m = {}
  for (const x of list) { const k = keyFn(x); m[k] = (m[k] || 0) + valFn(x) }
  return m
}
