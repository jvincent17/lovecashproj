import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWeeks, computePlan, dailyStatus, allocate } from './budget.js'
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
  assert.equal(st['2026-10-26'].carryIn, 50_000)
  assert.equal(st['2026-10-26'].available, 100_000 + 50_000)
  assert.equal(st['2026-10-27'].carryIn, -50_000)
})

test('addMonths dibatasi akhir bulan', async () => {
  const { addMonths } = await import('./dates.js')
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-10-25', 1), '2026-11-25')
  assert.equal(addMonths('2026-12-10', 1), '2027-01-10')
})
