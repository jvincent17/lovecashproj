-- =============================================================
-- Duit Kara - migrasi 004: sisa bulan lalu, batas kategori, template cepat,
-- periode tidak boleh bertumpuk, sinkron realtime.
-- Jalankan SEKALI di Supabase SQL Editor. Data yang ada TIDAK dihapus.
-- =============================================================

-- Dana "Sisa bulan lalu": dihitung di budget, tapi TIDAK menambah saldo lokasi dana
-- (uangnya memang sudah ada di lokasi masing-masing).
alter table public.incomes add column if not exists is_rollover boolean not null default false;

-- Batas pengeluaran per kategori per periode (kosong = tanpa batas)
alter table public.categories add column if not exists monthly_limit numeric(14,0) check (monthly_limit is null or monthly_limit > 0);

-- Template transaksi cepat
create table if not exists public.quick_templates (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  label       text not null,
  amount      numeric(14,0) not null check (amount > 0),
  category_id uuid references public.categories on delete set null,
  wallet_id   uuid references public.wallets on delete set null,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.quick_templates enable row level security;
drop policy if exists "cashflow members" on public.quick_templates;
create policy "cashflow members" on public.quick_templates for all to authenticated
  using (public.is_member(cashflow_id)) with check (public.is_member(cashflow_id));
grant select, insert, update, delete on public.quick_templates to authenticated;

-- Saldo lokasi: abaikan dana "Sisa bulan lalu" supaya tidak dihitung dua kali
create or replace function public.wallet_balances(cf uuid)
returns table (wallet_id uuid, balance numeric)
language sql stable security definer set search_path = public as $$
  with mv as (
    select i.wallet_id, i.amount from incomes i where i.cashflow_id = cf and not i.is_rollover
    union all select e.wallet_id, -e.amount from expenses e where e.cashflow_id = cf
    union all select b.wallet_id, -b.amount from bills b where b.cashflow_id = cf and b.paid
    union all select t.to_wallet, t.amount from wallet_transfers t where t.cashflow_id = cf
    union all select t.from_wallet, -t.amount from wallet_transfers t where t.cashflow_id = cf
  )
  select mv.wallet_id, sum(mv.amount) from mv where public.is_member(cf) group by mv.wallet_id
$$;

-- Periode dalam satu cashflow tidak boleh bertumpuk
create extension if not exists btree_gist with schema extensions;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'periods_no_overlap') then
    begin
      alter table public.periods add constraint periods_no_overlap
        exclude using gist (cashflow_id with =, daterange(start_date, end_date, '[]') with &&);
    exception when others then
      raise notice 'Periode yang bertumpuk sudah ada, rapikan dulu lewat aplikasi lalu jalankan ulang bagian ini. (%)', sqlerrm;
    end;
  end if;
end $$;

-- Sinkron realtime antar-pasangan
do $$
declare t text;
begin
  foreach t in array array['incomes','expenses','bills','periods','budget_overrides','wallets','wallet_transfers',
                           'debts','debt_payments','categories','quick_templates','cashflows','cashflow_members']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null; -- sudah terdaftar / publikasi tidak ada
    end;
  end loop;
end $$;
