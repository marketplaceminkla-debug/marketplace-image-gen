-- ============================================================
-- Product Listing — izinkan SEMUA user (yang punya akses 'product')
-- untuk menulis/mengedit (bukan cuma Admin). Jalankan SEKALI.
-- ============================================================

-- products
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert with check ( public.has_section('product') );
drop policy if exists products_update on public.products;
create policy products_update on public.products for update using ( public.has_section('product') ) with check ( public.has_section('product') );
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete using ( public.has_section('product') );

-- price_updates
drop policy if exists price_insert on public.price_updates;
create policy price_insert on public.price_updates for insert with check ( public.has_section('product') );
drop policy if exists price_delete on public.price_updates;
create policy price_delete on public.price_updates for delete using ( public.has_section('product') );

-- marketplace_fees
drop policy if exists fees_insert on public.marketplace_fees;
create policy fees_insert on public.marketplace_fees for insert with check ( public.has_section('product') );
drop policy if exists fees_update on public.marketplace_fees;
create policy fees_update on public.marketplace_fees for update using ( public.has_section('product') ) with check ( public.has_section('product') );
drop policy if exists fees_delete on public.marketplace_fees;
create policy fees_delete on public.marketplace_fees for delete using ( public.has_section('product') );

-- sku_replacements
drop policy if exists sku_insert on public.sku_replacements;
create policy sku_insert on public.sku_replacements for insert with check ( public.has_section('product') );
drop policy if exists sku_update on public.sku_replacements;
create policy sku_update on public.sku_replacements for update using ( public.has_section('product') ) with check ( public.has_section('product') );
drop policy if exists sku_delete on public.sku_replacements;
create policy sku_delete on public.sku_replacements for delete using ( public.has_section('product') );
