-- ============================================================
-- Marketplace Workspace — Multiwarehouse module setup
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh has_section()/can_edit() dari setup sebelumnya sudah ada.)
-- ============================================================

-- Database nomor WA gudang/cabang
create table if not exists public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  wa_number  text not null,
  note       text,
  created_at timestamptz not null default now()
);

-- Orderan yang dikirim ke gudang
create table if not exists public.warehouse_orders (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid references public.warehouses(id) on delete cascade,
  item_name    text not null,
  so_number    text,
  order_number text,
  keterangan   text,
  ekspedisi    text not null default 'reguler' check (ekspedisi in ('instan','reguler')),
  shipment     text not null default 'pickup'  check (shipment in ('dropoff','pickup')),
  status       text not null default 'new'     check (status in ('new','process','approved','denied')),
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table public.warehouses       enable row level security;
alter table public.warehouse_orders enable row level security;

-- Database gudang (nomor WA): baca = punya akses 'warehouse'; tulis = Admin/Super Admin
drop policy if exists wh_select on public.warehouses;
create policy wh_select on public.warehouses for select using ( public.has_section('warehouse') );
drop policy if exists wh_insert on public.warehouses;
create policy wh_insert on public.warehouses for insert with check ( public.can_edit() );
drop policy if exists wh_update on public.warehouses;
create policy wh_update on public.warehouses for update using ( public.can_edit() ) with check ( public.can_edit() );
drop policy if exists wh_delete on public.warehouses;
create policy wh_delete on public.warehouses for delete using ( public.can_edit() );

-- Orderan: baca & tulis = siapa pun yang punya akses 'warehouse' (operasional harian)
drop policy if exists who_select on public.warehouse_orders;
create policy who_select on public.warehouse_orders for select using ( public.has_section('warehouse') );
drop policy if exists who_insert on public.warehouse_orders;
create policy who_insert on public.warehouse_orders for insert with check ( public.has_section('warehouse') );
drop policy if exists who_update on public.warehouse_orders;
create policy who_update on public.warehouse_orders for update using ( public.has_section('warehouse') ) with check ( public.has_section('warehouse') );
drop policy if exists who_delete on public.warehouse_orders;
create policy who_delete on public.warehouse_orders for delete using ( public.has_section('warehouse') );
