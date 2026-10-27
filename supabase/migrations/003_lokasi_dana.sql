-- =============================================================
-- Duit Kara - migrasi 003: lokasi dana (GoPay, Cash, Bank, dll.)
-- Jalankan SEKALI di Supabase SQL Editor. Data yang ada TIDAK dihapus.
-- Transaksi tanpa lokasi otomatis dihitung sebagai "Unlocated Money".
-- =============================================================

create table if not exists public.wallets (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  name        text not null,
  emoji       text not null default '👛',
  icon_path   text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.wallet_transfers (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  from_wallet uuid references public.wallets on delete set null,  -- null = Unlocated Money
  to_wallet   uuid references public.wallets on delete set null,  -- null = Unlocated Money
  amount      numeric(14,0) not null check (amount > 0),
  date        date not null default current_date,
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.incomes  add column if not exists wallet_id uuid references public.wallets on delete set null;
alter table public.expenses add column if not exists wallet_id uuid references public.wallets on delete set null;
alter table public.bills    add column if not exists wallet_id uuid references public.wallets on delete set null;

create index if not exists wallets_cf_idx on public.wallets (cashflow_id);
create index if not exists wallet_transfers_cf_idx on public.wallet_transfers (cashflow_id, date);

do $$
declare t text;
begin
  foreach t in array array['wallets','wallet_transfers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "cashflow members" on public.%I', t);
    execute format(
      'create policy "cashflow members" on public.%I for all to authenticated
         using (public.is_member(cashflow_id)) with check (public.is_member(cashflow_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Saldo tiap lokasi (sepanjang waktu). wallet_id null = Unlocated Money.
create or replace function public.wallet_balances(cf uuid)
returns table (wallet_id uuid, balance numeric)
language sql stable security definer set search_path = public as $$
  with mv as (
    select i.wallet_id, i.amount from incomes i where i.cashflow_id = cf
    union all select e.wallet_id, -e.amount from expenses e where e.cashflow_id = cf
    union all select b.wallet_id, -b.amount from bills b where b.cashflow_id = cf and b.paid
    union all select t.to_wallet, t.amount from wallet_transfers t where t.cashflow_id = cf
    union all select t.from_wallet, -t.amount from wallet_transfers t where t.cashflow_id = cf
  )
  select mv.wallet_id, sum(mv.amount) from mv where public.is_member(cf) group by mv.wallet_id
$$;

grant execute on function public.wallet_balances(uuid) to authenticated;
