-- ============================================================
-- Multiwarehouse — quantity per barang
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- ============================================================

alter table public.warehouse_orders add column if not exists item_qtys int[] not null default '{}';

-- Backfill order lama: qty 1 untuk tiap barang yang sudah ada
update public.warehouse_orders
set item_qtys = array(select 1 from unnest(items))
where (array_length(item_qtys, 1) is null)
  and array_length(items, 1) is not null;
