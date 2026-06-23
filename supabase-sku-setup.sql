-- ============================================================
-- Product Listing — SKU Pengganti (dengan EOL)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh has_section()/can_edit() dari setup sebelumnya.)
-- ============================================================

create table if not exists public.sku_replacements (
  id         uuid primary key default gen_random_uuid(),
  old_sku    text not null,
  new_sku    text,                       -- null kalau EOL (tanpa pengganti)
  is_eol     boolean not null default false,
  note       text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.sku_replacements enable row level security;

drop policy if exists sku_select on public.sku_replacements;
create policy sku_select on public.sku_replacements for select using ( public.has_section('product') );
drop policy if exists sku_insert on public.sku_replacements;
create policy sku_insert on public.sku_replacements for insert with check ( public.can_edit() );
drop policy if exists sku_update on public.sku_replacements;
create policy sku_update on public.sku_replacements for update using ( public.can_edit() ) with check ( public.can_edit() );
drop policy if exists sku_delete on public.sku_replacements;
create policy sku_delete on public.sku_replacements for delete using ( public.can_edit() );
