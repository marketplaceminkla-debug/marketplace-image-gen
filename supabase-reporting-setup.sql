-- ============================================================
-- Daily Reporting & Monitoring Setup
-- Jalankan SEKALI di Supabase → SQL Editor → Run
-- (Butuh Phase 2 / tabel profiles, has_section, can_edit sudah ada)
-- ============================================================

-- 1. Store accounts (master data toko per PIC)
create table if not exists public.store_accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  platform     text not null default 'shopee',
  pic_name     text not null,
  pic_wa       text,
  categories   text[] not null default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Seed initial data (hanya jika tabel masih kosong)
insert into public.store_accounts (name, platform, pic_name, categories)
select name, platform, pic_name, categories from (values
  ('SHOPEE KLA',        'shopee',    'Rona',  array['Laptop', 'Tablet', 'AIO']::text[]),
  ('SHOPEE KLA',        'shopee',    'Diza',  array['Aksesoris']::text[]),
  ('TOKPED KLA',        'tokopedia', 'Diza',  array['All']::text[]),
  ('SHOPEE LENOVO SMG', 'shopee',    'Alfin', array['All']::text[]),
  ('GADGETKLIK',        'shopee',    'Alfin', array['All']::text[])
) as v(name, platform, pic_name, categories)
where not exists (select 1 from public.store_accounts);

-- 2. Target bulanan per PIC
create table if not exists public.monthly_targets (
  id         uuid primary key default gen_random_uuid(),
  pic_name   text not null,
  month      int not null check (month between 1 and 12),
  year       int not null check (year >= 2024),
  target     bigint not null default 0,
  created_at timestamptz not null default now(),
  unique(pic_name, month, year)
);

-- 3. Report harian (satu baris per hari per toko)
create table if not exists public.daily_sales_reports (
  id                uuid primary key default gen_random_uuid(),
  report_date       date not null default current_date,
  store_account_id  uuid references public.store_accounts(id) on delete cascade,
  revenue_today     bigint not null default 0,
  revenue_total     bigint not null default 0,
  revenue_estimate  bigint not null default 0,
  chat_count        int not null default 0,
  upload_count      int not null default 0,
  kombo_non_garansi int not null default 0,
  kombo_garansi     int not null default 0,
  loss_notes        text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(report_date, store_account_id)
);

-- 4. Detail deal (produk terjual per report)
create table if not exists public.report_deals (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references public.daily_sales_reports(id) on delete cascade,
  product_name text not null,
  qty          int not null default 1,
  created_at   timestamptz not null default now()
);

-- 5. Pending items (leads belum closing)
create table if not exists public.report_pending_items (
  id               uuid primary key default gen_random_uuid(),
  store_account_id uuid references public.store_accounts(id),
  report_date      date not null default current_date,
  product_name     text not null,
  status           text not null default 'pending',
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- 6. Tambah kolom store_account_id ke warehouse_orders
alter table public.warehouse_orders
  add column if not exists store_account_id uuid references public.store_accounts(id);

-- ── RLS ──
alter table public.store_accounts       enable row level security;
alter table public.monthly_targets      enable row level security;
alter table public.daily_sales_reports  enable row level security;
alter table public.report_deals         enable row level security;
alter table public.report_pending_items enable row level security;

-- Store accounts: baca & tulis untuk semua user terautentikasi
drop policy if exists "sa_all" on public.store_accounts;
create policy "sa_all" on public.store_accounts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Monthly targets: admin & super admin
drop policy if exists "mt_select" on public.monthly_targets;
create policy "mt_select" on public.monthly_targets
  for select using (public.has_section('dashboard'));
drop policy if exists "mt_insert" on public.monthly_targets;
create policy "mt_insert" on public.monthly_targets
  for insert with check (public.can_edit());
drop policy if exists "mt_update" on public.monthly_targets;
create policy "mt_update" on public.monthly_targets
  for update using (public.can_edit());
drop policy if exists "mt_delete" on public.monthly_targets;
create policy "mt_delete" on public.monthly_targets
  for delete using (public.can_edit());

-- Daily reports
drop policy if exists "dsr_select" on public.daily_sales_reports;
create policy "dsr_select" on public.daily_sales_reports
  for select using (public.has_section('dashboard'));
drop policy if exists "dsr_insert" on public.daily_sales_reports;
create policy "dsr_insert" on public.daily_sales_reports
  for insert with check (public.can_edit());
drop policy if exists "dsr_update" on public.daily_sales_reports;
create policy "dsr_update" on public.daily_sales_reports
  for update using (public.can_edit());
drop policy if exists "dsr_delete" on public.daily_sales_reports;
create policy "dsr_delete" on public.daily_sales_reports
  for delete using (public.can_edit());

-- Report deals
drop policy if exists "rd_select" on public.report_deals;
create policy "rd_select" on public.report_deals
  for select using (public.has_section('dashboard'));
drop policy if exists "rd_insert" on public.report_deals;
create policy "rd_insert" on public.report_deals
  for insert with check (public.can_edit());
drop policy if exists "rd_delete" on public.report_deals;
create policy "rd_delete" on public.report_deals
  for delete using (public.can_edit());

-- Pending items
drop policy if exists "rpi_select" on public.report_pending_items;
create policy "rpi_select" on public.report_pending_items
  for select using (public.has_section('dashboard'));
drop policy if exists "rpi_insert" on public.report_pending_items;
create policy "rpi_insert" on public.report_pending_items
  for insert with check (public.can_edit());
drop policy if exists "rpi_update" on public.report_pending_items;
create policy "rpi_update" on public.report_pending_items
  for update using (public.can_edit());
drop policy if exists "rpi_delete" on public.report_pending_items;
create policy "rpi_delete" on public.report_pending_items
  for delete using (public.can_edit());
