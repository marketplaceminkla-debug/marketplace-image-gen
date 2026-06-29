-- ============================================================
-- Reporting Fix: RLS + kolom baru di warehouse_orders
-- Jalankan di Supabase SQL Editor (marketplaceminkla-deb project)
-- ============================================================

-- 1. Tambah kolom revenue dan kombo_hemat ke warehouse_orders
alter table public.warehouse_orders
  add column if not exists revenue bigint not null default 0,
  add column if not exists kombo_hemat text; -- null / 'garansi' / 'non_garansi'

-- 2. Fix RLS — ganti dari can_edit() ke auth.uid() is not null
--    (lebih simpel, cocok untuk internal tool)

-- daily_sales_reports
drop policy if exists "dsr_select" on public.daily_sales_reports;
drop policy if exists "dsr_insert" on public.daily_sales_reports;
drop policy if exists "dsr_update" on public.daily_sales_reports;
drop policy if exists "dsr_delete" on public.daily_sales_reports;
create policy "dsr_all" on public.daily_sales_reports
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- report_deals
drop policy if exists "rd_select" on public.report_deals;
drop policy if exists "rd_insert" on public.report_deals;
drop policy if exists "rd_delete" on public.report_deals;
create policy "rd_all" on public.report_deals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- report_pending_items
drop policy if exists "rpi_select" on public.report_pending_items;
drop policy if exists "rpi_insert" on public.report_pending_items;
drop policy if exists "rpi_update" on public.report_pending_items;
drop policy if exists "rpi_delete" on public.report_pending_items;
create policy "rpi_all" on public.report_pending_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- monthly_targets
drop policy if exists "mt_select" on public.monthly_targets;
drop policy if exists "mt_insert" on public.monthly_targets;
drop policy if exists "mt_update" on public.monthly_targets;
drop policy if exists "mt_delete" on public.monthly_targets;
create policy "mt_all" on public.monthly_targets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- store_accounts (sudah all, tapi refresh untuk konsistensi)
drop policy if exists "sa_all" on public.store_accounts;
create policy "sa_all" on public.store_accounts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
