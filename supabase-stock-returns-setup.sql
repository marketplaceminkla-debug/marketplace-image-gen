-- ============================================================
-- Stock Management — Retur & Gagal Kirim
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh has_section() dari Phase 3, dan warehouse_allowed() dari
--  supabase-warehouse-scope-setup.sql sudah dijalankan lebih dulu.)
-- ============================================================

create table if not exists public.stock_returns (
  id            uuid primary key default gen_random_uuid(),
  return_date   date not null,
  so_number     text,
  order_number  text,
  item_name     text not null,
  qty           int not null default 1,
  warehouse_id  uuid references public.warehouses(id) on delete set null,
  category      text not null check (category in ('tukar_unit', 'refund', 'refund_sebagian', 'ganti_item')),
  reason        text,
  proof_url     text,
  status        text not null default 'new' check (status in ('new', 'ship_user', 'dispute', 'ship_seller', 'done')),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.stock_returns enable row level security;

-- Akses gerbang: butuh section 'stock' DAN (kalau akunnya dibatasin ke
-- cabang tertentu lewat warehouse_scope) cabang returnya harus termasuk
-- yang diizinkan — sama persis kayak aturan Orderan Gudang.
drop policy if exists sr_select on public.stock_returns;
create policy sr_select on public.stock_returns for select
  using ( public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)) );

drop policy if exists sr_insert on public.stock_returns;
create policy sr_insert on public.stock_returns for insert
  with check ( public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)) );

drop policy if exists sr_update on public.stock_returns;
create policy sr_update on public.stock_returns for update
  using ( public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)) )
  with check ( public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)) );

drop policy if exists sr_delete on public.stock_returns;
create policy sr_delete on public.stock_returns for delete
  using ( public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)) );

-- Realtime, biar listing-nya auto-update kayak modul lain.
do $$
begin
  alter publication supabase_realtime add table public.stock_returns;
exception
  when others then null; -- sudah terdaftar / tidak masalah
end $$;
