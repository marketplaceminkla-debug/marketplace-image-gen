import { supabase } from "./supabase";

export type Ekspedisi = "instan" | "reguler";
export type Shipment = "dropoff" | "pickup";
export type OrderStatus = "new" | "process" | "approved" | "denied";

export const EKSPEDISI_LABEL: Record<Ekspedisi, string> = { instan: "Instan", reguler: "Reguler" };
export const SHIPMENT_LABEL: Record<Shipment, string> = { dropoff: "Drop off", pickup: "Pickup" };
export const STATUS_LABEL: Record<OrderStatus, string> = { new: "New", process: "Process", approved: "Approved", denied: "Denied" };

export interface Warehouse {
  id: string;
  name: string;
  wa_number: string;
  note: string | null;
  created_at: string;
}

export interface WarehouseOrder {
  id: string;
  warehouse_id: string;
  item_name: string;
  so_number: string | null;
  order_number: string | null;
  keterangan: string | null;
  ekspedisi: Ekspedisi;
  shipment: Shipment;
  status: OrderStatus;
  created_at: string;
}

/** Normalise an Indonesian WhatsApp number to wa.me form (62xxxxxxxxxx). */
export function normalizeWa(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

export function buildWaMessage(o: WarehouseOrder, wh: Warehouse): string {
  return (
    `Halo Gudang ${wh.name}, mohon dibantu cek & proses orderan berikut:\n\n` +
    `Nama Barang: ${o.item_name}\n` +
    `Nomor SO: ${o.so_number || "-"}\n` +
    `Nomor Pesanan: ${o.order_number || "-"}\n` +
    `Keterangan: ${o.keterangan || "-"}\n` +
    `Ekspedisi: ${EKSPEDISI_LABEL[o.ekspedisi]}\n` +
    `Shipment: ${SHIPMENT_LABEL[o.shipment]}\n\n` +
    `Terima kasih.`
  );
}

export function waLink(o: WarehouseOrder, wh: Warehouse): string {
  return `https://wa.me/${normalizeWa(wh.wa_number)}?text=${encodeURIComponent(buildWaMessage(o, wh))}`;
}

// ── Warehouses (nomor WA cabang) ──
export async function listWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase.from("warehouses").select("*").order("name", { ascending: true });
  if (error || !data) return [];
  return data as Warehouse[];
}
export async function addWarehouse(input: { name: string; wa_number: string; note: string | null }) {
  const { error } = await supabase.from("warehouses").insert(input);
  return { error: error ? error.message : null };
}
export async function updateWarehouse(id: string, patch: Partial<Warehouse>) {
  const { error } = await supabase.from("warehouses").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}
export async function deleteWarehouse(id: string) {
  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// ── Orders ──
export async function listOrders(): Promise<WarehouseOrder[]> {
  const { data, error } = await supabase.from("warehouse_orders").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as WarehouseOrder[];
}
export async function addOrder(input: Omit<WarehouseOrder, "id" | "status" | "created_at"> & { created_by: string | null }) {
  const { error } = await supabase.from("warehouse_orders").insert(input);
  return { error: error ? error.message : null };
}
export async function updateOrder(id: string, patch: Partial<WarehouseOrder>) {
  const { error } = await supabase.from("warehouse_orders").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}
export async function deleteOrder(id: string) {
  const { error } = await supabase.from("warehouse_orders").delete().eq("id", id);
  return { error: error ? error.message : null };
}
