-- Tambah source_field ke kpi_indicators
-- Jalankan di Supabase SQL Editor (marketplaceminkla-deb)

alter table public.kpi_indicators
  add column if not exists source_field text; -- 'revenue' | 'kombo_total' | null (manual)

-- Tag indikator yang bisa auto-fill dari data orderan
update public.kpi_indicators set source_field = 'revenue'
  where name in (
    'Revenue Laptop',
    'Revenue Aksesoris (Shopee KLA & Tokped)',
    'Revenue (Lenovo & Gadgetklik)',
    'Revenue'
  );

update public.kpi_indicators set source_field = 'kombo_total'
  where name = 'Combo Hemat / SG';
