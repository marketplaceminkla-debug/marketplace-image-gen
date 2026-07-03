-- ============================================================
-- Fix: notifikasi lonceng ikut aturan cabang gudang (warehouse_scope)
-- Jalankan SEKALI di Supabase → SQL Editor → Run.
-- (Butuh supabase-notifications-setup.sql DAN supabase-warehouse-scope-setup.sql
--  sudah dijalankan lebih dulu.)
-- ============================================================

-- Simpan cabang mana yang punya orderan ini, biar notifikasinya bisa disaring.
alter table public.notifications add column if not exists warehouse_id uuid references public.warehouses(id) on delete cascade;

-- Select policy: notifikasi kategori 'warehouse' sekarang juga wajib lolos
-- warehouse_allowed() — sama persis kayak aturan orderan aslinya.
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select
  using (
    (category = 'warehouse' and public.has_section('warehouse') and (warehouse_id is null or public.warehouse_allowed(warehouse_id)))
    or (category = 'product' and public.has_section('product'))
  );

-- Trigger orderan baru: sekarang nyimpen warehouse_id juga.
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
  insert into public.notifications (category, title, body, target_view, actor_name, warehouse_id)
  values ('warehouse', 'Orderan baru', v_first || v_extra, 'wh-orders', coalesce(v_actor, 'Tim'), new.warehouse_id);
  return new;
end;
$$;
