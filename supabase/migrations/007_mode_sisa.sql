-- =============================================================
-- Duit Kara - migrasi 007: pilihan cara menangani SISA (lebih) harian
-- 'next'   = seluruh sisa masuk ke jatah 1 hari berikutnya (default)
-- 'spread' = sisa dibagi rata ke sisa hari di minggu yang sama
-- Data yang ada TIDAK diubah.
-- =============================================================
alter table public.cashflows add column if not exists surplus_mode text not null default 'next';
do $$ begin
  alter table public.cashflows add constraint cashflows_surplus_mode_check check (surplus_mode in ('next','spread'));
exception when duplicate_object then null; end $$;
