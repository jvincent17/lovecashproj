import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { todayISO } from '../lib/dates.js'
import { computePlan, dailyStatus, sumBy } from '../lib/budget.js'

const DataCtx = createContext(null)

export const DEFAULT_CATEGORIES = [
  { name: 'Makan & Minum', icon: '🍜' },
  { name: 'Transport', icon: '🛵' },
  { name: 'Belanja', icon: '🛒' },
  { name: 'Tagihan', icon: '💡' },
  { name: 'Hiburan', icon: '🎬' },
  { name: 'Kesehatan', icon: '💊' },
  { name: 'Keluarga', icon: '👨‍👩‍👧' },
  { name: 'Lainnya', icon: '📦' },
]

/** Lempar error Supabase supaya bisa ditangkap di UI. */
const must = ({ data, error }) => {
  if (error) throw error
  return data
}

export function DataProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(null)
  const [categories, setCategories] = useState([])
  const [periods, setPeriods] = useState([])
  const [debts, setDebts] = useState([])
  const [payments, setPayments] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [fixedItems, setFixedItems] = useState([])
  const [overrides, setOverrides] = useState([])
  const [expenses, setExpenses] = useState([])
  const seeded = useRef(false)

  const today = todayISO()

  // ---------- loaders ----------
  const loadCategories = useCallback(async () => {
    let rows = must(await supabase.from('categories').select('*').order('sort').order('created_at'))
    if (rows.length === 0 && !seeded.current) {
      seeded.current = true
      await supabase
        .from('categories')
        .upsert(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort: i })), { onConflict: 'user_id,name', ignoreDuplicates: true })
      rows = must(await supabase.from('categories').select('*').order('sort').order('created_at'))
    }
    setCategories(rows)
  }, [])

  const loadPeriods = useCallback(async () => {
    const rows = must(await supabase.from('periods').select('*').order('start_date', { ascending: false }))
    setPeriods(rows)
    return rows
  }, [])

  const loadDebts = useCallback(async () => {
    const [d, p] = await Promise.all([
      supabase.from('debts').select('*').order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*').order('date', { ascending: false }),
    ])
    setDebts(must(d))
    setPayments(must(p))
  }, [])

  const loadSettings = useCallback(async () => {
    let row = must(await supabase.from('settings').select('*').maybeSingle())
    if (!row) row = must(await supabase.from('settings').upsert({ payday: 25 }).select().single())
    setSettings(row)
  }, [])

  const period = useMemo(() => periods.find((p) => p.id === selectedId) || null, [periods, selectedId])

  const loadPeriodData = useCallback(async (p) => {
    if (!p) { setFixedItems([]); setOverrides([]); setExpenses([]); return }
    const [f, o, e] = await Promise.all([
      supabase.from('fixed_items').select('*').eq('period_id', p.id).order('created_at'),
      supabase.from('budget_overrides').select('*').eq('period_id', p.id),
      supabase.from('expenses').select('*').gte('date', p.start_date).lte('date', p.end_date)
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setFixedItems(must(f))
    setOverrides(must(o))
    setExpenses(must(e))
  }, [])

  // initial load
  useEffect(() => {
    ;(async () => {
      try {
        await Promise.all([loadSettings(), loadCategories(), loadDebts()])
        const ps = await loadPeriods()
        const current = ps.find((p) => p.start_date <= today && p.end_date >= today)
        setSelectedId((current || ps[0])?.id ?? null)
      } catch (e) {
        setError(e.message)
      } finally {
        setReady(true)
      }
    })()
  }, [loadSettings, loadCategories, loadDebts, loadPeriods, today])

  useEffect(() => { loadPeriodData(period).catch((e) => setError(e.message)) }, [period, loadPeriodData])

  // wrapper: jalankan aksi, tampilkan error kalau gagal
  const run = useCallback(async (fn) => {
    try {
      setError(null)
      return await fn()
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  const reloadPeriod = useCallback(() => loadPeriodData(period), [loadPeriodData, period])

  // ---------- actions ----------
  const actions = useMemo(() => ({
    clearError: () => setError(null),
    selectPeriod: setSelectedId,

    setPayday: (payday) => run(async () => {
      setSettings(must(await supabase.from('settings').upsert({ payday }).select().single()))
    }),

    createPeriod: ({ start_date, end_date, salary }) => run(async () => {
      const prev = periods.find((p) => p.start_date < start_date)
      const created = must(await supabase.from('periods').insert({ start_date, end_date, salary }).select().single())
      if (prev) {
        const prevFixed = must(await supabase.from('fixed_items').select('name,amount,kind,debt_id').eq('period_id', prev.id))
        if (prevFixed.length) {
          must(await supabase.from('fixed_items').insert(prevFixed.map((f) => ({ ...f, period_id: created.id }))))
        }
      }
      await loadPeriods()
      setSelectedId(created.id)
      return created
    }),

    updatePeriod: (id, patch) => run(async () => {
      must(await supabase.from('periods').update(patch).eq('id', id))
      await loadPeriods()
    }),

    deletePeriod: (id) => run(async () => {
      must(await supabase.from('periods').delete().eq('id', id))
      const ps = await loadPeriods()
      setSelectedId(ps[0]?.id ?? null)
    }),

    // pos tetap
    addFixed: (item) => run(async () => {
      must(await supabase.from('fixed_items').insert({ ...item, period_id: period.id }))
      await reloadPeriod()
    }),
    updateFixed: (id, patch) => run(async () => {
      must(await supabase.from('fixed_items').update(patch).eq('id', id))
      await reloadPeriod()
    }),
    deleteFixed: (item) => run(async () => {
      if (item.payment_id) must(await supabase.from('debt_payments').delete().eq('id', item.payment_id))
      must(await supabase.from('fixed_items').delete().eq('id', item.id))
      await Promise.all([reloadPeriod(), loadDebts()])
    }),
    toggleFixedPaid: (item) => run(async () => {
      const paid = !item.paid
      let payment_id = item.payment_id
      if (item.kind === 'debt' && item.debt_id) {
        if (paid) {
          const pay = must(await supabase.from('debt_payments')
            .insert({ debt_id: item.debt_id, amount: item.amount, date: today, note: `Cicilan: ${item.name}` })
            .select().single())
          payment_id = pay.id
        } else if (payment_id) {
          must(await supabase.from('debt_payments').delete().eq('id', payment_id))
          payment_id = null
        }
      }
      must(await supabase.from('fixed_items').update({ paid, payment_id }).eq('id', item.id))
      await Promise.all([reloadPeriod(), loadDebts()])
    }),

    // override budget
    setWeekAmount: (week_index, amount) => run(async () => {
      if (amount == null) {
        must(await supabase.from('budget_overrides').delete().eq('period_id', period.id).eq('week_index', week_index))
      } else {
        must(await supabase.from('budget_overrides')
          .upsert({ period_id: period.id, week_index, amount }, { onConflict: 'period_id,week_index' }))
      }
      await reloadPeriod()
    }),
    setDayAmount: (day, amount) => run(async () => {
      if (amount == null) {
        must(await supabase.from('budget_overrides').delete().eq('period_id', period.id).eq('day', day))
      } else {
        must(await supabase.from('budget_overrides')
          .upsert({ period_id: period.id, day, amount }, { onConflict: 'period_id,day' }))
      }
      await reloadPeriod()
    }),

    // pengeluaran
    saveExpense: (exp) => run(async () => {
      const { id, ...rest } = exp
      if (id) must(await supabase.from('expenses').update(rest).eq('id', id))
      else must(await supabase.from('expenses').insert(rest))
      await reloadPeriod()
    }),
    deleteExpense: (id) => run(async () => {
      must(await supabase.from('expenses').delete().eq('id', id))
      await reloadPeriod()
    }),

    // kategori
    saveCategory: (cat) => run(async () => {
      const { id, ...rest } = cat
      if (id) must(await supabase.from('categories').update(rest).eq('id', id))
      else must(await supabase.from('categories').insert({ ...rest, sort: categories.length }))
      await loadCategories()
    }),
    deleteCategory: (id) => run(async () => {
      must(await supabase.from('categories').delete().eq('id', id))
      await Promise.all([loadCategories(), reloadPeriod()])
    }),

    // hutang
    saveDebt: (debt) => run(async () => {
      const { id, ...rest } = debt
      if (id) must(await supabase.from('debts').update(rest).eq('id', id))
      else must(await supabase.from('debts').insert(rest))
      await loadDebts()
    }),
    deleteDebt: (id) => run(async () => {
      must(await supabase.from('debts').delete().eq('id', id))
      await Promise.all([loadDebts(), reloadPeriod()])
    }),
    addPayment: (p) => run(async () => {
      must(await supabase.from('debt_payments').insert(p))
      await loadDebts()
    }),
    deletePayment: (id) => run(async () => {
      must(await supabase.from('debt_payments').delete().eq('id', id))
      await Promise.all([loadDebts(), reloadPeriod()])
    }),
  }), [run, periods, period, today, categories.length, loadPeriods, loadDebts, loadCategories, reloadPeriod])

  // ---------- turunan ----------
  const plan = useMemo(
    () => (period ? computePlan({ period, fixedItems, overrides }) : null),
    [period, fixedItems, overrides],
  )
  const spentByDate = useMemo(() => sumBy(expenses, (e) => e.date), [expenses])
  const status = useMemo(
    () => (plan ? dailyStatus(plan, spentByDate, period.start_date, period.end_date) : {}),
    [plan, spentByDate, period],
  )
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const debtsView = useMemo(() => {
    const paidBy = sumBy(payments, (p) => p.debt_id)
    return debts.map((d) => {
      const paid = paidBy[d.id] || 0
      const rest = Math.max(0, Number(d.amount) - paid)
      return { ...d, paid, rest, done: rest === 0, payments: payments.filter((p) => p.debt_id === d.id) }
    })
  }, [debts, payments])

  const value = {
    ready, error, today,
    settings, categories, catById, periods, period,
    fixedItems, overrides, expenses, plan, status, spentByDate,
    debts: debtsView,
    ...actions,
  }

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export const useData = () => useContext(DataCtx)
