// Export data ke Excel (.xlsx). Library dimuat hanya saat dibutuhkan.
const bold = (value) => ({ value, fontWeight: 'bold' })
const num = (n) => ({ value: Number(n) || 0, type: Number, format: '#,##0' })
const day = (iso) => (iso ? { value: new Date(`${iso}T00:00:00Z`), type: Date, format: 'dd/mm/yyyy' } : null)

async function save(sheets, fileName) {
  const { default: writeExcelFile } = await import('write-excel-file/universal')
  const blob = await writeExcelFile(sheets).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const wName = (walletById, id) => (id ? walletById[id]?.name ?? '-' : 'Unlocated Money')

/** Satu periode lengkap: ringkasan, dana masuk, tagihan, pengeluaran. */
export async function exportPeriod({ period, plan, saldo, spentTotal, incomes, bills, expenses, catById, walletById, memberName }) {
  const summary = [
    [bold('Duit Kara — ringkasan periode'), null],
    ['Periode', `${period.start_date} s/d ${period.end_date}`],
    ['Dana bulan ini', num(plan.income)],
    ['Total tagihan', num(plan.billsTotal)],
    ['Tagihan sudah dibayar', num(plan.billsPaid)],
    ['Budget harian/mingguan', num(plan.flexible)],
    ['Total pengeluaran', num(spentTotal)],
    ['Saldo', num(saldo)],
  ]
  const inc = [
    ['Tanggal', 'Nama', 'Nominal', 'Lokasi', 'Diinput oleh'].map(bold),
    ...incomes.map((i) => [day(i.date), i.name + (i.is_rollover ? ' (sisa bulan lalu)' : ''), num(i.amount), wName(walletById, i.wallet_id), memberName(i.created_by)]),
  ]
  const bil = [
    ['Jatuh tempo', 'Nama', 'Jenis', 'Nominal', 'Status', 'Dibayar', 'Lokasi'].map(bold),
    ...bills.map((b) => [day(b.due_date), b.name, { bill: 'Tagihan', saving: 'Tabungan', debt: 'Cicilan/Kredit' }[b.kind], num(b.amount),
      b.paid ? 'Lunas' : 'Belum', day(b.paid_at), wName(walletById, b.wallet_id)]),
  ]
  const exp = [
    ['Tanggal', 'Kategori', 'Catatan', 'Nominal', 'Lokasi', 'Diinput oleh'].map(bold),
    ...[...expenses].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => [day(e.date), catById[e.category_id]?.name ?? 'Tanpa kategori',
      e.note ?? '', num(e.amount), wName(walletById, e.wallet_id), memberName(e.created_by)]),
  ]
  await save([
    { data: summary, sheet: 'Ringkasan', columns: [{ width: 26 }, { width: 26 }] },
    { data: inc, sheet: 'Dana masuk', columns: [{ width: 12 }, { width: 28 }, { width: 14 }, { width: 18 }, { width: 16 }], stickyRowsCount: 1 },
    { data: bil, sheet: 'Tagihan', columns: [{ width: 12 }, { width: 30 }, { width: 15 }, { width: 14 }, { width: 9 }, { width: 12 }, { width: 18 }], stickyRowsCount: 1 },
    { data: exp, sheet: 'Pengeluaran', columns: [{ width: 12 }, { width: 18 }, { width: 30 }, { width: 14 }, { width: 18 }, { width: 16 }], stickyRowsCount: 1 },
  ], `duit-kara_${period.start_date}_${period.end_date}.xlsx`)
}

/** Daftar transaksi hasil filter di halaman Riwayat. */
export async function exportRows(rows, { catById, walletById, memberName }, fileName) {
  const data = [
    ['Tanggal', 'Jenis', 'Kategori / Nama', 'Catatan', 'Nominal', 'Lokasi', 'Diinput oleh'].map(bold),
    ...rows.map((r) => [day(r.date), r.kind === 'income' ? 'Dana masuk' : 'Pengeluaran',
      r.kind === 'income' ? r.name : catById[r.category_id]?.name ?? 'Tanpa kategori', r.kind === 'income' ? '' : r.note ?? '',
      num(r.kind === 'income' ? r.amount : -r.amount), wName(walletById, r.wallet_id), memberName(r.created_by)]),
  ]
  await save([{ data, sheet: 'Transaksi', columns: [{ width: 12 }, { width: 13 }, { width: 22 }, { width: 30 }, { width: 14 }, { width: 18 }, { width: 16 }], stickyRowsCount: 1 }], fileName)
}
