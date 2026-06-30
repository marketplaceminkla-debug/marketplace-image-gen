-- ============================================================
-- KPI Tim & TAL per PIC Setup
-- Jalankan di Supabase SQL Editor (marketplaceminkla-deb)
-- ============================================================

-- 1. Tambah kolom pic_name ke tal_items
alter table public.tal_items
  add column if not exists pic_name text; -- 'Rona' | 'Diza' | 'Alfin' | 'Mauren' | null = semua

-- 2. Tabel indikator KPI per PIC (template tetap)
create table if not exists public.kpi_indicators (
  id          uuid primary key default gen_random_uuid(),
  pic_name    text not null,
  category    text not null default 'proses', -- 'proses' | 'hasil'
  name        text not null,
  target_value numeric not null default 0,
  unit        text not null default 'number', -- 'number' | 'percent' | 'currency'
  bobot       numeric not null default 0,     -- bobot persen 0-100
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 3. Aktual KPI per bulan (diisi tim)
create table if not exists public.kpi_actuals (
  id           uuid primary key default gen_random_uuid(),
  indicator_id uuid references public.kpi_indicators(id) on delete cascade,
  month        text not null, -- 'YYYY-MM'
  actual_value numeric not null default 0,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),
  unique(indicator_id, month)
);

-- 4. Seed indikator KPI (hanya jika tabel kosong)
insert into public.kpi_indicators (pic_name, category, name, target_value, unit, bobot, sort_order)
select pic_name, category, name, target_value, unit, bobot, sort_order from (values
  -- RONA
  ('Rona','proses','Upload Produk Baru',                        25,          'number',  10, 1),
  ('Rona','proses','Combo Hemat / SG',                          70,          'number',  10, 2),
  ('Rona','proses','Rating Membalas Pesan',                     100,         'percent', 10, 3),
  ('Rona','hasil', 'Revenue Laptop',                            2500000000,  'currency',40, 4),
  ('Rona','hasil', 'Margin Laptop',                             150000000,   'currency',30, 5),
  -- DIZA
  ('Diza','proses','Upload Produk Baru',                        50,          'number',  10, 1),
  ('Diza','proses','Optimasi Produk (Judul, Foto, Deskripsi)',  50,          'number',  10, 2),
  ('Diza','proses','Rating Membalas Pesan',                     100,         'percent', 10, 3),
  ('Diza','hasil', 'Revenue Aksesoris (Shopee KLA & Tokped)',   150000000,   'currency',40, 4),
  ('Diza','hasil', 'Margin Aksesoris (Shopee KLA & Tokped)',    9000000,     'currency',30, 5),
  -- ALFIN
  ('Alfin','proses','Upload Produk Baru (Gadgetklik)',          100,         'number',  20, 1),
  ('Alfin','proses','Campaign / Voucher',                       20,          'number',  10, 2),
  ('Alfin','proses','Rating Membalas Pesan',                    100,         'percent', 10, 3),
  ('Alfin','hasil', 'Produk Terjual di Gadgetklik',             20,          'number',  10, 4),
  ('Alfin','hasil', 'Revenue (Lenovo & Gadgetklik)',            350000000,   'currency',30, 5),
  ('Alfin','hasil', 'Margin All (Lenovo & Gadgetklik)',         21000000,    'currency',20, 6),
  -- MAUREN
  ('Mauren','proses','Ketepatan Pengiriman',                    100,         'percent', 15, 1),
  ('Mauren','proses','Kesehatan Toko',                          100,         'percent', 15, 2),
  ('Mauren','hasil', 'Revenue',                                 3000000000,  'currency',40, 3),
  ('Mauren','hasil', 'Margin',                                  180000000,   'currency',30, 4)
) as v(pic_name, category, name, target_value, unit, bobot, sort_order)
where not exists (select 1 from public.kpi_indicators);

-- 5. RLS
alter table public.kpi_indicators enable row level security;
alter table public.kpi_actuals    enable row level security;

drop policy if exists "ki_all" on public.kpi_indicators;
create policy "ki_all" on public.kpi_indicators
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "ka_all" on public.kpi_actuals;
create policy "ka_all" on public.kpi_actuals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
