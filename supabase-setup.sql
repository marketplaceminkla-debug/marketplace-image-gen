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
