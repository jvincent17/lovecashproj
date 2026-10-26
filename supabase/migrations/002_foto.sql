-- =============================================================
-- Duit Kara - migrasi 002: foto profil & foto "Kita berdua"
-- Jalankan SEKALI di Supabase SQL Editor. Data yang ada TIDAK dihapus.
-- =============================================================

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
