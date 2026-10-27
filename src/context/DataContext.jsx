import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { addDays, addMonths, cycleFor, fmtRange, todayISO } from '../lib/dates.js'
import { computePlan, dailyStatus, sumBy } from '../lib/budget.js'
import { useAuth } from './AuthContext.jsx'
import { removePhoto, uploadPhoto } from '../lib/photos.js'

const DataCtx = createContext(null)

/** Lempar error Supabase supaya bisa ditangkap di UI. */
const must = ({ data, error }) => {
  if (error) throw error
  return data
}

const tmpId = () => `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`
const isTmp = (id) => typeof id === 'string' && id.startsWith('tmp-')
const nowIso = () => new Date().toISOString()

// Urutan sama seperti query di server
const byExpenseOrder = (a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1)
const byDateAsc = (k) => (a, b) => (a[k] === b[k] ? (a.created_at < b.created_at ? -1 : 1) : a[k] < b[k] ? -1 : 1)

const CACHE_KEY = (uid) => `duitkara-cache-v1-${uid}`
const readCache = (uid) => { try { return JSON.parse(localStorage.getItem(CACHE_KEY(uid)) || 'null') } catch { return null } }
const writeCache = (uid, data) => { try { localStorage.setItem(CACHE_KEY(uid), JSON.stringify(data)) } catch { /* penuh / privat */ } }

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [ready, setReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  const [cfId, setCfId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [cashflow, setCashflow] = useState(null)
  const [myCashflows, setMyCashflows] = useState([])
  const [members, setMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [periods, setPeriods] = useState([])
  const [debts, setDebts] = useState([])
  const [payments, setPayments] = useState([])
  const [wallets, setWallets] = useState([])
  const [balances, setBalances] = useState({}) // wallet_id ('' = Unlocated) -> saldo
  const [transfers, setTransfers] = useState([])
  const [templates, setTemplates] = useState([])

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

  // ref untuk dipakai di callback async tanpa memicu ulang effect
  const selRef = useRef(null)
  selRef.current = selectedId
  const loadedKeyRef = useRef('') // periode (id+tanggal) yang datanya sedang ada di state
  const keyOf = (p) => (p ? `${p.id}|${p.start_date}|${p.end_date}` : '')
  const recentIds = useRef(new Map()) // id yang baru kita ubah sendiri -> waktu (untuk abaikan gema realtime)
  const markMine = (id) => { if (id && !isTmp(id)) recentIds.current.set(id, Date.now()) }

  // ---------- muat data ----------
  const applyBootstrap = useCallback((d) => {
    setCfId(d.cf)
    setProfile(d.profile)
    setCashflow(d.cashflow)
    setMyCashflows(d.my_cashflows)
    setMembers(d.members)
    setCategories(d.categories)
    setPeriods(d.periods)
    setDebts(d.debts)
    setPayments(d.payments)
    setWallets(d.wallets)
    setBalances(Object.fromEntries(d.balances.map((r) => [r.wallet_id ?? '', Number(r.balance)])))
    setTransfers(d.transfers)
    setTemplates(d.templates)
    loadedKeyRef.current = keyOf(d.periods.find((x) => x.id === d.period_id))
    setSelectedId(d.period_id)
    setIncomes(d.incomes)
    setBills(d.bills)
    setOverrides(d.overrides)
    setExpenses(d.expenses)
  }, [])

  /** Satu permintaan untuk semua data (cashflow aktif + periode terpilih). */
  const refreshAll = useCallback(async (opts = {}) => {
    setSyncing(true)
    try {
      const d = must(await supabase.rpc('app_bootstrap', {
        sel_period: opts.keepPeriod === false ? null : selRef.current, today: todayISO(),
      }))
      applyBootstrap(d)
      writeCache(user.id, d)
      return d
    } finally {
      setSyncing(false)
    }
  }, [applyBootstrap, user.id])

  // Awal: tampilkan data terakhir dari HP dulu (instan), lalu segarkan dari server
  useEffect(() => {
    const cached = readCache(user.id)
    if (cached) {
      applyBootstrap(cached)
      setReady(true)
    }
    refreshAll({ keepPeriod: false })
      .catch((e) => { if (!cached) setError(e.message) })
      .finally(() => setReady(true))
  }, [user.id, applyBootstrap, refreshAll])

  /** Data satu periode (saat pindah periode). Empat query paralel = satu kali tunggu. */
  const loadPeriodData = useCallback(async (p) => {
    if (!p) { setIncomes([]); setBills([]); setOverrides([]); setExpenses([]); return }
    const [i, b, o, e] = await Promise.all([
      supabase.from('incomes').select('*').eq('period_id', p.id).order('date').order('created_at'),
      supabase.from('bills').select('*').eq('cashflow_id', p.cashflow_id)
        .gte('due_date', p.start_date).lte('due_date', addDays(p.end_date, 62)).order('due_date').order('created_at'),
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

  // Pindah periode / tanggal periode berubah -> muat datanya (kalau belum ada)
  const periodKey = keyOf(period)
  useEffect(() => {
    if (!period || loadedKeyRef.current === periodKey) return
    loadedKeyRef.current = periodKey
    loadPeriodData(period).catch((e) => setError(e.message))
  }, [periodKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadBalances = useCallback(async (cf) => {
    const b = must(await supabase.rpc('wallet_balances', { cf }))
    setBalances(Object.fromEntries(b.map((r) => [r.wallet_id ?? '', Number(r.balance)])))
  }, [])
  // Cocokkan ulang saldo lokasi dengan server, tidak menghalangi tampilan
  const balTimer = useRef(null)
  const reconcileBalances = useCallback(() => {
    clearTimeout(balTimer.current)
    balTimer.current = setTimeout(() => { if (cfId) loadBalances(cfId).catch(() => {}) }, 1500)
  }, [cfId, loadBalances])

  // Muat ulang saat aplikasi dibuka lagi
  useEffect(() => {
    if (!cfId) return
    const onVis = () => { if (document.visibilityState === 'visible') refreshAll().catch(() => {}) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [cfId, refreshAll])

  // Sinkron realtime: hanya perubahan dari PASANGAN yang memicu muat ulang
  useEffect(() => {
    if (!cfId || !supabase.channel) return
    let timer = null
    const onChange = (payload) => {
      const id = payload.new?.id || payload.old?.id
      const t = id && recentIds.current.get(id)
      if (t && Date.now() - t < 15000) return // gema dari perubahan kita sendiri
      if (payload.new?.created_by === user.id && payload.eventType === 'INSERT') return
      clearTimeout(timer)
      timer = setTimeout(() => refreshAll().catch(() => {}), 600)
    }
    const tables = ['incomes', 'expenses', 'bills', 'periods', 'budget_overrides', 'wallets', 'wallet_transfers',
      'debts', 'debt_payments', 'categories', 'quick_templates', 'cashflow_members']
    let ch = supabase.channel(`cf-${cfId}`)
    for (const table of tables) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `cashflow_id=eq.${cfId}` }, onChange)
    }
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'cashflows', filter: `id=eq.${cfId}` }, onChange)
    ch.subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(ch) }
  }, [cfId, refreshAll, user.id])

  // ---------- pembungkus aksi ----------
  const showError = useCallback((e) => {
    setError(e?.code === '23P01' ? 'Tanggal periode bertumpuk dengan periode lain.' : e?.message || String(e))
  }, [])

  /** Aksi biasa: tunggu server, tampilkan error kalau gagal. */
  const run = useCallback(async (fn) => {
    try {
      setError(null)
      return await fn()
    } catch (e) {
      showError(e)
      throw e
    }
  }, [showError])

  /**
   * Aksi instan: ubah tampilan dulu, kirim ke server di belakang.
   * Kalau server gagal: tampilkan pesan dan muat ulang data asli dari server.
   */
  const instant = useCallback((applyLocal, remote) => {
    setError(null)
    applyLocal()
    const job = (async () => {
      try {
        return await remote()
      } catch (e) {
        showError(e)
        refreshAll().catch(() => {})
        throw e
      }
    })()
    job.catch(() => {})
    // selesai seketika untuk tampilan; proses server tetap berjalan di belakang
    const done = Promise.resolve()
    done.job = job
    return done
  }, [showError, refreshAll])

  const bump = useCallback((walletId, delta) => {
    if (!delta) return
    setBalances((b) => ({ ...b, [walletId ?? '']: (b[walletId ?? ''] || 0) + delta }))
  }, [])

  // id sementara -> janji id asli (supaya "Batal" / edit cepat tetap aman)
  const pending = useRef(new Map())
  const realId = async (id) => (isTmp(id) && pending.current.has(id) ? pending.current.get(id) : id)

  // ---------- actions ----------
  const actions = useMemo(() => {
    const withCf = (row) => ({ ...row, cashflow_id: cfId })
    const inPeriod = (date) => period && date >= period.start_date && date <= period.end_date

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

    // ----- generik: simpan baris dengan update instan -----
    const saveRow = ({ table, setList, row, sort, onLocal }) => {
      const { id, ...rest } = row
      if (id) {
        let before = null
        return instant(() => {
          setList((list) => {
            before = list.find((x) => x.id === id)
            const next = list.map((x) => (x.id === id ? { ...x, ...rest } : x))
            return sort ? [...next].sort(sort) : next
          })
          onLocal?.(before, { ...before, ...rest })
        }, async () => {
          const rid = await realId(id)
          markMine(rid)
          must(await supabase.from(table).update(rest).eq('id', rid))
        })
      }
      const tid = tmpId()
      const local = { id: tid, created_at: nowIso(), created_by: user.id, cashflow_id: cfId, ...rest }
      const { job } = instant(() => {
        setList((list) => (sort ? [...list, local].sort(sort) : [...list, local]))
        onLocal?.(null, local)
      }, async () => {
        const saved = must(await supabase.from(table).insert(withCf(rest)).select().single())
        markMine(saved.id)
        setList((list) => list.map((x) => (x.id === tid ? saved : x)))
        return saved
      })
      pending.current.set(tid, job.then((sv) => sv.id).catch(() => null))
      return Promise.resolve(local)
    }
    const deleteRow = ({ table, setList, id, onLocal }) => {
      let before = null
      return instant(() => {
        setList((list) => { before = list.find((x) => x.id === id); return list.filter((x) => x.id !== id) })
        onLocal?.(before)
      }, async () => {
        const rid = await realId(id)
        if (!rid || isTmp(rid)) return
        markMine(rid)
        must(await supabase.from(table).delete().eq('id', rid))
      })
    }

    // efek ke saldo lokasi
    const moneyEffect = (sign) => (before, after) => {
      if (before) bump(before.wallet_id, -sign * Number(before.amount))
      if (after) bump(after.wallet_id, sign * Number(after.amount))
      reconcileBalances()
    }

    return {
      clearError: () => setError(null),
      selectPeriod: setSelectedId,
      refreshAll,

      // ----- profil & cashflow (jarang, cukup tunggu server) -----
      updateProfile: (patch) => run(async () => {
        const clean = { ...patch }
        if (clean.username != null) clean.username = clean.username.trim().toLowerCase() || null
        const { error: err } = await supabase.from('profiles').update(clean).eq('id', user.id)
        if (err) throw new Error(err.code === '23505' ? 'Username sudah dipakai orang lain.'
          : err.code === '23514' ? 'Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.' : err.message)
        setProfile((p) => ({ ...p, ...clean }))
        setMembers((ms) => ms.map((m) => (m.user_id === user.id ? { ...m, profile: { ...m.profile, ...clean } } : m)))
      }),
      setAvatar: (file) => run(async () => {
        const path = await uploadPhoto(`u/${user.id}`, 'avatar', file, 512)
        const old = profile?.avatar_path
        must(await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id))
        setProfile((p) => ({ ...p, avatar_path: path }))
        setMembers((ms) => ms.map((m) => (m.user_id === user.id ? { ...m, profile: { ...m.profile, avatar_path: path } } : m)))
        if (old) removePhoto(old)
      }),
      removeAvatar: () => run(async () => {
        const old = profile?.avatar_path
        must(await supabase.from('profiles').update({ avatar_path: null }).eq('id', user.id))
        setProfile((p) => ({ ...p, avatar_path: null }))
        setMembers((ms) => ms.map((m) => (m.user_id === user.id ? { ...m, profile: { ...m.profile, avatar_path: null } } : m)))
        if (old) removePhoto(old)
      }),
      setCashflowPhoto: (file) => run(async () => {
        const path = await uploadPhoto(`cf/${cfId}`, 'photo', file, 900)
        const old = cashflow?.photo_path
        must(await supabase.from('cashflows').update({ photo_path: path }).eq('id', cfId))
        setCashflow((c) => ({ ...c, photo_path: path }))
        if (old) removePhoto(old)
      }),
      removeCashflowPhoto: () => run(async () => {
        const old = cashflow?.photo_path
        must(await supabase.from('cashflows').update({ photo_path: null }).eq('id', cfId))
        setCashflow((c) => ({ ...c, photo_path: null }))
        if (old) removePhoto(old)
      }),
      updateCashflow: (patch) => instant(
        () => {
          setCashflow((c) => ({ ...c, ...patch }))
          if (patch.name) setMyCashflows((l) => l.map((c) => (c.id === cfId ? { ...c, name: patch.name } : c)))
        },
        async () => { markMine(cfId); must(await supabase.from('cashflows').update(patch).eq('id', cfId)) },
      ),
      regenerateCode: () => run(async () => {
        const code = must(await supabase.rpc('regenerate_invite_code', { cf: cfId }))
        setCashflow((c) => ({ ...c, invite_code: code }))
      }),
      joinCashflow: (code) => run(async () => {
        must(await supabase.rpc('join_cashflow', { code }))
        selRef.current = null
        await refreshAll({ keepPeriod: false })
      }),
      switchCashflow: (cf) => run(async () => {
        must(await supabase.rpc('switch_cashflow', { cf }))
        selRef.current = null
        await refreshAll({ keepPeriod: false })
      }),
      leaveCashflow: () => run(async () => {
        must(await supabase.rpc('leave_cashflow', { cf: cfId }))
        selRef.current = null
        await refreshAll({ keepPeriod: false })
      }),

      // ----- periode -----
      createPeriod: ({ start_date, end_date, firstIncome, rollover }) => run(async () => {
        const clash = periods.find((p) => p.start_date <= end_date && p.end_date >= start_date)
        if (clash) throw new Error(`Tanggal bertumpuk dengan periode ${fmtRange(clash.start_date, clash.end_date)}. Ubah dulu tanggal periode itu (ikon pensil).`)
        const prev = periods.find((p) => p.start_date < start_date)
        const created = must(await supabase.from('periods').insert(withCf({ start_date, end_date })).select().single())
        const inserts = []
        if (firstIncome?.amount) {
          inserts.push(withCf({ period_id: created.id, name: firstIncome.name || 'Gaji', amount: firstIncome.amount, date: start_date, wallet_id: firstIncome.wallet_id ?? null }))
        }
        if (rollover > 0) {
          inserts.push(withCf({ period_id: created.id, name: 'Sisa bulan lalu', amount: rollover, date: start_date, is_rollover: true }))
        }
        await Promise.all([
          inserts.length ? supabase.from('incomes').insert(inserts).then(must) : null,
          prev ? copyRecurring(prev, created) : null,
        ])
        selRef.current = created.id
        await refreshAll()
        return created
      }),
      updatePeriod: (id, { start_date, end_date }) => run(async () => {
        if (end_date < start_date) throw new Error('Tanggal akhir harus setelah tanggal mulai.')
        const clash = periods.find((p) => p.id !== id && p.start_date <= end_date && p.end_date >= start_date)
        if (clash) throw new Error(`Tanggal bertumpuk dengan periode ${fmtRange(clash.start_date, clash.end_date)}.`)
        must(await supabase.from('periods').update({ start_date, end_date }).eq('id', id))
        markMine(id)
        await refreshAll()
      }),
      deletePeriod: (id) => run(async () => {
        must(await supabase.from('periods').delete().eq('id', id))
        selRef.current = null
        await refreshAll({ keepPeriod: false })
      }),
      /** Saldo akhir sebuah periode: dana masuk − tagihan dibayar − pengeluaran. */
      periodSaldo: async (p) => {
        const [i, b, e] = await Promise.all([
          supabase.from('incomes').select('amount').eq('period_id', p.id),
          supabase.from('bills').select('amount').eq('cashflow_id', cfId).eq('paid', true).gte('due_date', p.start_date).lte('due_date', p.end_date),
          supabase.from('expenses').select('amount').eq('cashflow_id', cfId).gte('date', p.start_date).lte('date', p.end_date),
        ])
        const sum = (r) => must(r).reduce((a, x) => a + Number(x.amount), 0)
        return sum(i) - sum(b) - sum(e)
      },

      // ----- pengeluaran (instan) -----
      saveExpense: (exp) => {
        // pengeluaran di luar periode yang tampil: cukup simpan, tidak masuk daftar
        if (!exp.id && !inPeriod(exp.date)) {
          return run(async () => {
            const s = must(await supabase.from('expenses').insert(withCf(exp)).select().single())
            markMine(s.id); bump(s.wallet_id, -Number(s.amount)); reconcileBalances()
            return s
          })
        }
        return saveRow({
          table: 'expenses', setList: setExpenses, row: exp, sort: byExpenseOrder,
          onLocal: (before, after) => moneyEffect(-1)(before, after),
        })
      },
      deleteExpense: (id) => deleteRow({
        table: 'expenses', setList: setExpenses, id,
        onLocal: (before) => before && moneyEffect(-1)(before, null),
      }),
      quickAdd: (t, date) => saveRow({
        table: 'expenses', setList: setExpenses, sort: byExpenseOrder,
        row: { amount: t.amount, category_id: t.category_id, wallet_id: t.wallet_id, note: t.label, date: date || today },
        onLocal: (before, after) => moneyEffect(-1)(before, after),
      }),

      // ----- dana masuk (instan) -----
      saveIncome: (inc) => saveRow({
        table: 'incomes', setList: setIncomes, sort: byDateAsc('date'),
        row: inc.id ? inc : { ...inc, period_id: period.id },
        onLocal: (before, after) => {
          if (before?.is_rollover || after?.is_rollover) return
          moneyEffect(1)(before, after)
        },
      }),
      deleteIncome: (id) => deleteRow({
        table: 'incomes', setList: setIncomes, id,
        onLocal: (before) => before && !before.is_rollover && moneyEffect(1)(before, null),
      }),

      // ----- tagihan (instan) -----
      saveBill: (bill) => saveRow({
        table: 'bills', setList: setBills, row: bill, sort: byDateAsc('due_date'),
        onLocal: (before, after) => {
          if (before?.paid) bump(before.wallet_id, Number(before.amount))
          if (after?.paid) bump(after.wallet_id, -Number(after.amount))
          reconcileBalances()
        },
      }),
      deleteBill: (bill) => instant(() => {
        setBills((l) => l.filter((x) => x.id !== bill.id))
        if (bill.paid) { bump(bill.wallet_id, Number(bill.amount)); reconcileBalances() }
        if (bill.payment_id) setPayments((l) => l.filter((x) => x.id !== bill.payment_id))
      }, async () => {
        const rid = await realId(bill.id)
        markMine(rid)
        if (bill.payment_id) { markMine(bill.payment_id); must(await supabase.from('debt_payments').delete().eq('id', bill.payment_id)) }
        if (rid && !isTmp(rid)) must(await supabase.from('bills').delete().eq('id', rid))
      }),
      toggleBillPaid: (bill) => {
        const paid = !bill.paid
        const paid_at = paid ? today : null
        const linked = bill.kind === 'debt' && bill.debt_id
        const tmpPay = linked && paid ? { id: tmpId(), cashflow_id: cfId, debt_id: bill.debt_id, amount: bill.amount, date: today, note: bill.name, created_at: nowIso() } : null
        return instant(() => {
          setBills((l) => l.map((x) => (x.id === bill.id ? { ...x, paid, paid_at } : x)))
          bump(bill.wallet_id, paid ? -Number(bill.amount) : Number(bill.amount))
          if (tmpPay) setPayments((l) => [tmpPay, ...l])
          if (linked && !paid && bill.payment_id) setPayments((l) => l.filter((x) => x.id !== bill.payment_id))
          reconcileBalances()
        }, async () => {
          const rid = await realId(bill.id)
          markMine(rid)
          let payment_id = bill.payment_id
          if (tmpPay) {
            const pay = must(await supabase.from('debt_payments')
              .insert(withCf({ debt_id: bill.debt_id, amount: bill.amount, date: today, note: bill.name })).select().single())
            markMine(pay.id)
            payment_id = pay.id
            setPayments((l) => l.map((x) => (x.id === tmpPay.id ? pay : x)))
          } else if (linked && !paid && payment_id) {
            markMine(payment_id)
            must(await supabase.from('debt_payments').delete().eq('id', payment_id))
            payment_id = null
          }
          must(await supabase.from('bills').update({ paid, paid_at, payment_id }).eq('id', rid))
          setBills((l) => l.map((x) => (x.id === bill.id || x.id === rid ? { ...x, payment_id } : x)))
        })
      },

      // ----- jatah manual (instan) -----
      setWeekAmount: (week_index, amount) => {
        const pid = period.id
        return instant(() => {
          setOverrides((l) => {
            const rest = l.filter((o) => !(o.period_id === pid && o.week_index === week_index))
            return amount == null ? rest : [...rest, { id: tmpId(), period_id: pid, week_index, day: null, amount }]
          })
        }, async () => {
          if (amount == null) must(await supabase.from('budget_overrides').delete().eq('period_id', pid).eq('week_index', week_index))
          else {
            const s = must(await supabase.from('budget_overrides')
              .upsert(withCf({ period_id: pid, week_index, amount }), { onConflict: 'period_id,week_index' }).select().single())
            markMine(s.id)
          }
        })
      },
      setDayAmount: (day, amount) => {
        const pid = period.id
        return instant(() => {
          setOverrides((l) => {
            const rest = l.filter((o) => !(o.period_id === pid && o.day === day))
            return amount == null ? rest : [...rest, { id: tmpId(), period_id: pid, week_index: null, day, amount }]
          })
        }, async () => {
          if (amount == null) must(await supabase.from('budget_overrides').delete().eq('period_id', pid).eq('day', day))
          else {
            const s = must(await supabase.from('budget_overrides')
              .upsert(withCf({ period_id: pid, day, amount }), { onConflict: 'period_id,day' }).select().single())
            markMine(s.id)
          }
        })
      },

      // ----- template cepat (instan) -----
      saveTemplate: (t) => saveRow({ table: 'quick_templates', setList: setTemplates, row: t.id ? t : { ...t, sort: templates.length } }),
      deleteTemplate: (id) => deleteRow({ table: 'quick_templates', setList: setTemplates, id }),

      // ----- kategori -----
      saveCategory: (cat) => saveRow({ table: 'categories', setList: setCategories, row: cat.id ? cat : { ...cat, sort: categories.length } }),
      deleteCategory: (id) => deleteRow({
        table: 'categories', setList: setCategories, id,
        onLocal: () => setExpenses((l) => l.map((e) => (e.category_id === id ? { ...e, category_id: null } : e))),
      }),

      // ----- hutang (instan) -----
      saveDebt: (debt) => saveRow({ table: 'debts', setList: setDebts, row: debt, sort: (a, b) => (a.created_at < b.created_at ? 1 : -1) }),
      deleteDebt: (id) => deleteRow({
        table: 'debts', setList: setDebts, id,
        onLocal: () => setPayments((l) => l.filter((p) => p.debt_id !== id)),
      }),
      addPayment: (p) => saveRow({ table: 'debt_payments', setList: setPayments, row: p, sort: (a, b) => (a.date < b.date ? 1 : -1) }),
      deletePayment: (id) => deleteRow({
        table: 'debt_payments', setList: setPayments, id,
        onLocal: () => setBills((l) => l.map((b) => (b.payment_id === id ? { ...b, payment_id: null } : b))),
      }),

      // ----- lokasi dana -----
      saveWallet: ({ id, iconFile, removeIcon, ...rest }, current) => run(async () => {
        const patch = { ...rest }
        if (iconFile) patch.icon_path = await uploadPhoto(`cf/${cfId}`, 'wallet', iconFile, 256)
        if (removeIcon) patch.icon_path = null
        if (id) {
          must(await supabase.from('wallets').update(patch).eq('id', id))
          markMine(id)
          setWallets((l) => l.map((w) => (w.id === id ? { ...w, ...patch } : w)))
        } else {
          const s = must(await supabase.from('wallets').insert(withCf({ ...patch, sort: wallets.length })).select().single())
          markMine(s.id)
          setWallets((l) => [...l, s])
        }
        if ((iconFile || removeIcon) && current?.icon_path) removePhoto(current.icon_path)
      }),
      deleteWallet: (w) => run(async () => {
        must(await supabase.from('wallets').delete().eq('id', w.id))
        if (w.icon_path) removePhoto(w.icon_path)
        await refreshAll() // transaksi lokasi ini kembali ke Unlocated
      }),
      saveTransfer: (t) => saveRow({
        table: 'wallet_transfers', setList: setTransfers, row: t,
        sort: (a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1),
        onLocal: (before, after) => {
          if (before) { bump(before.from_wallet, Number(before.amount)); bump(before.to_wallet, -Number(before.amount)) }
          if (after) { bump(after.from_wallet, -Number(after.amount)); bump(after.to_wallet, Number(after.amount)) }
          reconcileBalances()
        },
      }),
      deleteTransfer: (id) => deleteRow({
        table: 'wallet_transfers', setList: setTransfers, id,
        onLocal: (before) => {
          if (before) { bump(before.from_wallet, Number(before.amount)); bump(before.to_wallet, -Number(before.amount)) }
          reconcileBalances()
        },
      }),
    }
  }, [cfId, user.id, profile, cashflow, run, instant, bump, reconcileBalances, refreshAll, periods, period, today,
      categories.length, wallets.length, templates.length])

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
    ready, syncing, error, today, user,
    profile, cashflow, myCashflows, members, memberName, payday,
    categories, catById, periods, period, nextRange,
    incomes, bills, billsThis, billsNext, overrides, expenses,
    plan, status, spentByDate, spentTotal, saldo,
    debts: debtsView,
    wallets, walletById, balances, transfers, totalMoney, templates,
    ...actions,
  }

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export const useData = () => useContext(DataCtx)
