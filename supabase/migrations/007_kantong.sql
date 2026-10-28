-- =============================================================
-- Duit Kara - migrasi 007: KANTONG KHUSUS (Healing, Cheating, Dana Darurat, dll.)
-- Uang di kantong terpisah dari rumus jatah harian.
-- Jalankan SEKALI di Supabase SQL Editor (setelah 005). Data yang ada TIDAK diubah.
-- =============================================================

create table if not exists public.pockets (
  id             uuid primary key default gen_random_uuid(),
  cashflow_id    uuid not null references public.cashflows on delete cascade,
  name           text not null,
  icon           text not null default '🎁',
  carry_over     boolean not null default false,   -- true = sisa menumpuk ke periode berikutnya (mis. Dana Darurat)
  default_amount numeric(14,0) not null default 0 check (default_amount >= 0), -- isi otomatis tiap periode baru
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

-- Pergerakan uang kantong:
--  fund      = disisihkan dari dana bulan ini ke kantong
--  from_week = ditarik dari jatah minggu (mulai tanggal `date`) ke kantong
--  to_day    = dari kantong ke jatah hari `date`
create table if not exists public.pocket_moves (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  pocket_id   uuid not null references public.pockets on delete cascade,
  period_id   uuid not null references public.periods on delete cascade,
  kind        text not null check (kind in ('fund','from_week','to_day')),
  amount      numeric(14,0) not null check (amount > 0),
  date        date not null default current_date,
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.expenses add column if not exists pocket_id uuid references public.pockets on delete set null;

create index if not exists pockets_cf_idx on public.pockets (cashflow_id);
create index if not exists pocket_moves_period_idx on public.pocket_moves (period_id);
create index if not exists pocket_moves_pocket_idx on public.pocket_moves (pocket_id);
create index if not exists expenses_pocket_idx on public.expenses (pocket_id) where pocket_id is not null;

do $$
declare t text;
begin
  foreach t in array array['pockets','pocket_moves']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "cashflow members" on public.%I', t);
    execute format(
      'create policy "cashflow members" on public.%I for all to authenticated
         using (public.is_member(cashflow_id)) with check (public.is_member(cashflow_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- Statistik kantong: masuk/keluar sepanjang waktu & dalam periode tertentu
create or replace function public.pocket_stats(cf uuid, pid uuid)
returns table (pocket_id uuid, all_in numeric, all_out numeric, per_in numeric, per_out numeric)
language sql stable security definer set search_path = public as $$
  with p as (select start_date, end_date from periods where id = pid),
  mv as (
    select m.pocket_id, case when m.kind = 'to_day' then -m.amount else m.amount end as amt, (m.period_id = pid) as in_period
    from pocket_moves m where m.cashflow_id = cf
  ),
  ex as (
    select e.pocket_id, e.amount, (e.date between (select start_date from p) and (select end_date from p)) as in_period
    from expenses e where e.cashflow_id = cf and e.pocket_id is not null
  )
  select k.id,
    coalesce((select sum(amt) from mv where mv.pocket_id = k.id), 0),
    coalesce((select sum(amount) from ex where ex.pocket_id = k.id), 0),
    coalesce((select sum(amt) from mv where mv.pocket_id = k.id and mv.in_period), 0),
    coalesce((select sum(amount) from ex where ex.pocket_id = k.id and coalesce(ex.in_period, false)), 0)
  from pockets k
  where k.cashflow_id = cf and public.is_member(cf)
$$;

-- Saldo akhir periode (untuk "Bawa sisa bulan lalu"):
-- dana masuk − tagihan dibayar − pengeluaran harian − pengeluaran kantong biasa − uang yang masuk ke kantong "numpuk"
create or replace function public.period_saldo(pid uuid)
returns numeric
language sql stable security definer set search_path = public as $$
  with p as (select * from periods where id = pid and public.is_member(cashflow_id))
  select
    coalesce((select sum(amount) from incomes where period_id = (select id from p)), 0)
    - coalesce((select sum(amount) from bills b, p where b.cashflow_id = p.cashflow_id and b.paid and b.due_date between p.start_date and p.end_date), 0)
    - coalesce((select sum(e.amount) from expenses e join p on e.cashflow_id = p.cashflow_id and e.date between p.start_date and p.end_date
                left join pockets k on k.id = e.pocket_id where k.id is null or not k.carry_over), 0)
    - coalesce((select sum(case when m.kind = 'to_day' then -m.amount else m.amount end) from pocket_moves m
                join pockets k on k.id = m.pocket_id where m.period_id = (select id from p) and k.carry_over), 0)
$$;

grant execute on function public.pocket_stats(uuid, uuid), public.period_saldo(uuid) to authenticated;

-- Muat data awal: tambahkan kantong
create or replace function public.app_bootstrap(sel_period uuid default null, today date default current_date)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cf  uuid;
  p   periods;
begin
  cf := ensure_profile(); -- sekaligus memastikan profil & cashflow ada

  if sel_period is not null then
    select * into p from periods where id = sel_period and cashflow_id = cf;
  end if;
  if p.id is null then
    select * into p from periods where cashflow_id = cf and today between start_date and end_date limit 1;
  end if;
  if p.id is null then
    select * into p from periods where cashflow_id = cf order by start_date desc limit 1;
  end if;

  return jsonb_build_object(
    'cf', cf,
    'profile', (select to_jsonb(x) from profiles x where x.id = uid),
    'cashflow', (select to_jsonb(c) from cashflows c where c.id = cf),
    'my_cashflows', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', m.role) order by m.joined_at)
      from cashflow_members m join cashflows c on c.id = m.cashflow_id where m.user_id = uid), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(m) || jsonb_build_object('profile', (
        select jsonb_build_object('id', pr.id, 'username', pr.username, 'display_name', pr.display_name, 'avatar_path', pr.avatar_path)
        from profiles pr where pr.id = m.user_id)) order by m.joined_at)
      from cashflow_members m where m.cashflow_id = cf), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from categories x where x.cashflow_id = cf), '[]'::jsonb),
    'periods', coalesce((select jsonb_agg(to_jsonb(x) order by x.start_date desc) from periods x where x.cashflow_id = cf), '[]'::jsonb),
    'debts', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from debts x where x.cashflow_id = cf), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.date desc) from debt_payments x where x.cashflow_id = cf), '[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from wallets x where x.cashflow_id = cf), '[]'::jsonb),
    'balances', coalesce((select jsonb_agg(jsonb_build_object('wallet_id', b.wallet_id, 'balance', b.balance)) from wallet_balances(cf) b), '[]'::jsonb),
    'transfers', coalesce((select jsonb_agg(to_jsonb(t) order by t.date desc, t.created_at desc) from (
      select * from wallet_transfers x where x.cashflow_id = cf order by x.date desc, x.created_at desc limit 200) t), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from quick_templates x where x.cashflow_id = cf), '[]'::jsonb),
    'period_id', p.id,
    'incomes', coalesce((select jsonb_agg(to_jsonb(x) order by x.date, x.created_at) from incomes x where x.period_id = p.id), '[]'::jsonb),
    'bills', coalesce((select jsonb_agg(to_jsonb(x) order by x.due_date, x.created_at) from bills x
      where x.cashflow_id = cf and x.due_date between p.start_date and p.end_date + 62), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(to_jsonb(x)) from budget_overrides x where x.period_id = p.id), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(to_jsonb(x) order by x.date desc, x.created_at desc) from expenses x
      where x.cashflow_id = cf and x.date between p.start_date and p.end_date), '[]'::jsonb),
    'pockets', coalesce((select jsonb_agg(to_jsonb(x) order by x.sort, x.created_at) from pockets x where x.cashflow_id = cf), '[]'::jsonb),
    'pocket_moves', coalesce((select jsonb_agg(to_jsonb(x) order by x.date, x.created_at) from pocket_moves x where x.period_id = p.id), '[]'::jsonb),
    'pocket_stats', coalesce((select jsonb_agg(to_jsonb(s)) from pocket_stats(cf, p.id) s), '[]'::jsonb)
  );
end $$;


revoke all on function public.app_bootstrap(uuid, date) from public, anon;
grant execute on function public.app_bootstrap(uuid, date) to authenticated;
