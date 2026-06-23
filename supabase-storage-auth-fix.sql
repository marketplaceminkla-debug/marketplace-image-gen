-- ============================================================
-- FIX: upload Storage gagal "new row violates row-level security"
-- Sejak ada login, upload jalan sebagai role 'authenticated', tapi policy
-- storage lama cuma untuk 'anon'. Tambahkan policy untuk 'authenticated'
-- di semua bucket PixelSeller. Jalankan SEKALI di Supabase → SQL Editor.
-- ============================================================

-- Bucket: templates (frame/branding PixelSeller)
drop policy if exists "templates upload auth" on storage.objects;
create policy "templates upload auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'templates');
drop policy if exists "templates read auth" on storage.objects;
create policy "templates read auth" on storage.objects
  for select to authenticated using (bucket_id = 'templates');
drop policy if exists "templates delete auth" on storage.objects;
create policy "templates delete auth" on storage.objects
  for delete to authenticated using (bucket_id = 'templates');

-- Bucket: product-photos (hasil generate untuk link Shopee)
drop policy if exists "product photos upload auth" on storage.objects;
create policy "product photos upload auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-photos');
drop policy if exists "product photos read auth" on storage.objects;
create policy "product photos read auth" on storage.objects
  for select to authenticated using (bucket_id = 'product-photos');
drop policy if exists "product photos delete auth" on storage.objects;
create policy "product photos delete auth" on storage.objects
  for delete to authenticated using (bucket_id = 'product-photos');

-- Bucket: shopee-templates (file Excel Mass Upload asli)
drop policy if exists "shopee tmpl upload auth" on storage.objects;
create policy "shopee tmpl upload auth" on storage.objects
  for insert to authenticated with check (bucket_id = 'shopee-templates');
drop policy if exists "shopee tmpl read auth" on storage.objects;
create policy "shopee tmpl read auth" on storage.objects
  for select to authenticated using (bucket_id = 'shopee-templates');
drop policy if exists "shopee tmpl delete auth" on storage.objects;
create policy "shopee tmpl delete auth" on storage.objects
  for delete to authenticated using (bucket_id = 'shopee-templates');
