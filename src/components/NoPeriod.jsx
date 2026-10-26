import { Link } from 'react-router-dom'

export default function NoPeriod() {
  return (
    <div className="card p-8 text-center space-y-3">
      <img src="/img/avatar.webp" alt="" className="mx-auto size-20 rounded-full object-cover ring-4 ring-accent-soft" />
      <h2 className="font-semibold">Mulai dengan gaji bulan ini</h2>
      <p className="text-sm text-muted">Masukkan gaji dan pos tetap, nanti budget mingguan & harian dibagi otomatis.</p>
      <Link to="/bulan" className="btn-primary">Atur gaji</Link>
    </div>
  )
}
