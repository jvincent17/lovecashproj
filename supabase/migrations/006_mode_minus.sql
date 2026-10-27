-- =============================================================
-- Duit Kara - migrasi 006: pilihan cara menangani minus harian
-- 'next'   = bawa penuh ke hari berikutnya (default, seperti sebelumnya)
-- 'spread' = bagi rata ke sisa hari di minggu yang sama
-- Data yang ada TIDAK diubah.
-- =============================================================
alter table public.cashflows add column if not exists carry_mode text not null default 'next';
do $$ begin
  alter table public.cashflows add constraint cashflows_carry_mode_check check (carry_mode in ('next','spread'));
exception when duplicate_object then null; end $$;
