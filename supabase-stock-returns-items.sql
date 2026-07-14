-- ============================================================
-- Stock Management — barang bisa lebih dari satu per retur
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh supabase-stock-returns-setup.sql sudah dijalankan lebih dulu.)
-- ============================================================

alter table public.stock_returns add column if not exists items text[] not null default '{}';
alter table public.stock_returns add column if not exists item_qtys int[] not null default '{}';

-- Backfill baris lama (kalau ada) dari kolom item_name/qty lama.
update public.stock_returns
set items = array[item_name], item_qtys = array[qty]
where array_length(items, 1) is null and item_name is not null;

-- item_name/qty sekarang cuma dipakai sebagai fallback item pertama —
-- boleh nullable, gak wajib diisi lagi dari form.
alter table public.stock_returns alter column item_name drop not null;
