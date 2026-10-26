import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext.jsx'
import Avatar from './Avatar.jsx'

export default function NoPeriod() {
  const { profile } = useData()
  return (
    <div className="card p-8 text-center space-y-3">
      <div className="flex justify-center"><Avatar path={profile?.avatar_path} name={profile?.display_name || profile?.username} className="size-20 text-2xl" /></div>
      <h2 className="font-semibold">Mulai periode bulan ini</h2>
      <p className="text-sm text-muted">Masukkan pemasukan dan tagihan, nanti budget mingguan & harian dibagi otomatis.</p>
      <Link to="/bulan" className="btn-primary">Mulai</Link>
    </div>
  )
}
