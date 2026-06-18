-- ============================================================
-- Pixelseller — Supabase Setup
-- Jalankan ini sekali di Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)
-- ============================================================

-- 1. Tabel templates
create table if not exists templates (
  id           text primary key,
  name         text not null,
  filename     text not null,
  storage_path text not null,
  public_url   text not null,
  size         bigint not null,
  uploaded_at  timestamptz not null default now()
);

-- 2. Index biar sorting cepat
create index if not exists templates_uploaded_at_idx
  on templates (uploaded_at desc);

-- 3. RLS — aktifkan tapi izinkan semua (no-auth public app)
alter table templates enable row level security;

drop policy if exists "Allow all" on templates;
create policy "Allow all"
  on templates for all
  using (true)
  with check (true);

-- ============================================================
-- Storage bucket: buat manual di Dashboard
-- Storage → New bucket
--   Name   : templates
--   Public : ON  (centang "Public bucket")
-- ============================================================

-- ============================================================
-- Storage bucket KEDUA — untuk hasil generate foto produk
-- (dipakai fitur export Excel Shopee Mass Upload, supaya tiap
-- foto punya link publik yang bisa dimasukkan ke kolom Foto Sampul / Foto Produk)
-- Storage → New bucket
--   Name   : product-photos
--   Public : ON  (centang "Public bucket")
--
-- Tidak perlu tabel metadata terpisah — file diupload langsung
-- dan public URL-nya dipakai saat itu juga untuk mengisi Excel.
-- Catatan: foto di bucket ini TIDAK auto-terhapus. Karena Shopee
-- bisa mengambil ulang link foto kapan saja setelah produk live,
-- jangan hapus foto secara manual kecuali produk sudah tidak aktif.
-- Pantau penggunaan storage di Dashboard → Storage → Usage,
-- Supabase Free tier punya kuota 1GB.
-- ============================================================

-- 4. Tabel shopee_templates — menyimpan file Excel Mass Upload asli dari Shopee
--    (diupload sekali oleh user, dipakai berkali-kali untuk export data produk)
create table if not exists shopee_templates (
  id           text primary key,
  name         text not null,
  filename     text not null,
  storage_path text not null,
  public_url   text not null,
  size         bigint not null,
  uploaded_at  timestamptz not null default now()
);

create index if not exists shopee_templates_uploaded_at_idx
  on shopee_templates (uploaded_at desc);

alter table shopee_templates enable row level security;

drop policy if exists "Allow all" on shopee_templates;
create policy "Allow all"
  on shopee_templates for all
  using (true)
  with check (true);

-- ============================================================
-- Storage bucket KETIGA — untuk file template Excel Shopee asli
-- Storage → New bucket
--   Name   : shopee-templates
--   Public : ON  (centang "Public bucket")
-- ============================================================

-- ============================================================
-- 5. Storage POLICIES untuk bucket baru
--    (WAJIB — tanpa ini upload akan gagal "row violates row-level security")
--    Jalankan setelah kedua bucket (shopee-templates, product-photos) dibuat.
-- ============================================================

create policy "shopee tmpl upload"
  on storage.objects for insert to anon
  with check (bucket_id = 'shopee-templates');
create policy "shopee tmpl read"
  on storage.objects for select to anon
  using (bucket_id = 'shopee-templates');
create policy "shopee tmpl delete"
  on storage.objects for delete to anon
  using (bucket_id = 'shopee-templates');

create policy "product photos upload"
  on storage.objects for insert to anon
  with check (bucket_id = 'product-photos');
create policy "product photos read"
  on storage.objects for select to anon
  using (bucket_id = 'product-photos');
create policy "product photos delete"
  on storage.objects for delete to anon
  using (bucket_id = 'product-photos');
