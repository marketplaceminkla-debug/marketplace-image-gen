-- KPI: Margin Mauren = auto jumlah Margin Rona + Diza + Alfin
-- Jalankan di Supabase SQL Editor (marketplaceminkla-deb)
-- (Butuh supabase-kpi-sourcefield.sql sudah dijalankan lebih dulu.)

update public.kpi_indicators
set source_field = 'margin_sum'
where pic_name = 'Mauren'
  and category = 'hasil'
  and name ilike '%margin%';
