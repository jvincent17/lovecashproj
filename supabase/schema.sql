-- =============================================================
-- Duit Kara v2 - skema database Supabase
-- Jalankan di Supabase: SQL Editor -> New query -> paste semua -> Run
--
-- PERHATIAN: script ini MENGHAPUS tabel versi lama beserta datanya
-- (akun login tidak ikut terhapus).
-- =============================================================

-- ---------- bersihkan versi lama ----------
drop table if exists public.expenses, public.budget_overrides, public.fixed_items, public.bills,
  public.incomes, public.debt_payments, public.debts, public.categories, public.periods,
  public.settings, public.cashflow_members, public.cashflows, public.profiles cascade;
drop function if exists public.is_member(uuid), public.shares_cashflow(uuid), public.gen_invite_code(),
  public.ensure_profile(), public.join_cashflow(text), public.leave_cashflow(uuid),
  public.regenerate_invite_code(uuid), public.email_for_username(text),
  public.username_available(text), public.switch_cashflow(uuid) cascade;

-- ---------- cashflow (dompet bersama) ----------
create table public.cashflows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Dompet Kita',
  invite_code text not null unique,
  payday      smallint not null default 25 check (payday between 1 and 31),
  owner_id    uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table public.cashflow_members (
  cashflow_id uuid not null references public.cashflows on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        text not null default 'member' check (role in ('owner','member')),
  joined_at   timestamptz not null default now(),
  primary key (cashflow_id, user_id)
);

create table public.profiles (
  id                 uuid primary key references auth.users on delete cascade,
  username           text unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name       text,
  active_cashflow_id uuid references public.cashflows on delete set null,
  created_at         timestamptz not null default now()
);

-- ---------- data keuangan (semua milik satu cashflow) ----------
create table public.periods (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  unique (cashflow_id, start_date),
  check (end_date >= start_date)
);

create table public.incomes (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  period_id   uuid not null references public.periods on delete cascade,
  name        text not null,
  amount      numeric(14,0) not null check (amount > 0),
  date        date not null default current_date,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  name        text not null,
  icon        text not null default '📦',
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (cashflow_id, name)
);

create table public.debts (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  type        text not null check (type in ('payable','receivable')),
  person      text not null,
  amount      numeric(14,0) not null check (amount > 0),
  due_date    date,
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table public.debt_payments (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  debt_id     uuid not null references public.debts on delete cascade,
  amount      numeric(14,0) not null check (amount > 0),
  date        date not null default current_date,
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

-- Tagihan: masuk ke periode sesuai tanggal jatuh temponya
create table public.bills (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  name        text not null,
  amount      numeric(14,0) not null check (amount >= 0),
  due_date    date not null,
  kind        text not null default 'bill' check (kind in ('bill','saving','debt')),
  debt_id     uuid references public.debts on delete set null,
  recurring   boolean not null default false,
  paid        boolean not null default false,
  paid_at     date,
  payment_id  uuid references public.debt_payments on delete set null,
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create table public.budget_overrides (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  period_id   uuid not null references public.periods on delete cascade,
  week_index  smallint,
  day         date,
  amount      numeric(14,0) not null check (amount >= 0),
  check ((week_index is null) <> (day is null)),
  unique (period_id, week_index),
  unique (period_id, day)
);

create table public.expenses (
  id          uuid primary key default gen_random_uuid(),
  cashflow_id uuid not null references public.cashflows on delete cascade,
  date        date not null default current_date,
  amount      numeric(14,0) not null check (amount > 0),
  category_id uuid references public.categories on delete set null,
  note        text,
  created_by  uuid default auth.uid() references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

create index on public.cashflow_members (user_id);
create index on public.periods (cashflow_id, start_date);
create index on public.incomes (period_id);
create index on public.bills (cashflow_id, due_date);
create index on public.expenses (cashflow_id, date);
create index on public.budget_overrides (period_id);
create index on public.debt_payments (debt_id);

-- ---------- fungsi bantu ----------
create function public.is_member(cf uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cashflow_members where cashflow_id = cf and user_id = auth.uid())
$$;

create function public.shares_cashflow(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cashflow_members a join cashflow_members b using (cashflow_id)
    where a.user_id = auth.uid() and b.user_id = other)
$$;

create function public.gen_invite_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from cashflows where invite_code = code);
  end loop;
  return code;
end $$;

-- Dipanggil aplikasi setiap login: pastikan profil & cashflow ada, kembalikan cashflow aktif
create function public.ensure_profile() returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  meta_username text;
  cf uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if not exists (select 1 from profiles where id = uid) then
    select lower(raw_user_meta_data->>'username') into meta_username from auth.users where id = uid;
    if meta_username is null or meta_username !~ '^[a-z0-9_.]{3,20}$'
       or exists (select 1 from profiles where username = meta_username) then
      meta_username := null;
    end if;
    insert into profiles (id, username, display_name) values (uid, meta_username, meta_username);
  end if;

  select active_cashflow_id into cf from profiles where id = uid;
  if cf is null or not exists (select 1 from cashflow_members where cashflow_id = cf and user_id = uid) then
    select cashflow_id into cf from cashflow_members where user_id = uid order by joined_at limit 1;
  end if;

  if cf is null then
    insert into cashflows (invite_code, owner_id) values (gen_invite_code(), uid) returning id into cf;
    insert into cashflow_members (cashflow_id, user_id, role) values (cf, uid, 'owner');
    insert into categories (cashflow_id, name, icon, sort) values
      (cf, 'Makan & Minum', '🍜', 0), (cf, 'Transport', '🛵', 1), (cf, 'Belanja', '🛒', 2),
      (cf, 'Tagihan', '💡', 3), (cf, 'Hiburan', '🎬', 4), (cf, 'Kesehatan', '💊', 5),
      (cf, 'Keluarga', '👨‍👩‍👧', 6), (cf, 'Lainnya', '📦', 7);
  end if;

  update profiles set active_cashflow_id = cf where id = uid and active_cashflow_id is distinct from cf;
  return cf;
end $$;

create function public.join_cashflow(code text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare cf uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into cf from cashflows where invite_code = upper(trim(code));
  if cf is null then raise exception 'Kode undangan tidak ditemukan'; end if;
  insert into cashflow_members (cashflow_id, user_id) values (cf, auth.uid()) on conflict do nothing;
  update profiles set active_cashflow_id = cf where id = auth.uid();
  return cf;
end $$;

create function public.switch_cashflow(cf uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_member(cf) then raise exception 'Bukan anggota cashflow ini'; end if;
  update profiles set active_cashflow_id = cf where id = auth.uid();
  return cf;
end $$;

create function public.leave_cashflow(cf uuid) returns uuid
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from cashflow_members where cashflow_id = cf and user_id = auth.uid();
  -- cashflow tanpa anggota dihapus beserta datanya
  delete from cashflows c where c.id = cf and not exists (select 1 from cashflow_members m where m.cashflow_id = c.id);
  update profiles set active_cashflow_id = null where id = auth.uid() and active_cashflow_id = cf;
  return ensure_profile();
end $$;

create function public.regenerate_invite_code(cf uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare code text;
begin
  if not is_member(cf) then raise exception 'Bukan anggota cashflow ini'; end if;
  code := gen_invite_code();
  update cashflows set invite_code = code where id = cf;
  return code;
end $$;

-- Login pakai username: cari email dari username
create function public.email_for_username(uname text) returns text
language sql stable security definer set search_path = public as $$
  select u.email from auth.users u join profiles p on p.id = u.id where p.username = lower(trim(uname))
$$;

create function public.username_available(uname text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(trim(uname)))
$$;

revoke all on function public.ensure_profile(), public.join_cashflow(text), public.switch_cashflow(uuid),
  public.leave_cashflow(uuid), public.regenerate_invite_code(uuid), public.gen_invite_code() from public, anon;
grant execute on function public.ensure_profile(), public.join_cashflow(text), public.switch_cashflow(uuid),
  public.leave_cashflow(uuid), public.regenerate_invite_code(uuid), public.is_member(uuid),
  public.shares_cashflow(uuid) to authenticated;
grant execute on function public.email_for_username(text), public.username_available(text) to anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.cashflows enable row level security;
alter table public.cashflow_members enable row level security;
alter table public.profiles enable row level security;

create policy "members read" on public.cashflows for select to authenticated using (public.is_member(id));
create policy "members update" on public.cashflows for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

create policy "members read" on public.cashflow_members for select to authenticated using (public.is_member(cashflow_id));

create policy "read self & partners" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_cashflow(id));
create policy "update self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant select, update on public.cashflows, public.profiles to authenticated;
grant select on public.cashflow_members to authenticated;

do $$
declare t text;
begin
  foreach t in array array['periods','incomes','categories','debts','debt_payments','bills','budget_overrides','expenses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "cashflow members" on public.%I for all to authenticated
         using (public.is_member(cashflow_id)) with check (public.is_member(cashflow_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;


-- =============================================================
-- Foto (sama dengan migrations/002_foto.sql)
alter table public.profiles  add column if not exists avatar_path text;
alter table public.cashflows add column if not exists photo_path text;
alter table public.cashflows add column if not exists photo_caption text not null default 'Kita berdua 💗';

-- Bucket privat untuk foto (maks 3 MB per file)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;

-- Struktur path:  u/<user_id>/...      -> foto profil (bisa dilihat diri sendiri & partner)
--                 cf/<cashflow_id>/... -> foto cashflow (bisa dilihat & diubah semua anggota)
create or replace function public.photo_can_read(obj_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(obj_name, '/');
begin
  if coalesce(array_length(parts, 1), 0) < 3 then return false; end if;
  if parts[1] = 'u'  then return parts[2] = auth.uid()::text or shares_cashflow(parts[2]::uuid); end if;
  if parts[1] = 'cf' then return is_member(parts[2]::uuid); end if;
  return false;
exception when others then return false;
end $$;

create or replace function public.photo_can_write(obj_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare parts text[] := string_to_array(obj_name, '/');
begin
  if coalesce(array_length(parts, 1), 0) < 3 then return false; end if;
  if parts[1] = 'u'  then return parts[2] = auth.uid()::text; end if;
  if parts[1] = 'cf' then return is_member(parts[2]::uuid); end if;
  return false;
exception when others then return false;
end $$;

grant execute on function public.photo_can_read(text), public.photo_can_write(text) to authenticated;

drop policy if exists "photos read"   on storage.objects;
drop policy if exists "photos insert" on storage.objects;
drop policy if exists "photos update" on storage.objects;
drop policy if exists "photos delete" on storage.objects;

create policy "photos read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.photo_can_read(name));
create policy "photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.photo_can_write(name));
create policy "photos update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.photo_can_write(name))
  with check (bucket_id = 'photos' and public.photo_can_write(name));
create policy "photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.photo_can_write(name));


-- =============================================================
-- Lokasi dana (sama dengan migrations/003_lokasi_dana.sql)
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


-- =============================================================
-- Fitur lanjutan (sama dengan migrations/004_fitur_lanjutan.sql)
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


-- =============================================================
-- Bootstrap (sama dengan migrations/005_bootstrap.sql)
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
      where x.cashflow_id = cf and x.date between p.start_date and p.end_date), '[]'::jsonb)
  );
end $$;

revoke all on function public.app_bootstrap(uuid, date) from public, anon;
grant execute on function public.app_bootstrap(uuid, date) to authenticated;


-- =============================================================
-- Mode minus (sama dengan migrations/006_mode_minus.sql)
alter table public.cashflows add column if not exists carry_mode text not null default 'next';
do $$ begin
  alter table public.cashflows add constraint cashflows_carry_mode_check check (carry_mode in ('next','spread'));
exception when duplicate_object then null; end $$;

