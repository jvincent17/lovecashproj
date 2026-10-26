# Duit Kara

Web app untuk mengatur gaji bulanan, budget mingguan dan harian (sisa atau minus dibawa ke hari berikutnya), pengeluaran per kategori, serta hutang dan piutang.
Responsif untuk desktop dan mobile.

**Stack:** React + Vite + Tailwind CSS · Supabase (login & database) · Cloudflare Workers (hosting, lihat `wrangler.jsonc`)

---

## 1. Siapkan database Supabase

1. Buka project Anda di [supabase.com](https://supabase.com).
2. Pilih menu **SQL Editor** → **New query**.
3. Salin seluruh isi `supabase/schema.sql`, tempel, lalu klik **Run**. Pastikan hasilnya *Success*.
4. Pilih menu **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:5173` (diganti dengan URL Cloudflare setelah deploy).
5. Opsional: kalau tidak ingin wajib konfirmasi email saat daftar, buka **Authentication** → **Sign In / Providers** → **Email** dan matikan **Confirm email**.

## 2. Hubungkan aplikasi ke Supabase

1. Di Supabase, buka **Project Settings** → **API** (atau **Data API**). Salin **Project URL** dan **anon / publishable key**.
2. Di folder project, salin `.env.example` menjadi `.env`, lalu isi:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
   File `.env` tidak ikut ter-upload ke GitHub karena sudah masuk `.gitignore`.

## 3. Jalankan di laptop

Butuh Node.js 20.19+ atau 22+.

```bash
npm install
npm run dev
```

Buka http://localhost:5173, daftar akun, lalu mulai dari menu **Bulan** untuk mengisi gaji dan pos tetap.

Untuk menguji logika budget: `npm test`.

## 4. Upload ke GitHub

```bash
git init
git add .
git commit -m "Initial commit Duit Kara"
git branch -M main
git remote add origin https://github.com/jvincent17/lovecashproj.git
git push -u origin main
```

## 5. Deploy gratis ke Cloudflare Pages

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → tab **Pages** → **Connect to Git**, lalu pilih repo `lovecashproj`.
2. Isi pengaturan build:
   - Framework preset: **Vite** (atau React (Vite))
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Di **Environment variables**, tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dengan nilai yang sama seperti di `.env`.
4. Klik **Save and Deploy**. Hasilnya adalah URL seperti `https://lovecashproj.pages.dev`.
5. Kembali ke Supabase → **Authentication** → **URL Configuration**:
   - Ganti **Site URL** dengan URL `.pages.dev` Anda.
   - Tambahkan `http://localhost:5173` di **Redirect URLs** supaya tetap bisa login saat development.

Setelah itu, setiap `git push` ke branch `main` akan otomatis ter-deploy ulang.

---

## Cara kerja

- **Cashflow bersama:** semua data milik satu cashflow (dompet). Di **Pengaturan** ada kode undangan 6 huruf. Pasangan cukup memilih **Gabung dengan kode**, lalu keduanya melihat dan mengisi data yang sama.
- **Login** bisa memakai username atau email. Username diatur di Pengaturan → Profil.
- **Periode** berjalan dari tanggal gajian sampai sehari sebelum gajian berikutnya.
- **Pemasukan** bisa lebih dari satu per periode (Gaji, Bonus, Freelance, dll.).
- **Tagihan** masuk ke periode sesuai tanggal jatuh temponya, dan bisa dilihat untuk bulan ini maupun bulan depan. Tagihan yang dicentang (sudah dibayar) mengurangi **Saldo**. Tagihan bertanda "ulangi setiap bulan" otomatis disalin saat periode baru dibuat. Tagihan jenis Cicilan/Kredit bisa dihubungkan ke catatan hutang.
- **Budget harian/mingguan** = total pemasukan − semua tagihan periode itu. Nilainya dibagi ke minggu (per 7 hari sejak tanggal gajian), lalu ke hari. Jatah minggu atau hari bisa diatur manual.
- **Sisa harian dibawa ke hari berikutnya.** Jatah hari ini bisa diubah langsung dari halaman **Hari ini**.
- **Saldo** = pemasukan − tagihan yang sudah dibayar − pengeluaran.

## Struktur folder

```
supabase/schema.sql      Skema database + Row Level Security
src/lib/budget.js        Logika pembagian budget & carry-over (+ test)
src/lib/dates.js         Helper tanggal & periode gajian
src/context/             Auth & data (semua query Supabase)
src/pages/               Hari ini, Minggu, Bulan, Hutang, Pengaturan, Login
src/components/          Komponen UI (sheet, input nominal, dll.)
```
