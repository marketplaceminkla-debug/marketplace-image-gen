-- ============================================================
-- Stock Management — Retur & Gagal Kirim: pilih dari orderan yang sudah ada
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Boleh dijalankan berkali-kali, aman/idempotent.)
-- ============================================================

-- Kolom baru di stock_returns: link balik ke orderan asal, toko/platform,
-- dan harga barang (ditarik otomatis dari orderan pas dipilih).
alter table public.stock_returns add column if not exists store_account_id uuid references public.store_accounts(id) on delete set null;
alter table public.stock_returns add column if not exists revenue numeric;
alter table public.stock_returns add column if not exists source_order_id uuid references public.warehouse_orders(id) on delete set null;

-- Stock Management sekarang perlu baca warehouse_orders (buat fitur cari
-- orderan by Nomor Pesanan pas nambah retur). Lebarin SELECT-nya warehouse_orders
-- supaya akun dengan akses 'stock' juga boleh baca (masih dibatasi warehouse_scope-nya).
drop policy if exists who_select on public.warehouse_orders;
create policy who_select on public.warehouse_orders for select
  using (
    (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id))
    or public.has_section('dashboard')
    or (public.has_section('stock') and public.warehouse_allowed(warehouse_id))
  );
