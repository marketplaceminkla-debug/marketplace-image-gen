-- ============================================================
-- Marketplace Workspace — Auth & Roles setup (Phase 2)
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
-- ============================================================

-- 1) Tabel profil user (1 baris per akun login)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'staff' check (role in ('super_admin','admin','staff')),
  access      text[] not null default '{}',          -- section: dashboard | product | tools
  is_active   boolean not null default false,        -- harus disetujui Super Admin dulu
  created_at  timestamptz not null default now()
);

-- 2) Otomatis bikin profil saat ada user baru daftar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Helper: cek apakah user yang sedang login adalah Super Admin
--    (security definer -> bypass RLS, hindari rekursi policy)
create or replace function public.is_super_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and is_active = true
  );
$$;

-- 4) Row Level Security
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using ( id = auth.uid() or public.is_super_admin() );

drop policy if exists profiles_update_super on public.profiles;
create policy profiles_update_super on public.profiles
  for update using ( public.is_super_admin() ) with check ( public.is_super_admin() );
-- (Insert ditangani trigger di atas. User biasa tidak bisa ubah role/akses sendiri.)

-- ============================================================
-- 5) BOOTSTRAP SUPER ADMIN (jalankan SETELAH kamu DAFTAR akun
--    lewat halaman login pakai email di bawah).
--    Ganti email kalau perlu.
-- ============================================================
update public.profiles
set role = 'super_admin',
    is_active = true,
    access = array['dashboard','product','tools']
where email = 'marketplaceminkla@gmail.com';
