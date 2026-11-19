-- ============================================================
-- Report Harian — template baru (Tim Penjualan + Operasional)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- Aman: cuma nambah kolom baru, data lama nggak berubah.
-- ============================================================

alter table public.daily_sales_reports
  add column if not exists live_revenue        bigint not null default 0,
  add column if not exists unit_laptop         int    not null default 0,
  add column if not exists unit_aksesoris      int    not null default 0,
  add column if not exists video_count         int    not null default 0,
  add column if not exists ops_unboxing_retur  int    not null default 0,
  add column if not exists ops_service_count   int    not null default 0,
  add column if not exists ops_cases           text;

-- Refresh cache skema API biar kolom baru langsung kebaca aplikasi.
notify pgrst, 'reload schema';
