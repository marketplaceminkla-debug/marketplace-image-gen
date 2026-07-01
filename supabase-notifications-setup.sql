-- ============================================================
-- Notification Center (bell icon) — Orderan Gudang & Product Listing
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh: has_section() dari Phase 3, tabel warehouse_orders/products/
--  price_updates/sku_replacements sudah ada.)
-- ============================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in ('warehouse', 'product')),
  title        text not null,
  body         text,
  target_view  text not null,
  actor_name   text,
  created_at   timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Only users with access to that category's section can see its notifications.
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select
  using (
    (category = 'warehouse' and public.has_section('warehouse'))
    or (category = 'product' and public.has_section('product'))
  );
-- No insert/update/delete policy for clients: rows are created only by the
-- trigger functions below (security definer), so the client can't fake one.

-- ── Trigger: orderan gudang baru ──
create or replace function public.notify_new_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_first text;
  v_extra text := '';
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  v_first := coalesce(new.items[1], new.item_name, 'barang baru');
  if array_length(new.items, 1) > 1 then
    v_extra := ' +' || (array_length(new.items, 1) - 1)::text;
  end if;
  insert into public.notifications (category, title, body, target_view, actor_name)
  values ('warehouse', 'Orderan baru', v_first || v_extra, 'wh-orders', coalesce(v_actor, 'Tim'));
  return new;
end;
$$;
drop trigger if exists trg_notify_new_order on public.warehouse_orders;
create trigger trg_notify_new_order after insert on public.warehouse_orders
for each row execute function public.notify_new_order();

-- ── Trigger: produk baru ──
create or replace function public.notify_new_product()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
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

-- ── Trigger: update harga ──
create or replace function public.notify_price_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  insert into public.notifications (category, title, body, target_view, actor_name)
  values (
    'product', 'Update harga',
    new.product_name || ': Rp' || round(new.old_price)::bigint::text || ' -> Rp' || round(new.new_price)::bigint::text,
    'prod-price', coalesce(v_actor, 'Tim')
  );
  return new;
end;
$$;
drop trigger if exists trg_notify_price_update on public.price_updates;
create trigger trg_notify_price_update after insert on public.price_updates
for each row execute function public.notify_price_update();

-- ── Trigger: SKU pengganti / EOL baru ──
create or replace function public.notify_sku_replacement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor text;
  v_title text;
  v_body text;
begin
  select full_name into v_actor from public.profiles where id = new.created_by;
  if new.is_eol then
    v_title := 'Produk EOL';
    v_body := new.old_sku;
  else
    v_title := 'SKU pengganti baru';
    v_body := new.old_sku || coalesce(' -> ' || new.new_sku, '');
  end if;
  insert into public.notifications (category, title, body, target_view, actor_name)
  values ('product', v_title, v_body, 'prod-sku', coalesce(v_actor, 'Tim'));
  return new;
end;
$$;
drop trigger if exists trg_notify_sku on public.sku_replacements;
create trigger trg_notify_sku after insert on public.sku_replacements
for each row execute function public.notify_sku_replacement();

-- Realtime, biar lonceng notif update instan tanpa refresh.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when others then null; -- sudah terdaftar / tidak masalah
end $$;
