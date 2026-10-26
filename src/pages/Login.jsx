import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const fn = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    const { data, error } = await fn
    setBusy(false)
    if (error) return setMsg({ type: 'err', text: translate(error.message) })
    if (mode === 'signup' && !data.session) {
      setMsg({ type: 'ok', text: 'Akun dibuat. Cek email Anda untuk konfirmasi, lalu masuk.' })
      setMode('login')
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-gradient-to-b from-accent-soft to-bg">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="relative mx-auto mb-5 w-36">
            <img src="/img/login.webp" alt="" className="w-36 h-48 object-cover rounded-[28px] ring-4 ring-card shadow-xl rotate-[-3deg]" />
            <span className="absolute -bottom-2 -right-3 size-10 rounded-full bg-card shadow grid place-items-center text-lg">💗</span>
          </div>
          <h1 className="text-2xl font-semibold">Duit Kara</h1>
          <p className="text-sm text-muted mt-1">Atur gaji, budget harian, dan hutang.</p>
        </div>

        <form onSubmit={submit} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-soft rounded-xl">
            {[['login', 'Masuk'], ['signup', 'Daftar']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => { setMode(k); setMsg(null) }}
                className={`h-9 rounded-lg text-sm ${mode === k ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{l}</button>
            ))}
          </div>
          <label className="block">
            <span className="label">Email</span>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
              required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {msg && (
            <p className={`text-sm rounded-xl px-3 py-2 ${msg.type === 'err' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent'}`}>
              {msg.text}
            </p>
          )}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Buat akun'}
          </button>
        </form>
      </div>
    </div>
  )
}

function translate(m) {
  if (/Invalid login/i.test(m)) return 'Email atau password salah.'
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek kotak masuk email Anda.'
  if (/already registered/i.test(m)) return 'Email sudah terdaftar. Silakan masuk.'
  if (/at least 6/i.test(m)) return 'Password minimal 6 karakter.'
  return m
}
