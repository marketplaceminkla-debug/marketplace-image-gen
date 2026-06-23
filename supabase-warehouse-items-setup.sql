-- ============================================================
-- Multiwarehouse — banyak barang per orderan
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- ============================================================

-- Kolom daftar barang (1 order bisa banyak barang)
alter table public.warehouse_orders add column if not exists items text[] not null default '{}';

-- Backfill order lama: pindahkan item_name jadi 1 item di array
update public.warehouse_orders
set items = array[item_name]
where (array_length(items, 1) is null)
  and item_name is not null
  and item_name <> '';
