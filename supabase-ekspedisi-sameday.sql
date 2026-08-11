-- Add "Sameday" as an allowed value for warehouse_orders.ekspedisi.
-- Run this once in the Supabase SQL Editor.

alter table public.warehouse_orders drop constraint if exists warehouse_orders_ekspedisi_check;
alter table public.warehouse_orders add constraint warehouse_orders_ekspedisi_check
  check (ekspedisi in ('instan', 'sameday', 'reguler'));
