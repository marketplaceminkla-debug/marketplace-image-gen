-- Target KPI per bulan (bukan global) + rename indikator Alfin
-- Jalankan di Supabase SQL Editor (marketplaceminkla-deb)

-- 1. Tabel target per bulan
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

-- 2. Rename indikator Alfin: Campaign/Voucher -> Upload Konten IG Gadgetklik
update public.kpi_indicators
set name = 'Upload Konten IG Gadgetklik'
where pic_name = 'Alfin' and name = 'Campaign / Voucher';
