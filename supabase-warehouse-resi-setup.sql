-- ============================================================
-- Multiwarehouse — tambahan: kolom resi + bucket storage
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- ============================================================

-- Kolom URL resi (opsional) di tiap order
alter table public.warehouse_orders add column if not exists resi_url text;

-- Bucket publik buat simpan file resi
insert into storage.buckets (id, name, public)
values ('warehouse-resi', 'warehouse-resi', true)
on conflict (id) do nothing;

-- Policy storage: user yang punya akses 'warehouse' boleh upload; baca publik
drop policy if exists "warehouse_resi_read" on storage.objects;
create policy "warehouse_resi_read" on storage.objects
  for select using ( bucket_id = 'warehouse-resi' );

drop policy if exists "warehouse_resi_insert" on storage.objects;
create policy "warehouse_resi_insert" on storage.objects
  for insert to authenticated
  with check ( bucket_id = 'warehouse-resi' and public.has_section('warehouse') );

drop policy if exists "warehouse_resi_delete" on storage.objects;
create policy "warehouse_resi_delete" on storage.objects
  for delete to authenticated
  using ( bucket_id = 'warehouse-resi' and public.has_section('warehouse') );
