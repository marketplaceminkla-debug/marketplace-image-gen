-- Stock Management — kolom Nomor RC (opsional) buat retur.
-- Jalankan SEKALI di Supabase → SQL Editor → Run.

alter table public.stock_returns add column if not exists rc_number text;
