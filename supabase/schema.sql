-- =============================================================
-- Duit Kara - skema database Supabase
-- Jalankan SEKALI di Supabase: SQL Editor -> New query -> paste -> Run
-- =============================================================

-- Pengaturan per user (tanggal gajian)
create table if not exists public.settings (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  payday     smallint not null default 25 check (payday between 1 and 31),
  created_at timestamptz not null default now()
);

-- Periode gaji (dari tanggal gajian s/d sehari sebelum gajian berikutnya)
create table if not exists public.periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  start_date date not null,
  end_date   date not null,
  salary     numeric(14,0) not null default 0 check (salary >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, start_date),
  check (end_date >= start_date)
);

-- Kategori pengeluaran
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  icon       text not null default '📦',
  sort       int  not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Hutang (payable = saya berhutang) & piutang (receivable = orang berhutang ke saya)
create table if not exists public.debts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  type       text not null check (type in ('payable','receivable')),
  person     text not null,
  amount     numeric(14,0) not null check (amount > 0),
  due_date   date,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  debt_id    uuid not null references public.debts on delete cascade,
  amount     numeric(14,0) not null check (amount > 0),
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

-- Pos tetap per periode (tagihan, tabungan, cicilan hutang)
create table if not exists public.fixed_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  period_id  uuid not null references public.periods on delete cascade,
  name       text not null,
  amount     numeric(14,0) not null check (amount >= 0),
  kind       text not null default 'bill' check (kind in ('bill','saving','debt')),
  debt_id    uuid references public.debts on delete set null,
  paid       boolean not null default false,
  payment_id uuid references public.debt_payments on delete set null,
  created_at timestamptz not null default now()
);

-- Budget mingguan / harian yang diatur manual (selain itu dibagi otomatis)
create table if not exists public.budget_overrides (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  period_id  uuid not null references public.periods on delete cascade,
  week_index smallint,
  day        date,
  amount     numeric(14,0) not null check (amount >= 0),
  check ((week_index is null) <> (day is null)),
  unique (period_id, week_index),
  unique (period_id, day)
);

-- Pengeluaran harian
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  date        date not null default current_date,
  amount      numeric(14,0) not null check (amount > 0),
  category_id uuid references public.categories on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_user_date_idx on public.expenses (user_id, date);
create index if not exists fixed_items_period_idx on public.fixed_items (period_id);
create index if not exists overrides_period_idx on public.budget_overrides (period_id);
create index if not exists debt_payments_debt_idx on public.debt_payments (debt_id);

-- -------------------------------------------------------------
-- Row Level Security: setiap user hanya bisa melihat datanya sendiri
-- -------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','periods','categories','debts','debt_payments',
                           'fixed_items','budget_overrides','expenses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
