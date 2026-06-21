-- ============================================================
-- Marketplace Workspace — Product Listing module setup (Phase 4)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh has_section()/can_edit() dari Phase 3 sudah ada.)
-- ============================================================

-- New Product
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  note             text,
  status_shopee    text not null default 'pending' check (status_shopee    in ('pending','process','done')),
  status_tokopedia text not null default 'pending' check (status_tokopedia in ('pending','process','done')),
  status_tiktok    text not null default 'pending' check (status_tiktok    in ('pending','process','done')),
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

-- Update Harga
create table if not exists public.price_updates (
  id           uuid primary key default gen_random_uuid(),
  product_name text not null,
  old_price    bigint not null default 0,
  new_price    bigint not null,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- Database Fee Marketplace
create table if not exists public.marketplace_fees (
  id          uuid primary key default gen_random_uuid(),
  marketplace text not null,
  fee_name    text not null,
  value       numeric not null default 0,
  unit        text not null default '%' check (unit in ('%','Rp')),
  note        text,
  updated_at  timestamptz not null default now()
);

-- Row Level Security (read: punya akses 'product'; tulis: Admin/Super Admin)
alter table public.products         enable row level security;
alter table public.price_updates    enable row level security;
alter table public.marketplace_fees enable row level security;

drop policy if exists products_select on public.products;
create policy products_select on public.products for select using ( public.has_section('product') );
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert with check ( public.can_edit() );
drop policy if exists products_update on public.products;
create policy products_update on public.products for update using ( public.can_edit() ) with check ( public.can_edit() );
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete using ( public.can_edit() );

drop policy if exists price_select on public.price_updates;
create policy price_select on public.price_updates for select using ( public.has_section('product') );
drop policy if exists price_insert on public.price_updates;
create policy price_insert on public.price_updates for insert with check ( public.can_edit() );
drop policy if exists price_delete on public.price_updates;
create policy price_delete on public.price_updates for delete using ( public.can_edit() );

drop policy if exists fees_select on public.marketplace_fees;
create policy fees_select on public.marketplace_fees for select using ( public.has_section('product') );
drop policy if exists fees_insert on public.marketplace_fees;
create policy fees_insert on public.marketplace_fees for insert with check ( public.can_edit() );
drop policy if exists fees_update on public.marketplace_fees;
create policy fees_update on public.marketplace_fees for update using ( public.can_edit() ) with check ( public.can_edit() );
drop policy if exists fees_delete on public.marketplace_fees;
create policy fees_delete on public.marketplace_fees for delete using ( public.can_edit() );
