-- TAL: proof upload + open RLS untuk semua user
-- Jalankan di Supabase SQL Editor (marketplaceminkla-deb)

-- 1. Tambah kolom bukti ke tal_items
alter table public.tal_items
  add column if not exists proof_url  text,
  add column if not exists proof_name text;

-- 2. Buka RLS tal_items untuk semua authenticated user
drop policy if exists "tal_select" on public.tal_items;
drop policy if exists "tal_insert" on public.tal_items;
drop policy if exists "tal_update" on public.tal_items;
drop policy if exists "tal_delete" on public.tal_items;
drop policy if exists "tal_all"    on public.tal_items;

alter table public.tal_items enable row level security;

create policy "tal_all" on public.tal_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- 3. Storage bucket untuk file bukti TAL
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tal-proof', 'tal-proof', true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
on conflict (id) do nothing;

-- 4. Storage policies
drop policy if exists "tal_proof_upload" on storage.objects;
drop policy if exists "tal_proof_read"   on storage.objects;
drop policy if exists "tal_proof_delete" on storage.objects;

create policy "tal_proof_upload" on storage.objects
  for insert with check (bucket_id = 'tal-proof' and auth.uid() is not null);

create policy "tal_proof_read" on storage.objects
  for select using (bucket_id = 'tal-proof');

create policy "tal_proof_delete" on storage.objects
  for delete using (bucket_id = 'tal-proof' and auth.uid() is not null);
