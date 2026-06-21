-- ============================================================
-- Marketplace Workspace — TAL (To Achieve List) setup (Phase 5)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh has_section()/can_edit() dari Phase 3 sudah ada.)
-- ============================================================

create table if not exists public.tal_items (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,                       -- 'YYYY-MM'
  title      text not null,
  category   text not null default 'target' check (category in ('target','strategi','lainnya')),
  is_done    boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.tal_items enable row level security;

drop policy if exists tal_select on public.tal_items;
create policy tal_select on public.tal_items for select using ( public.has_section('dashboard') );
drop policy if exists tal_insert on public.tal_items;
create policy tal_insert on public.tal_items for insert with check ( public.can_edit() );
drop policy if exists tal_update on public.tal_items;
create policy tal_update on public.tal_items for update using ( public.can_edit() ) with check ( public.can_edit() );
drop policy if exists tal_delete on public.tal_items;
create policy tal_delete on public.tal_items for delete using ( public.can_edit() );
