-- ============================================================
-- JALANKAN FILE INI SATU KALI di Supabase SQL Editor
-- Project: marketplaceminkla-deb
-- ============================================================

-- ── 1. Kolom revenue + kombo_hemat di warehouse_orders ──
alter table public.warehouse_orders
  add column if not exists revenue bigint not null default 0,
  add column if not exists kombo_hemat text;

-- ── 2. Fix RLS semua tabel reporting ──
drop policy if exists "dsr_all" on public.daily_sales_reports;
create policy "dsr_all" on public.daily_sales_reports
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "rd_all" on public.report_deals;
create policy "rd_all" on public.report_deals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "rpi_all" on public.report_pending_items;
create policy "rpi_all" on public.report_pending_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "mt_all" on public.monthly_targets;
create policy "mt_all" on public.monthly_targets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "sa_all" on public.store_accounts;
create policy "sa_all" on public.store_accounts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 3. Kolom source_field di kpi_indicators ──
alter table public.kpi_indicators
  add column if not exists source_field text;

-- Tag indikator AUTO (revenue dari orderan)
update public.kpi_indicators set source_field = 'revenue'
  where name in (
    'Revenue Laptop',
    'Revenue Aksesoris (Shopee KLA & Tokped)',
    'Revenue (Lenovo & Gadgetklik)',
    'Revenue'
  );

-- Tag indikator AUTO (kombo hemat dari orderan)
update public.kpi_indicators set source_field = 'kombo_total'
  where name = 'Combo Hemat / SG';

-- ── 4. Tabel target per bulan ──
create table if not exists public.kpi_targets (
  id           uuid primary key default gen_random_uuid(),
  indicator_id uuid references public.kpi_indicators(id) on delete cascade,
  month        text not null,
  target_value numeric not null,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),
  unique(indicator_id, month)
);
alter table public.kpi_targets enable row level security;
drop policy if exists "kt_all" on public.kpi_targets;
create policy "kt_all" on public.kpi_targets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 5. Rename indikator Alfin ──
update public.kpi_indicators
  set name = 'Upload Konten IG Gadgetklik'
  where pic_name = 'Alfin' and name = 'Campaign / Voucher';

-- ── 6. TAL: kolom bukti + RLS terbuka ──
alter table public.tal_items
  add column if not exists proof_url  text,
  add column if not exists proof_name text,
  add column if not exists pic_name   text;

drop policy if exists "tal_all" on public.tal_items;
alter table public.tal_items enable row level security;
create policy "tal_all" on public.tal_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Storage bucket bukti TAL
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tal-proof', 'tal-proof', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "tal_proof_upload" on storage.objects;
drop policy if exists "tal_proof_read"   on storage.objects;
drop policy if exists "tal_proof_delete" on storage.objects;
create policy "tal_proof_upload" on storage.objects
  for insert with check (bucket_id = 'tal-proof' and auth.uid() is not null);
create policy "tal_proof_read"   on storage.objects
  for select using (bucket_id = 'tal-proof');
create policy "tal_proof_delete" on storage.objects
  for delete using (bucket_id = 'tal-proof' and auth.uid() is not null);
