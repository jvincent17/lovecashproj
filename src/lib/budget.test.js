import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeks, computePlan, dailyStatus, allocate, periodSaldo } from './budget.js'
import { cycleFor } from './dates.js'

test('cycleFor tanggal gajian 25', () => {
  assert.deepEqual(cycleFor('2026-10-26', 25), { start: '2026-10-25', end: '2026-11-24' })
  assert.deepEqual(cycleFor('2026-10-10', 25), { start: '2026-09-25', end: '2026-10-24' })
  assert.deepEqual(cycleFor('2026-01-05', 25), { start: '2025-12-25', end: '2026-01-24' })
})

test('cycleFor tanggal 31 dibatasi akhir bulan', () => {
  assert.deepEqual(cycleFor('2026-02-28', 31), { start: '2026-02-28', end: '2026-03-30' })
  assert.deepEqual(cycleFor('2026-02-10', 31), { start: '2026-01-31', end: '2026-02-27' })
})

test('buildWeeks menggabung sisa hari pendek', () => {
  const w = buildWeeks('2026-10-25', '2026-11-24') // 31 hari
  assert.equal(w.length, 4)
  assert.equal(w[3].days.length, 10)
  assert.equal(w.reduce((s, x) => s + x.days.length, 0), 31)
})

test('allocate total tetap sama', () => {
  const { amounts } = allocate([{ key: 'a', weight: 1 }, { key: 'b', weight: 1 }, { key: 'c', weight: 1 }], 100)
  assert.equal(amounts.a + amounts.b + amounts.c, 100)
})

test('computePlan & carry-over', () => {
  const period = { start_date: '2026-10-25', end_date: '2026-11-24' }
  const plan = computePlan({
    period,
    incomes: [{ amount: 5_000_000 }, { amount: 1_000_000 }],
    bills: [{ amount: 1_500_000, paid: true }, { amount: 1_400_000 }],
    overrides: [{ week_index: 0, amount: 1_000_000 }, { day: '2026-10-25', amount: 400_000 }],
  })
  assert.equal(plan.income, 6_000_000)
  assert.equal(plan.billsPaid, 1_500_000)
  assert.equal(plan.flexible, 3_100_000)
  assert.equal(plan.weeks[0].amount, 1_000_000)
  assert.equal(plan.weeks.reduce((s, w) => s + w.amount, 0), 3_100_000)
  assert.equal(plan.weeks[0].days[0].amount, 400_000)
  assert.equal(plan.weeks[0].days.reduce((s, d) => s + d.amount, 0), 1_000_000)
  const total = Object.values(plan.dayAlloc).reduce((s, v) => s + v, 0)
  assert.equal(total, 3_100_000)

  const st = dailyStatus(plan, { '2026-10-25': 350_000, '2026-10-26': 200_000 }, period.start_date, period.end_date)
  assert.equal(st['2026-10-25'].remaining, 50_000)
  assert.equal(st['2026-10-26'].adjust, 50_000) // sisa masuk ke jatah besok
  assert.equal(st['2026-10-26'].alloc, 100_000 + 50_000)
  assert.equal(st['2026-10-27'].adjust, -50_000) // minus memotong jatah besok
})

test('addMonths dibatasi akhir bulan', async () => {
  const { addMonths } = await import('./dates.js')
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-10-25', 1), '2026-11-25')
  assert.equal(addMonths('2026-12-10', 1), '2027-01-10')
})

test('dana tambahan di tengah periode hanya menambah hari itu dan seterusnya', () => {
  const period = { start_date: '2026-10-25', end_date: '2026-11-24' } // 31 hari
  const base = computePlan({ period, incomes: [{ amount: 3_100_000, date: '2026-10-25' }] })
  const plus = computePlan({ period, incomes: [{ amount: 3_100_000, date: '2026-10-25' }, { amount: 109_000, date: '2026-10-27' }] })
  assert.equal(plus.flexible, 3_209_000)
  // hari sebelum dana masuk tidak berubah (toleransi pembulatan 1 rupiah)
  assert.ok(Math.abs(plus.dayAlloc['2026-10-25'] - base.dayAlloc['2026-10-25']) <= 1)
  assert.ok(Math.abs(plus.dayAlloc['2026-10-26'] - base.dayAlloc['2026-10-26']) <= 1)
  assert.ok(plus.dayAlloc['2026-10-27'] > base.dayAlloc['2026-10-27'])
  const total = Object.values(plus.dayAlloc).reduce((s, v) => s + v, 0)
  assert.equal(total, 3_209_000)
})

test('tagihan dipotong dari pemasukan paling awal', () => {
  const period = { start_date: '2026-10-25', end_date: '2026-11-24' }
  const plan = computePlan({
    period,
    incomes: [{ amount: 1_000_000, date: '2026-10-25' }, { amount: 2_000_000, date: '2026-11-10' }],
    bills: [{ amount: 1_000_000 }],
  })
  // gaji pertama habis untuk tagihan, jadi hari sebelum 10 Nov belum dapat jatah
  assert.equal(plan.dayAlloc['2026-10-25'], 0)
  assert.equal(plan.dayAlloc['2026-11-09'], 0)
  assert.ok(plan.dayAlloc['2026-11-10'] > 0)
  assert.equal(Object.values(plan.dayAlloc).reduce((s, v) => s + v, 0), 2_000_000)
})

test('sisa/minus pindah penuh ke jatah besok saja', () => {
  const period = { start_date: '2026-10-25', end_date: '2026-11-24' }
  const plan = computePlan({ period, incomes: [{ amount: 3_100_000, date: '2026-10-25' }] }) // 100rb/hari
  const today = '2026-10-28'
  const spent = { '2026-10-25': 100_000, '2026-10-26': 113_098, '2026-10-27': 50_000 }
  const st = dailyStatus(plan, spent, period.start_date, period.end_date, today)
  assert.equal(st['2026-10-27'].alloc, 100_000 - 13_098) // minus tgl 26 memotong tgl 27
  assert.equal(st['2026-10-28'].alloc, 100_000 + 36_902) // sisa tgl 27 menambah tgl 28 (hari ini)
  assert.equal(st['2026-10-29'].alloc, 100_000) // lusa tetap normal
  assert.equal(st['2026-11-24'].alloc, 100_000) // tidak menumpuk sampai akhir bulan
})

test('minus hari ini langsung memotong jatah besok', () => {
  const period = { start_date: '2026-10-25', end_date: '2026-11-24' }
  const plan = computePlan({ period, incomes: [{ amount: 3_100_000, date: '2026-10-25' }] })
  const spent = { '2026-10-25': 100_000, '2026-10-26': 100_000, '2026-10-27': 100_000, '2026-10-28': 120_000 }
  const st = dailyStatus(plan, spent, period.start_date, period.end_date, '2026-10-28')
  assert.equal(st['2026-10-29'].alloc, 80_000)
  assert.equal(st['2026-10-30'].alloc, 100_000)
})

test('kantong: disisihkan, ditarik dari minggu, dan dimasukkan ke jatah', () => {
  const period = { start_date: '2026-10-25', end_date: '2026-11-24' } // 31 hari
  const incomes = [{ amount: 3_400_000, date: '2026-10-25' }]
  const moves = [
    { pocket_id: 'heal', kind: 'fund', amount: 300_000, date: '2026-10-25' },
    { pocket_id: 'dar', kind: 'from_week', amount: 50_000, date: '2026-10-29' }, // minggu 1: 29,30,31
    { pocket_id: 'heal', kind: 'to_day', amount: 30_000, date: '2026-10-27' },
  ]
  const plan = computePlan({ period, incomes, pocketMoves: moves })
  assert.equal(plan.flexible, 3_100_000)
  assert.equal(plan.dailyBudget, 3_100_000 - 50_000 + 30_000)
  const total = Object.values(plan.dayAlloc).reduce((a, v) => a + v, 0)
  assert.equal(total, plan.dailyBudget)
  assert.equal(plan.dayAlloc['2026-10-27'], 130_000)
  assert.equal(plan.dayAlloc['2026-10-28'], 100_000) // sebelum tanggal tarik tidak berubah
  assert.equal(plan.dayAlloc['2026-10-29'] + plan.dayAlloc['2026-10-30'] + plan.dayAlloc['2026-10-31'], 300_000 - 50_000)
  assert.equal(plan.weeks[0].amount, 700_000 + 30_000 - 50_000)

  const pockets = [{ id: 'heal', carry_over: false }, { id: 'dar', carry_over: true }]
  const expenses = [{ amount: 10_000 }, { amount: 80_000, pocket_id: 'heal' }, { amount: 20_000, pocket_id: 'dar' }]
  // 3.400.000 − 10.000 − 80.000 − 50.000 (ke Darurat) = 3.260.000
  assert.equal(periodSaldo({ plan, expenses, pockets, pocketMoves: moves }), 3_260_000)
})
