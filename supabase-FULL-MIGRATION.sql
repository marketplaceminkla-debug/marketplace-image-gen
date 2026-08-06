-- ============================================================
-- FULL MIGRATION — New Supabase Project
-- Jalankan SEKALI di SQL Editor project baru
-- Project: quayxqrifysgymfntmfj
-- ============================================================

-- ── 1. TEMPLATES & SHOPEE TEMPLATES ──────────────────────────
create table if not exists public.templates (
  id           text primary key,
  name         text not null,
  filename     text not null,
  storage_path text not null,
  public_url   text not null,
  size         bigint not null,
  uploaded_at  timestamptz not null default now()
);
create index if not exists templates_uploaded_at_idx on public.templates (uploaded_at desc);
alter table public.templates enable row level security;
drop policy if exists "Allow all" on public.templates;
create policy "Allow all" on public.templates for all using (true) with check (true);

create table if not exists public.shopee_templates (
  id           text primary key,
  name         text not null,
  filename     text not null,
  storage_path text not null,
  public_url   text not null,
  size         bigint not null,
  uploaded_at  timestamptz not null default now()
);
create index if not exists shopee_templates_uploaded_at_idx on public.shopee_templates (uploaded_at desc);
alter table public.shopee_templates enable row level security;
drop policy if exists "Allow all" on public.shopee_templates;
create policy "Allow all" on public.shopee_templates for all using (true) with check (true);

-- Storage policies anon
drop policy if exists "shopee tmpl upload"  on storage.objects;
drop policy if exists "shopee tmpl read"    on storage.objects;
drop policy if exists "shopee tmpl delete"  on storage.objects;
drop policy if exists "product photos upload" on storage.objects;
drop policy if exists "product photos read"   on storage.objects;
drop policy if exists "product photos delete" on storage.objects;
create policy "shopee tmpl upload"  on storage.objects for insert to anon with check (bucket_id = 'shopee-templates');
create policy "shopee tmpl read"    on storage.objects for select to anon using  (bucket_id = 'shopee-templates');
create policy "shopee tmpl delete"  on storage.objects for delete to anon using  (bucket_id = 'shopee-templates');
create policy "product photos upload" on storage.objects for insert to anon with check (bucket_id = 'product-photos');
create policy "product photos read"   on storage.objects for select to anon using  (bucket_id = 'product-photos');
create policy "product photos delete" on storage.objects for delete to anon using  (bucket_id = 'product-photos');

-- Storage policies authenticated
drop policy if exists "templates upload auth"      on storage.objects;
drop policy if exists "templates read auth"        on storage.objects;
drop policy if exists "templates delete auth"      on storage.objects;
drop policy if exists "product photos upload auth" on storage.objects;
drop policy if exists "product photos read auth"   on storage.objects;
drop policy if exists "product photos delete auth" on storage.objects;
drop policy if exists "shopee tmpl upload auth"    on storage.objects;
drop policy if exists "shopee tmpl read auth"      on storage.objects;
drop policy if exists "shopee tmpl delete auth"    on storage.objects;
create policy "templates upload auth"      on storage.objects for insert to authenticated with check (bucket_id = 'templates');
create policy "templates read auth"        on storage.objects for select to authenticated using  (bucket_id = 'templates');
create policy "templates delete auth"      on storage.objects for delete to authenticated using  (bucket_id = 'templates');
create policy "product photos upload auth" on storage.objects for insert to authenticated with check (bucket_id = 'product-photos');
create policy "product photos read auth"   on storage.objects for select to authenticated using  (bucket_id = 'product-photos');
create policy "product photos delete auth" on storage.objects for delete to authenticated using  (bucket_id = 'product-photos');
create policy "shopee tmpl upload auth"    on storage.objects for insert to authenticated with check (bucket_id = 'shopee-templates');
create policy "shopee tmpl read auth"      on storage.objects for select to authenticated using  (bucket_id = 'shopee-templates');
create policy "shopee tmpl delete auth"    on storage.objects for delete to authenticated using  (bucket_id = 'shopee-templates');

-- ── 2. AUTH / PROFILES ───────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  role          text not null default 'staff' check (role in ('super_admin','admin','staff')),
  access        text[] not null default '{}',
  is_active     boolean not null default false,
  warehouse_scope uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_super_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin' and is_active = true);
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_super_admin());
drop policy if exists profiles_update_super on public.profiles;
create policy profiles_update_super on public.profiles for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ── 3. HELPER FUNCTIONS ──────────────────────────────────────
create or replace function public.has_section(section text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and (role = 'super_admin' or section = any(access))
  );
$$;

create or replace function public.can_edit()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active and role in ('super_admin','admin')
  );
$$;

create or replace function public.warehouse_allowed(wh_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select role = 'super_admin' or warehouse_scope = '{}' or wh_id = any(warehouse_scope)
    from public.profiles
    where id = auth.uid() and is_active
  ), false);
$$;

-- ── 4. REVENUE ───────────────────────────────────────────────
create table if not exists public.revenue_settings (
  id         int primary key default 1 check (id = 1),
  target     bigint not null default 0,
  currency   text not null default 'IDR',
  updated_at timestamptz not null default now()
);
insert into public.revenue_settings (id, target) values (1, 0) on conflict (id) do nothing;

create table if not exists public.revenue_entries (
  id         uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  amount     bigint not null,
  note       text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.revenue_settings enable row level security;
alter table public.revenue_entries  enable row level security;
drop policy if exists rev_set_select on public.revenue_settings;
create policy rev_set_select on public.revenue_settings for select using (public.has_section('dashboard'));
drop policy if exists rev_set_update on public.revenue_settings;
create policy rev_set_update on public.revenue_settings for update using (public.can_edit()) with check (public.can_edit());
drop policy if exists rev_ent_select on public.revenue_entries;
create policy rev_ent_select on public.revenue_entries for select using (public.has_section('dashboard'));
drop policy if exists rev_ent_insert on public.revenue_entries;
create policy rev_ent_insert on public.revenue_entries for insert with check (public.can_edit());
drop policy if exists rev_ent_delete on public.revenue_entries;
create policy rev_ent_delete on public.revenue_entries for delete using (public.can_edit());

-- ── 5. PRODUCTS ──────────────────────────────────────────────
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

create table if not exists public.price_updates (
  id           uuid primary key default gen_random_uuid(),
  product_name text not null,
  old_price    bigint not null default 0,
  new_price    bigint not null,
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create table if not exists public.marketplace_fees (
  id          uuid primary key default gen_random_uuid(),
  marketplace text not null,
  fee_name    text not null,
  value       numeric not null default 0,
  unit        text not null default '%' check (unit in ('%','Rp')),
  note        text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.sku_replacements (
  id         uuid primary key default gen_random_uuid(),
  old_sku    text not null,
  new_sku    text,
  is_eol     boolean not null default false,
  note       text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.products         enable row level security;
alter table public.price_updates    enable row level security;
alter table public.marketplace_fees enable row level security;
alter table public.sku_replacements enable row level security;

-- products (all staff with 'product' access)
drop policy if exists products_select on public.products;
create policy products_select on public.products for select using (public.has_section('product'));
drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert with check (public.has_section('product'));
drop policy if exists products_update on public.products;
create policy products_update on public.products for update using (public.has_section('product')) with check (public.has_section('product'));
drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete using (public.has_section('product'));

-- price_updates
drop policy if exists price_select on public.price_updates;
create policy price_select on public.price_updates for select using (public.has_section('product'));
drop policy if exists price_insert on public.price_updates;
create policy price_insert on public.price_updates for insert with check (public.has_section('product'));
drop policy if exists price_delete on public.price_updates;
create policy price_delete on public.price_updates for delete using (public.has_section('product'));

-- marketplace_fees
drop policy if exists fees_select on public.marketplace_fees;
create policy fees_select on public.marketplace_fees for select using (public.has_section('product'));
drop policy if exists fees_insert on public.marketplace_fees;
create policy fees_insert on public.marketplace_fees for insert with check (public.has_section('product'));
drop policy if exists fees_update on public.marketplace_fees;
create policy fees_update on public.marketplace_fees for update using (public.has_section('product')) with check (public.has_section('product'));
drop policy if exists fees_delete on public.marketplace_fees;
create policy fees_delete on public.marketplace_fees for delete using (public.has_section('product'));

-- sku_replacements
drop policy if exists sku_select on public.sku_replacements;
create policy sku_select on public.sku_replacements for select using (public.has_section('product'));
drop policy if exists sku_insert on public.sku_replacements;
create policy sku_insert on public.sku_replacements for insert with check (public.has_section('product'));
drop policy if exists sku_update on public.sku_replacements;
create policy sku_update on public.sku_replacements for update using (public.has_section('product')) with check (public.has_section('product'));
drop policy if exists sku_delete on public.sku_replacements;
create policy sku_delete on public.sku_replacements for delete using (public.has_section('product'));

-- ── 6. WAREHOUSES & ORDERS ───────────────────────────────────
create table if not exists public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  wa_number  text not null,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_orders (
  id               uuid primary key default gen_random_uuid(),
  warehouse_id     uuid references public.warehouses(id) on delete cascade,
  item_name        text not null default '',
  items            text[] not null default '{}',
  item_qtys        int[] not null default '{}',
  so_number        text,
  order_number     text,
  keterangan       text,
  ekspedisi        text not null default 'reguler' check (ekspedisi in ('instan','reguler')),
  shipment         text not null default 'pickup'  check (shipment  in ('dropoff','pickup')),
  status           text not null default 'new'     check (status    in ('new','process','approved','denied','done')),
  order_date       date not null default current_date,
  resi_url         text,
  store_account_id uuid,
  revenue          bigint not null default 0,
  kombo_hemat      text,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now()
);

alter table public.warehouses       enable row level security;
alter table public.warehouse_orders enable row level security;

drop policy if exists wh_select on public.warehouses;
create policy wh_select on public.warehouses for select using (public.has_section('warehouse'));
drop policy if exists wh_insert on public.warehouses;
create policy wh_insert on public.warehouses for insert with check (public.has_section('warehouse'));
drop policy if exists wh_update on public.warehouses;
create policy wh_update on public.warehouses for update using (public.has_section('warehouse')) with check (public.has_section('warehouse'));
drop policy if exists wh_delete on public.warehouses;
create policy wh_delete on public.warehouses for delete using (public.has_section('warehouse'));

drop policy if exists who_select on public.warehouse_orders;
create policy who_select on public.warehouse_orders for select
  using (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id));
drop policy if exists who_insert on public.warehouse_orders;
create policy who_insert on public.warehouse_orders for insert
  with check (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id));
drop policy if exists who_update on public.warehouse_orders;
create policy who_update on public.warehouse_orders for update
  using (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id))
  with check (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id));
drop policy if exists who_delete on public.warehouse_orders;
create policy who_delete on public.warehouse_orders for delete
  using (public.has_section('warehouse') and public.warehouse_allowed(warehouse_id));

-- Realtime
do $$ begin
  alter publication supabase_realtime add table public.warehouse_orders;
exception when others then null;
end $$;

-- ── 7. STORE ACCOUNTS & REPORTING ────────────────────────────
create table if not exists public.store_accounts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  platform     text not null default 'shopee',
  pic_name     text not null,
  pic_wa       text,
  categories   text[] not null default '{}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.store_accounts (name, platform, pic_name, categories)
select name, platform, pic_name, categories from (values
  ('SHOPEE KLA',        'shopee',    'Rona',   array['Laptop', 'Tablet', 'AIO']::text[]),
  ('SHOPEE KLA',        'shopee',    'Diza',   array['Aksesoris']::text[]),
  ('TOKPED KLA',        'tokopedia', 'Diza',   array['All']::text[]),
  ('SHOPEE LENOVO SMG', 'shopee',    'Alfin',  array['All']::text[]),
  ('GADGETKLIK',        'shopee',    'Alfin',  array['All']::text[]),
  ('ALL STORES',        'shopee',    'Mauren', array['All']::text[])
) as v(name, platform, pic_name, categories)
where not exists (select 1 from public.store_accounts);

-- FK: warehouse_orders -> store_accounts
do $$ begin
  alter table public.warehouse_orders
    add constraint warehouse_orders_store_account_id_fkey
    foreign key (store_account_id) references public.store_accounts(id);
exception when others then null;
end $$;

create table if not exists public.monthly_targets (
  id         uuid primary key default gen_random_uuid(),
  pic_name   text not null,
  month      int not null check (month between 1 and 12),
  year       int not null check (year >= 2024),
  target     bigint not null default 0,
  created_at timestamptz not null default now(),
  unique(pic_name, month, year)
);

create table if not exists public.daily_sales_reports (
  id                uuid primary key default gen_random_uuid(),
  report_date       date not null default current_date,
  store_account_id  uuid references public.store_accounts(id) on delete cascade,
  revenue_today     bigint not null default 0,
  revenue_total     bigint not null default 0,
  revenue_estimate  bigint not null default 0,
  chat_count        int not null default 0,
  upload_count      int not null default 0,
  kombo_non_garansi int not null default 0,
  kombo_garansi     int not null default 0,
  loss_notes        text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(report_date, store_account_id)
);

create table if not exists public.report_deals (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references public.daily_sales_reports(id) on delete cascade,
  product_name text not null,
  qty          int not null default 1,
  created_at   timestamptz not null default now()
);

create table if not exists public.report_pending_items (
  id               uuid primary key default gen_random_uuid(),
  store_account_id uuid references public.store_accounts(id),
  report_date      date not null default current_date,
  product_name     text not null,
  status           text not null default 'pending',
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.store_accounts       enable row level security;
alter table public.monthly_targets      enable row level security;
alter table public.daily_sales_reports  enable row level security;
alter table public.report_deals         enable row level security;
alter table public.report_pending_items enable row level security;

drop policy if exists "sa_all" on public.store_accounts;
create policy "sa_all" on public.store_accounts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "mt_all" on public.monthly_targets;
create policy "mt_all" on public.monthly_targets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "dsr_all" on public.daily_sales_reports;
create policy "dsr_all" on public.daily_sales_reports
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "rd_all" on public.report_deals;
create policy "rd_all" on public.report_deals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "rpi_all" on public.report_pending_items;
create policy "rpi_all" on public.report_pending_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 8. TAL ITEMS ─────────────────────────────────────────────
create table if not exists public.tal_items (
  id         uuid primary key default gen_random_uuid(),
  month      text not null,
  title      text not null,
  category   text not null default 'target' check (category in ('target','strategi','lainnya')),
  is_done    boolean not null default false,
  pic_name   text,
  proof_url  text,
  proof_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.tal_items enable row level security;
drop policy if exists "tal_all" on public.tal_items;
create policy "tal_all" on public.tal_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ── 9. NOTIFICATIONS ─────────────────────────────────────────
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in ('warehouse', 'product')),
  title        text not null,
  body         text,
  target_view  text not null,
  actor_name   text,
  warehouse_id uuid references public.warehouses(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select using (
  (category = 'warehouse' and public.has_section('warehouse') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)))
  or (category = 'product' and public.has_section('product'))
);

create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text; v_first text; v_extra text := '';
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  v_first := coalesce(new.items[1], new.item_name, 'barang baru');
  if array_length(new.items, 1) > 1 then v_extra := ' +' || (array_length(new.items, 1) - 1)::text; end if;
  insert into public.notifications (category, title, body, target_view, actor_name, warehouse_id)
  values ('warehouse', 'Orderan baru', v_first || v_extra, 'wh-orders', coalesce(v_actor, 'Tim'), new.warehouse_id);
  return new;
end;
$$;
drop trigger if exists trg_notify_new_order on public.warehouse_orders;
create trigger trg_notify_new_order after insert on public.warehouse_orders
for each row execute function public.notify_new_order();

create or replace function public.notify_new_product()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  insert into public.notifications (category, title, body, target_view, actor_name)
  values ('product', 'Produk baru', new.name, 'prod-new', coalesce(v_actor, 'Tim'));
  return new;
end;
$$;
drop trigger if exists trg_notify_new_product on public.products;
create trigger trg_notify_new_product after insert on public.products
for each row execute function public.notify_new_product();

create or replace function public.notify_price_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text;
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  insert into public.notifications (category, title, body, target_view, actor_name)
  values ('product', 'Update harga',
    new.product_name || ': Rp' || round(new.old_price)::bigint::text || ' -> Rp' || round(new.new_price)::bigint::text,
    'prod-price', coalesce(v_actor, 'Tim'));
  return new;
end;
$$;
drop trigger if exists trg_notify_price_update on public.price_updates;
create trigger trg_notify_price_update after insert on public.price_updates
for each row execute function public.notify_price_update();

create or replace function public.notify_sku_replacement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text; v_title text; v_body text;
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  if new.is_eol then v_title := 'Produk EOL'; v_body := new.old_sku;
  else v_title := 'SKU pengganti baru'; v_body := new.old_sku || coalesce(' -> ' || new.new_sku, '');
  end if;
  insert into public.notifications (category, title, body, target_view, actor_name)
  values ('product', v_title, v_body, 'prod-sku', coalesce(v_actor, 'Tim'));
  return new;
end;
$$;
drop trigger if exists trg_notify_sku on public.sku_replacements;
create trigger trg_notify_sku after insert on public.sku_replacements
for each row execute function public.notify_sku_replacement();

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

-- ── 10. STOCK RETURNS ─────────────────────────────────────────
create table if not exists public.stock_returns (
  id            uuid primary key default gen_random_uuid(),
  return_date   date not null,
  so_number     text,
  order_number  text,
  item_name     text,
  items         text[] not null default '{}',
  item_qtys     int[]  not null default '{}',
  qty           int not null default 1,
  warehouse_id  uuid references public.warehouses(id) on delete set null,
  category      text not null check (category in ('tukar_unit','refund','refund_sebagian','ganti_item')),
  reason        text,
  proof_url     text,
  status        text not null default 'new' check (status in ('new','ship_user','dispute','ship_seller','done')),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

alter table public.stock_returns enable row level security;
drop policy if exists sr_select on public.stock_returns;
create policy sr_select on public.stock_returns for select
  using (public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)));
drop policy if exists sr_insert on public.stock_returns;
create policy sr_insert on public.stock_returns for insert
  with check (public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)));
drop policy if exists sr_update on public.stock_returns;
create policy sr_update on public.stock_returns for update
  using (public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)))
  with check (public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)));
drop policy if exists sr_delete on public.stock_returns;
create policy sr_delete on public.stock_returns for delete
  using (public.has_section('stock') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)));

do $$ begin
  alter publication supabase_realtime add table public.stock_returns;
exception when others then null;
end $$;

-- ── 11. KPI INDICATORS & ACTUALS ─────────────────────────────
create table if not exists public.kpi_indicators (
  id           uuid primary key default gen_random_uuid(),
  pic_name     text not null,
  category     text not null default 'proses',
  name         text not null,
  target_value numeric not null default 0,
  unit         text not null default 'number',
  bobot        numeric not null default 0,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  source_field text,
  created_at   timestamptz not null default now()
);

create table if not exists public.kpi_actuals (
  id           uuid primary key default gen_random_uuid(),
  indicator_id uuid references public.kpi_indicators(id) on delete cascade,
  month        text not null,
  actual_value numeric not null default 0,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),
  unique(indicator_id, month)
);

create table if not exists public.kpi_targets (
  id           uuid primary key default gen_random_uuid(),
  indicator_id uuid references public.kpi_indicators(id) on delete cascade,
  month        text not null,
  target_value numeric not null,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now(),
  unique(indicator_id, month)
);

alter table public.kpi_indicators enable row level security;
alter table public.kpi_actuals    enable row level security;
alter table public.kpi_targets    enable row level security;

drop policy if exists "ki_all" on public.kpi_indicators;
create policy "ki_all" on public.kpi_indicators
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "ka_all" on public.kpi_actuals;
create policy "ka_all" on public.kpi_actuals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "kt_all" on public.kpi_targets;
create policy "kt_all" on public.kpi_targets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Seed KPI indicators (hanya jika kosong)
insert into public.kpi_indicators (pic_name, category, name, target_value, unit, bobot, sort_order, source_field)
select pic_name, category, name, target_value, unit, bobot, sort_order, source_field from (values
  ('Rona',   'proses', 'Upload Produk Baru',                       25,          'number',  10, 1, null),
  ('Rona',   'proses', 'Combo Hemat / SG',                         70,          'number',  10, 2, 'kombo_total'),
  ('Rona',   'proses', 'Rating Membalas Pesan',                    100,         'percent', 10, 3, null),
  ('Rona',   'hasil',  'Revenue Laptop',                           2500000000,  'currency',40, 4, 'revenue'),
  ('Rona',   'hasil',  'Margin Laptop',                            150000000,   'currency',30, 5, null),
  ('Diza',   'proses', 'Upload Produk Baru',                       50,          'number',  10, 1, null),
  ('Diza',   'proses', 'Optimasi Produk (Judul, Foto, Deskripsi)', 50,          'number',  10, 2, null),
  ('Diza',   'proses', 'Rating Membalas Pesan',                    100,         'percent', 10, 3, null),
  ('Diza',   'hasil',  'Revenue Aksesoris (Shopee KLA & Tokped)',  150000000,   'currency',40, 4, 'revenue'),
  ('Diza',   'hasil',  'Margin Aksesoris (Shopee KLA & Tokped)',   9000000,     'currency',30, 5, null),
  ('Alfin',  'proses', 'Upload Produk Baru (Gadgetklik)',          100,         'number',  20, 1, null),
  ('Alfin',  'proses', 'Upload Konten IG Gadgetklik',              20,          'number',  10, 2, null),
  ('Alfin',  'proses', 'Rating Membalas Pesan',                    100,         'percent', 10, 3, null),
  ('Alfin',  'hasil',  'Produk Terjual di Gadgetklik',             20,          'number',  10, 4, null),
  ('Alfin',  'hasil',  'Revenue (Lenovo & Gadgetklik)',            350000000,   'currency',30, 5, 'revenue'),
  ('Alfin',  'hasil',  'Margin All (Lenovo & Gadgetklik)',         21000000,    'currency',20, 6, null),
  ('Mauren', 'proses', 'Ketepatan Pengiriman',                     100,         'percent', 15, 1, null),
  ('Mauren', 'proses', 'Kesehatan Toko',                           100,         'percent', 15, 2, null),
  ('Mauren', 'hasil',  'Revenue',                                  3000000000,  'currency',40, 3, 'revenue'),
  ('Mauren', 'hasil',  'Margin',                                   180000000,   'currency',30, 4, null)
) as v(pic_name, category, name, target_value, unit, bobot, sort_order, source_field)
where not exists (select 1 from public.kpi_indicators);

-- ── 12. BOOTSTRAP SUPER ADMIN ────────────────────────────────
-- Jalankan setelah akun marketplaceminkla@gmail.com sudah daftar lewat halaman login.
-- update public.profiles
-- set role = 'super_admin', is_active = true,
--     access = array['dashboard','product','tools','warehouse','stock']
-- where email = 'marketplaceminkla@gmail.com';
