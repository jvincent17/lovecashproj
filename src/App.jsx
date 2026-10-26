import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { isConfigured } from './lib/supabase.js'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Today from './pages/Today.jsx'
import Week from './pages/Week.jsx'
import Month from './pages/Month.jsx'
import Debts from './pages/Debts.jsx'
import Settings from './pages/Settings.jsx'

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="min-h-dvh grid place-items-center text-muted text-sm">Memuat…</div>
  if (!session) return <Login />
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="minggu" element={<Week />} />
          <Route path="bulan" element={<Month />} />
          <Route path="hutang" element={<Debts />} />
          <Route path="pengaturan" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}

export default function App() {
  if (!isConfigured) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="card p-6 max-w-md text-sm space-y-2">
          <h1 className="text-lg font-semibold">Supabase belum dikonfigurasi</h1>
          <p className="text-muted">
            Salin <code>.env.example</code> menjadi <code>.env</code>, isi <code>VITE_SUPABASE_URL</code> dan{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>, lalu jalankan ulang <code>npm run dev</code>.
          </p>
        </div>
      </div>
    )
  }
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
