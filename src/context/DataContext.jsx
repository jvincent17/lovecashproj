import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { addDays, addMonths, cycleFor, todayISO } from '../lib/dates.js'
import { computePlan, dailyStatus, sumBy } from '../lib/budget.js'
import { useAuth } from './AuthContext.jsx'
import { removePhoto, uploadPhoto } from '../lib/photos.js'

const DataCtx = createContext(null)

/** Lempar error Supabase supaya bisa ditangkap di UI. */
const must = ({ data, error }) => {
  if (error) throw error
  return data
}

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const [cfId, setCfId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [cashflow, setCashflow] = useState(null)
  const [myCashflows, setMyCashflows] = useState([])
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [periods, setPeriods] = useState([])
  const [debts, setDebts] = useState([])
  const [wallets, setWallets] = useState([])
  const [balances, setBalances] = useState({}) // wallet_id ('' = Unlocated) -> saldo
  const [transfers, setTransfers] = useState([])
  const [payments, setPayments] = useState([])

  const [selectedId, setSelectedId] = useState(null)
  const [incomes, setIncomes] = useState([])
  const [bills, setBills] = useState([])
  const [overrides, setOverrides] = useState([])
  const [expenses, setExpenses] = useState([])

  const today = todayISO()
  const payday = cashflow?.payday ?? 25
  const period = useMemo(() => periods.find((p) => p.id === selectedId) || null, [periods, selectedId])

  // Rentang periode berikutnya (untuk tagihan "bulan depan")
  const nextRange = useMemo(() => {
    if (!period) return null
    const start = addDays(period.end_date, 1)
    return { start, end: cycleFor(start, payday).end }
  }, [period, payday])

  // ---------- loaders ----------
  const loadCashflowMeta = useCallback(async (cf) => {
    const [p, c, mem, mine] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('cashflows').select('*').eq('id', cf).single(),
      supabase.from('cashflow_members').select('*').eq('cashflow_id', cf).order('joined_at'),
      supabase.from('cashflow_members').select('cashflow_id, role, cashflows(id, name)').eq('user_id', user.id),
    ])
    setProfile(must(p))
    setCashflow(must(c))
    setMyCashflows(must(mine).map((m) => ({ ...m.cashflows, role: m.role })))
    const memRows = must(mem)
    const profs = must(await supabase.from('profiles').select('id, username, display_name, avatar_path').in('id', memRows.map((m) => m.user_id)))
    const byId = Object.fromEntries(profs.map((x) => [x.id, x]))
    setMembers(memRows.map((m) => ({ ...m, profile: byId[m.user_id] || null })))
  }, [user.id])

  const loadCategories = useCallback(async (cf) => {
    setCategories(must(await supabase.from('categories').select('*').eq('cashflow_id', cf).order('sort').order('created_at')))
  }, [])

  const loadPeriods = useCallback(async (cf) => {
    const rows = must(await supabase.from('periods').select('*').eq('cashflow_id', cf).order('start_date', { ascending: false }))
    setPeriods(rows)
    return rows
  }, [])

  const loadWallets = useCallback(async (cf) => {
    const [w, b, t] = await Promise.all([
      supabase.from('wallets').select('*').eq('cashflow_id', cf).order('sort').order('created_at'),
      supabase.rpc('wallet_balances', { cf }),
      supabase.from('wallet_transfers').select('*').eq('cashflow_id', cf)
        .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
    ])
    setWallets(must(w))
    setBalances(Object.fromEntries(must(b).map((r) => [r.wallet_id ?? '', Number(r.balance)])))
    setTransfers(must(t))
  }, [])

  const loadDebts = useCallback(async (cf) => {
    const [d, p] = await Promise.all([
      supabase.from('debts').select('*').eq('cashflow_id', cf).order('created_at', { ascending: false }),
      supabase.from('debt_payments').select('*').eq('cashflow_id', cf).order('date', { ascending: false }),
    ])
    setDebts(must(d))
    setPayments(must(p))
  }, [])

  const loadPeriodData = useCallback(async (p, next) => {
    if (!p) { setIncomes([]); setBills([]); setOverrides([]); setExpenses([]); return }
    const [i, b, o, e] = await Promise.all([
      supabase.from('incomes').select('*').eq('period_id', p.id).order('date').order('created_at'),
      supabase.from('bills').select('*').eq('cashflow_id', p.cashflow_id)
        .gte('due_date', p.start_date).lte('due_date', next.end).order('due_date').order('created_at'),
      supabase.from('budget_overrides').select('*').eq('period_id', p.id),
      supabase.from('expenses').select('*').eq('cashflow_id', p.cashflow_id)
        .gte('date', p.start_date).lte('date', p.end_date)
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setIncomes(must(i))
    setBills(must(b))
    setOverrides(must(o))
    setExpenses(must(e))
  }, [])

  /** Muat semua data untuk cashflow aktif. */
  const loadAll = useCallback(async (cf) => {
    await Promise.all([loadCashflowMeta(cf), loadCategories(cf), loadDebts(cf), loadWallets(cf)])
    const ps = await loadPeriods(cf)
    setSelectedId((prev) => {
      if (prev && ps.some((p) => p.id === prev)) return prev
      const current = ps.find((p) => p.start_date <= today && p.end_date >= today)
      return (current || ps[0])?.id ?? null
    })
  }, [loadCashflowMeta, loadCategories, loadDebts, loadWallets, loadPeriods, today])

  // initial load
  useEffect(() => {
    ;(async () => {
      try {
        const cf = must(await supabase.rpc('ensure_profile'))
        setCfId(cf)
        await loadAll(cf)
      } catch (e) {
        setError(e.message)
      } finally {
        setReady(true)
      }
    })()
  }, [loadAll])

  useEffect(() => { loadPeriodData(period, nextRange).catch((e) => setError(e.message)) }, [period, nextRange, loadPeriodData])

  // Muat ulang saat aplikasi dibuka lagi, supaya input pasangan langsung terlihat
  useEffect(() => {
    if (!cfId) return
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        loadAll(cfId).then(() => loadPeriodData(period, nextRange)).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [cfId, loadAll, loadPeriodData, period, nextRange])

  const run = useCallback(async (fn) => {
    try {
      setError(null)
      return await fn()
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  // Setiap perubahan uang juga memperbarui saldo lokasi dana
  const reloadPeriod = useCallback(
    () => Promise.all([loadPeriodData(period, nextRange), period ? loadWallets(period.cashflow_id) : null]),
    [loadPeriodData, loadWallets, period, nextRange],
  )

  // ---------- actions ----------
  const actions = useMemo(() => {
    const withCf = (row) => ({ ...row, cashflow_id: cfId })

    const switchTo = async (cf) => {
      setCfId(cf)
      setSelectedId(null)
      await loadAll(cf)
    }

    /** Salin tagihan berulang dari periode sebelumnya ke periode baru (+1 bulan). */
    const copyRecurring = async (prev, created) => {
      const prevBills = must(await supabase.from('bills').select('*').eq('cashflow_id', cfId)
        .eq('recurring', true).gte('due_date', prev.start_date).lte('due_date', prev.end_date))
      if (!prevBills.length) return
      const existing = must(await supabase.from('bills').select('name').eq('cashflow_id', cfId)
        .gte('due_date', created.start_date).lte('due_date', created.end_date))
      const have = new Set(existing.map((b) => b.name.trim().toLowerCase()))
      const rows = prevBills
        .filter((b) => !have.has(b.name.trim().toLowerCase()))
        .map((b) => {
          let due = addMonths(b.due_date, 1)
          if (due < created.start_date) due = created.start_date
          if (due > created.end_date) due = created.end_date
          return withCf({ name: b.name, amount: b.amount, kind: b.kind, debt_id: b.debt_id, wallet_id: b.wallet_id, recurring: true, note: b.note, due_date: due })
        })
      if (rows.length) must(await supabase.from('bills').insert(rows))
    }

    return {
      clearError: () => setError(null),
      selectPeriod: setSelectedId,

      // ----- profil & cashflow -----
      updateProfile: (patch) => run(async () => {
        const clean = { ...patch }
        if (clean.username != null) clean.username = clean.username.trim().toLowerCase() || null
        const { error: err } = await supabase.from('profiles').update(clean).eq('id', user.id)
        if (err) throw new Error(err.code === '23505' ? 'Username sudah dipakai orang lain.'
          : err.code === '23514' ? 'Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.' : err.message)
        await loadCashflowMeta(cfId)
      }),
      setAvatar: (file) => run(async () => {
        const path = await uploadPhoto(`u/${user.id}`, 'avatar', file, 512)
        const old = profile?.avatar_path
        must(await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id))
        if (old) await removePhoto(old)
        await loadCashflowMeta(cfId)
      }),
      removeAvatar: () => run(async () => {
        const old = profile?.avatar_path
        must(await supabase.from('profiles').update({ avatar_path: null }).eq('id', user.id))
        if (old) await removePhoto(old)
        await loadCashflowMeta(cfId)
      }),
      setCashflowPhoto: (file) => run(async () => {
        const path = await uploadPhoto(`cf/${cfId}`, 'photo', file, 900)
        const old = cashflow?.photo_path
        must(await supabase.from('cashflows').update({ photo_path: path }).eq('id', cfId))
        if (old) await removePhoto(old)
        await loadCashflowMeta(cfId)
      }),
      removeCashflowPhoto: () => run(async () => {
        const old = cashflow?.photo_path
        must(await supabase.from('cashflows').update({ photo_path: null }).eq('id', cfId))
        if (old) await removePhoto(old)
        await loadCashflowMeta(cfId)
      }),
      updateCashflow: (patch) => run(async () => {
        must(await supabase.from('cashflows').update(patch).eq('id', cfId))
        await loadCashflowMeta(cfId)
      }),
      regenerateCode: () => run(async () => {
        must(await supabase.rpc('regenerate_invite_code', { cf: cfId }))
        await loadCashflowMeta(cfId)
      }),
      joinCashflow: (code) => run(async () => {
        const cf = must(await supabase.rpc('join_cashflow', { code }))
        await switchTo(cf)
      }),
      switchCashflow: (cf) => run(async () => {
        must(await supabase.rpc('switch_cashflow', { cf }))
        await switchTo(cf)
      }),
      leaveCashflow: () => run(async () => {
        const cf = must(await supabase.rpc('leave_cashflow', { cf: cfId }))
        await switchTo(cf)
      }),

      // ----- periode -----
      createPeriod: ({ start_date, end_date, firstIncome }) => run(async () => {
        const prev = periods.find((p) => p.start_date < start_date)
        const created = must(await supabase.from('periods').insert(withCf({ start_date, end_date })).select().single())
        if (firstIncome?.amount) {
          must(await supabase.from('incomes').insert(withCf({ period_id: created.id, name: firstIncome.name || 'Gaji', amount: firstIncome.amount, date: start_date })))
        }
        if (prev) await copyRecurring(prev, created)
        await loadPeriods(cfId)
        setSelectedId(created.id)
        return created
      }),
      deletePeriod: (id) => run(async () => {
        must(await supabase.from('periods').delete().eq('id', id))
        const ps = await loadPeriods(cfId)
        setSelectedId(ps[0]?.id ?? null)
      }),

      // ----- pemasukan -----
      saveIncome: (inc) => run(async () => {
        const { id, ...rest } = inc
        if (id) must(await supabase.from('incomes').update(rest).eq('id', id))
        else must(await supabase.from('incomes').insert(withCf({ ...rest, period_id: period.id })))
        await reloadPeriod()
      }),
      deleteIncome: (id) => run(async () => {
        must(await supabase.from('incomes').delete().eq('id', id))
        await reloadPeriod()
      }),

      // ----- tagihan -----
      saveBill: (bill) => run(async () => {
        const { id, ...rest } = bill
        if (id) must(await supabase.from('bills').update(rest).eq('id', id))
        else must(await supabase.from('bills').insert(withCf(rest)))
        await reloadPeriod()
      }),
      deleteBill: (bill) => run(async () => {
        if (bill.payment_id) must(await supabase.from('debt_payments').delete().eq('id', bill.payment_id))
        must(await supabase.from('bills').delete().eq('id', bill.id))
        await Promise.all([reloadPeriod(), loadDebts(cfId)])
      }),
      toggleBillPaid: (bill) => run(async () => {
        const paid = !bill.paid
        let payment_id = bill.payment_id
        if (bill.kind === 'debt' && bill.debt_id) {
          if (paid) {
            const pay = must(await supabase.from('debt_payments')
              .insert(withCf({ debt_id: bill.debt_id, amount: bill.amount, date: today, note: bill.name }))
              .select().single())
            payment_id = pay.id
          } else if (payment_id) {
            must(await supabase.from('debt_payments').delete().eq('id', payment_id))
            payment_id = null
          }
        }
        must(await supabase.from('bills').update({ paid, paid_at: paid ? today : null, payment_id }).eq('id', bill.id))
        await Promise.all([reloadPeriod(), loadDebts(cfId)])
      }),

      // ----- override budget -----
      setWeekAmount: (week_index, amount) => run(async () => {
        if (amount == null) {
          must(await supabase.from('budget_overrides').delete().eq('period_id', period.id).eq('week_index', week_index))
        } else {
          must(await supabase.from('budget_overrides')
            .upsert(withCf({ period_id: period.id, week_index, amount }), { onConflict: 'period_id,week_index' }))
        }
        await reloadPeriod()
      }),
      setDayAmount: (day, amount) => run(async () => {
        if (amount == null) {
          must(await supabase.from('budget_overrides').delete().eq('period_id', period.id).eq('day', day))
        } else {
          must(await supabase.from('budget_overrides')
            .upsert(withCf({ period_id: period.id, day, amount }), { onConflict: 'period_id,day' }))
        }
        await reloadPeriod()
      }),

      // ----- pengeluaran -----
      saveExpense: (exp) => run(async () => {
        const { id, ...rest } = exp
        if (id) must(await supabase.from('expenses').update(rest).eq('id', id))
        else must(await supabase.from('expenses').insert(withCf(rest)))
        await reloadPeriod()
      }),
      deleteExpense: (id) => run(async () => {
        must(await supabase.from('expenses').delete().eq('id', id))
        await reloadPeriod()
      }),

      // ----- kategori -----
      saveCategory: (cat) => run(async () => {
        const { id, ...rest } = cat
        if (id) must(await supabase.from('categories').update(rest).eq('id', id))
        else must(await supabase.from('categories').insert(withCf({ ...rest, sort: categories.length })))
        await loadCategories(cfId)
      }),
      deleteCategory: (id) => run(async () => {
        must(await supabase.from('categories').delete().eq('id', id))
        await Promise.all([loadCategories(cfId), reloadPeriod()])
      }),

      // ----- hutang -----
      saveDebt: (debt) => run(async () => {
        const { id, ...rest } = debt
        if (id) must(await supabase.from('debts').update(rest).eq('id', id))
        else must(await supabase.from('debts').insert(withCf(rest)))
        await loadDebts(cfId)
      }),
      deleteDebt: (id) => run(async () => {
        must(await supabase.from('debts').delete().eq('id', id))
        await Promise.all([loadDebts(cfId), reloadPeriod()])
      }),
      addPayment: (p) => run(async () => {
        must(await supabase.from('debt_payments').insert(withCf(p)))
        await loadDebts(cfId)
      }),
      deletePayment: (id) => run(async () => {
        must(await supabase.from('debt_payments').delete().eq('id', id))
        await Promise.all([loadDebts(cfId), reloadPeriod()])
      }),

      // ----- lokasi dana -----
      saveWallet: ({ id, iconFile, removeIcon, ...rest }, current) => run(async () => {
        const patch = { ...rest }
        if (iconFile) patch.icon_path = await uploadPhoto(`cf/${cfId}`, 'wallet', iconFile, 256)
        if (removeIcon) patch.icon_path = null
        if (id) must(await supabase.from('wallets').update(patch).eq('id', id))
        else must(await supabase.from('wallets').insert(withCf({ ...patch, sort: wallets.length })))
        if ((iconFile || removeIcon) && current?.icon_path) await removePhoto(current.icon_path)
        await loadWallets(cfId)
      }),
      deleteWallet: (w) => run(async () => {
        must(await supabase.from('wallets').delete().eq('id', w.id))
        if (w.icon_path) await removePhoto(w.icon_path)
        await Promise.all([loadWallets(cfId), reloadPeriod()])
      }),
      saveTransfer: (t) => run(async () => {
        const { id, ...rest } = t
        if (id) must(await supabase.from('wallet_transfers').update(rest).eq('id', id))
        else must(await supabase.from('wallet_transfers').insert(withCf(rest)))
        await loadWallets(cfId)
      }),
      deleteTransfer: (id) => run(async () => {
        must(await supabase.from('wallet_transfers').delete().eq('id', id))
        await loadWallets(cfId)
      }),
    }
  }, [cfId, user.id, profile, cashflow, run, periods, period, today, categories.length, wallets.length,
      loadAll, loadCashflowMeta, loadPeriods, loadDebts, loadCategories, loadWallets, reloadPeriod])

  // ---------- turunan ----------
  const billsThis = useMemo(
    () => (period ? bills.filter((b) => b.due_date >= period.start_date && b.due_date <= period.end_date) : []),
    [bills, period],
  )
  const billsNext = useMemo(
    () => (nextRange ? bills.filter((b) => b.due_date >= nextRange.start && b.due_date <= nextRange.end) : []),
    [bills, nextRange],
  )
  const plan = useMemo(
    () => (period ? computePlan({ period, incomes, bills: billsThis, overrides }) : null),
    [period, incomes, billsThis, overrides],
  )
  const spentByDate = useMemo(() => sumBy(expenses, (e) => e.date), [expenses])
  const status = useMemo(
    () => (plan ? dailyStatus(plan, spentByDate, period.start_date, period.end_date) : {}),
    [plan, spentByDate, period],
  )
  const spentTotal = useMemo(() => expenses.reduce((a, e) => a + Number(e.amount), 0), [expenses])
  /** Saldo = pemasukan − tagihan yang sudah dibayar − pengeluaran */
  const saldo = plan ? plan.income - plan.billsPaid - spentTotal : 0

  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])
  const memberName = useCallback((uid) => {
    const m = members.find((x) => x.user_id === uid)
    return m?.profile?.display_name || m?.profile?.username || 'Anggota'
  }, [members])
  const debtsView = useMemo(() => {
    const paidBy = sumBy(payments, (p) => p.debt_id)
    return debts.map((d) => {
      const paid = paidBy[d.id] || 0
      const rest = Math.max(0, Number(d.amount) - paid)
      return { ...d, paid, rest, done: rest === 0, payments: payments.filter((p) => p.debt_id === d.id) }
    })
  }, [debts, payments])

  const walletById = useMemo(() => Object.fromEntries(wallets.map((w) => [w.id, w])), [wallets])
  const totalMoney = useMemo(() => Object.values(balances).reduce((a, b) => a + b, 0), [balances])

  const value = {
    ready, error, today, user,
    profile, cashflow, myCashflows, members, memberName, payday,
    categories, catById, periods, period, nextRange,
    incomes, bills, billsThis, billsNext, overrides, expenses,
    plan, status, spentByDate, spentTotal, saldo,
    debts: debtsView,
    wallets, walletById, balances, transfers, totalMoney,
    ...actions,
  }

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export const useData = () => useContext(DataCtx)
