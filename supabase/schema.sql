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
