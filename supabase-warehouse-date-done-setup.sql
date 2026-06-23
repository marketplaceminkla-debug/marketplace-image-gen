-- ============================================================
-- Multiwarehouse — tanggal order + status "done"
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- ============================================================

-- Kolom tanggal order (buat input & filter tanggal)
alter table public.warehouse_orders add column if not exists order_date date not null default current_date;

-- Backfill order lama: pakai tanggal dibuatnya
update public.warehouse_orders set order_date = created_at::date;

-- Tambah status 'done' ke daftar status yang diizinkan
alter table public.warehouse_orders drop constraint if exists warehouse_orders_status_check;
alter table public.warehouse_orders
  add constraint warehouse_orders_status_check
  check (status in ('new','process','approved','denied','done'));
