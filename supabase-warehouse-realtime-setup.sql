-- ============================================================
-- Multiwarehouse — aktifkan Realtime untuk notifikasi order baru
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Idempotent: aman walau dijalankan ulang.)
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table public.warehouse_orders;
exception
  when others then null; -- sudah terdaftar / tidak masalah
end $$;
