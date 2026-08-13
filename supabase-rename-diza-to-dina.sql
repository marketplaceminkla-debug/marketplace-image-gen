-- Ganti nama PIC "Diza" jadi "Dina" (resign, digantiin Dina) di semua tabel
-- yang nyimpen nama PIC, biar histori datanya (KPI, target, TAL, toko) tetep
-- nyambung di bawah nama baru.
-- Jalankan SEKALI di Supabase → SQL Editor → Run.

update public.store_accounts set pic_name = 'Dina' where pic_name = 'Diza';
update public.monthly_targets set pic_name = 'Dina' where pic_name = 'Diza';
update public.kpi_indicators set pic_name = 'Dina' where pic_name = 'Diza';
update public.tal_items set pic_name = 'Dina' where pic_name = 'Diza';
