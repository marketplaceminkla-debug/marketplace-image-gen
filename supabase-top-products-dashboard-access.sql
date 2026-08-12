-- Let Dashboard-only accounts (no Multiwarehouse access) read warehouse_orders,
-- so the new "Top Produk" dashboard page works for them too.
-- Write access (insert/update/delete) stays warehouse-only — this only widens SELECT.
-- Run once in Supabase → SQL Editor.

drop policy if exists who_select on public.warehouse_orders;
create policy who_select on public.warehouse_orders for select
  using (
    (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id))
    or public.has_section('dashboard')
  );
