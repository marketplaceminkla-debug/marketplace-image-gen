-- ============================================================
-- Marketplace Workspace — Revenue module setup (Phase 3)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh Phase 2 / tabel profiles sudah ada.)
-- ============================================================

-- Helper: apakah user boleh lihat section tertentu
create or replace function public.has_section(section text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and (role = 'super_admin' or section = any(access))
  );
$$;

-- Helper: apakah user boleh edit data (Admin / Super Admin)
create or replace function public.can_edit()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role in ('super_admin','admin')
  );
$$;

-- Target revenue (1 baris konfigurasi)
create table if not exists public.revenue_settings (
  id         int primary key default 1 check (id = 1),
  target     bigint not null default 0,
  currency   text not null default 'IDR',
  updated_at timestamptz not null default now()
);
insert into public.revenue_settings (id, target) values (1, 0) on conflict (id) do nothing;

-- Input revenue harian
create table if not exists public.revenue_entries (
  id         uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  amount     bigint not null,
  note       text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.revenue_settings enable row level security;
alter table public.revenue_entries  enable row level security;

drop policy if exists rev_set_select on public.revenue_settings;
create policy rev_set_select on public.revenue_settings
  for select using ( public.has_section('dashboard') );
drop policy if exists rev_set_update on public.revenue_settings;
create policy rev_set_update on public.revenue_settings
  for update using ( public.can_edit() ) with check ( public.can_edit() );

drop policy if exists rev_ent_select on public.revenue_entries;
create policy rev_ent_select on public.revenue_entries
  for select using ( public.has_section('dashboard') );
drop policy if exists rev_ent_insert on public.revenue_entries;
create policy rev_ent_insert on public.revenue_entries
  for insert with check ( public.can_edit() );
drop policy if exists rev_ent_delete on public.revenue_entries;
create policy rev_ent_delete on public.revenue_entries
  for delete using ( public.can_edit() );
