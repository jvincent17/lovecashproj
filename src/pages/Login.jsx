import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [ident, setIdent] = useState('') // username atau email (masuk)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const fail = (text) => { setBusy(false); setMsg({ type: 'err', text }) }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)

    if (mode === 'login') {
      let loginEmail = ident.trim()
      if (!loginEmail.includes('@')) {
        const { data, error } = await supabase.rpc('email_for_username', { uname: loginEmail })
        if (error) return fail(error.message)
        if (!data) return fail('Username tidak ditemukan.')
        loginEmail = data
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
      if (error) return fail(translate(error.message))
      return
    }

    const uname = username.trim().toLowerCase()
    if (!/^[a-z0-9_.]{3,20}$/.test(uname)) return fail('Username 3–20 karakter: huruf kecil, angka, titik, atau garis bawah.')
    const { data: free, error: e1 } = await supabase.rpc('username_available', { uname })
    if (e1) return fail(e1.message)
    if (!free) return fail('Username sudah dipakai, coba yang lain.')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { username: uname }, emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) return fail(translate(error.message))
    if (!data.session) {
      setMsg({ type: 'ok', text: 'Akun dibuat. Cek email untuk konfirmasi, lalu masuk.' })
      setMode('login')
      setIdent(uname)
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
          <p className="text-sm text-muted mt-1">Atur pemasukan, budget harian, dan tagihan berdua.</p>
        </div>

        <form onSubmit={submit} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-soft rounded-xl">
            {[['login', 'Masuk'], ['signup', 'Daftar']].map(([k, l]) => (
              <button type="button" key={k} onClick={() => { setMode(k); setMsg(null) }}
                className={`h-9 rounded-lg text-sm ${mode === k ? 'bg-card shadow-sm font-medium' : 'text-muted'}`}>{l}</button>
            ))}
          </div>
          {mode === 'login' ? (
            <label className="block">
              <span className="label">Username atau email</span>
              <input className="input" value={ident} onChange={(e) => setIdent(e.target.value)} required
                autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="label">Username</span>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required
                  autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="cth. kara" />
              </label>
              <label className="block">
                <span className="label">Email</span>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
            </>
          )}
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
  if (/Invalid login/i.test(m)) return 'Username/email atau password salah.'
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Cek kotak masuk email Anda.'
  if (/already registered/i.test(m)) return 'Email sudah terdaftar. Silakan masuk.'
  if (/at least 6/i.test(m)) return 'Password minimal 6 karakter.'
  return m
}
