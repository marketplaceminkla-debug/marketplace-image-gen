-- ============================================================
-- Multiwarehouse — batasi akun ke cabang tertentu
-- (mis. anak intern cuma boleh liat/kerjain orderan cabang Semarang)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- ============================================================

-- Kolom baru di profiles: daftar id gudang yang boleh diakses akun ini.
-- Kosong (default) = akses semua gudang (perilaku lama, akun existing aman).
alter table public.profiles add column if not exists warehouse_scope uuid[] not null default '{}';

-- Helper: apakah user yang login boleh akses gudang tertentu?
create or replace function public.warehouse_allowed(wh_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select role = 'super_admin' or warehouse_scope = '{}' or wh_id = any(warehouse_scope)
    from public.profiles
    where id = auth.uid() and is_active
  ), false);
$$;

-- Orderan: baca & tulis = akses 'warehouse' DAN gudangnya termasuk yang diizinkan.
drop policy if exists who_select on public.warehouse_orders;
create policy who_select on public.warehouse_orders for select
  using ( public.has_section('warehouse') and public.warehouse_allowed(warehouse_id) );

drop policy if exists who_insert on public.warehouse_orders;
create policy who_insert on public.warehouse_orders for insert
  with check ( public.has_section('warehouse') and public.warehouse_allowed(warehouse_id) );

drop policy if exists who_update on public.warehouse_orders;
create policy who_update on public.warehouse_orders for update
  using ( public.has_section('warehouse') and public.warehouse_allowed(warehouse_id) )
  with check ( public.has_section('warehouse') and public.warehouse_allowed(warehouse_id) );

drop policy if exists who_delete on public.warehouse_orders;
create policy who_delete on public.warehouse_orders for delete
  using ( public.has_section('warehouse') and public.warehouse_allowed(warehouse_id) );
