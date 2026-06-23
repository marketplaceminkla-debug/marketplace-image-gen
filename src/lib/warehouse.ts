import { supabase, WAREHOUSE_RESI_BUCKET } from "./supabase";

export type Ekspedisi = "instan" | "reguler";
export type Shipment = "dropoff" | "pickup";
export type OrderStatus = "new" | "process" | "approved" | "denied" | "done";

export const EKSPEDISI_LABEL: Record<Ekspedisi, string> = { instan: "Instan", reguler: "Reguler" };
export const SHIPMENT_LABEL: Record<Shipment, string> = { dropoff: "Drop off", pickup: "Pickup" };
export const STATUS_LABEL: Record<OrderStatus, string> = { new: "New", process: "Process", approved: "Approved", denied: "Denied", done: "Done" };

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
  order_date: string; // YYYY-MM-DD
  item_name: string;
  items: string[];
  so_number: string | null;
  order_number: string | null;
  keterangan: string | null;
  ekspedisi: Ekspedisi;
  shipment: Shipment;
  status: OrderStatus;
  resi_url: string | null;
  created_at: string;
}

/** Items of an order, falling back to the legacy single item_name field. */
export function orderItems(o: WarehouseOrder): string[] {
  if (o.items && o.items.length) return o.items;
  return o.item_name ? [o.item_name] : [];
}

/** Normalise an Indonesian WhatsApp number to wa.me form (62xxxxxxxxxx). */
export function normalizeWa(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d;
}

/** Detail block for one order (without the greeting/closing). */
function orderBlock(o: WarehouseOrder, indent = ""): string {
  // Note: resi link is intentionally NOT included in the WA message — only
  // the order details. The resi stays in the app for download.
  const items = orderItems(o);
  const lines: string[] = [];
  if (items.length <= 1) {
    lines.push(`Nama Barang: ${items[0] || "-"}`);
  } else {
    lines.push(`Nama Barang:`);
    items.forEach((it) => lines.push(`  - ${it}`));
  }
  lines.push(`Nomor SO: ${o.so_number || "-"}`);
  lines.push(`Nomor Pesanan: ${o.order_number || "-"}`);
  lines.push(`Keterangan: ${o.keterangan || "-"}`);
  lines.push(`Ekspedisi: ${EKSPEDISI_LABEL[o.ekspedisi]}`);
  lines.push(`Shipment: ${SHIPMENT_LABEL[o.shipment]}`);
  return lines.map((l) => indent + l).join("\n");
}

/** Build a WA message for one or many orders to the same warehouse. */
export function buildWaMessage(orders: WarehouseOrder[], wh: Warehouse): string {
  if (orders.length === 1) {
    return (
      `Halo Gudang ${wh.name}, mohon dibantu cek & proses orderan berikut:\n\n` +
      orderBlock(orders[0]) +
      `\n\nTerima kasih.`
    );
  }
  const body = orders
    .map((o, i) => `${i + 1}.\n${orderBlock(o, "   ")}`)
    .join("\n\n");
  return (
    `Halo Gudang ${wh.name}, mohon dibantu cek & proses ${orders.length} orderan berikut:\n\n` +
    body +
    `\n\nTerima kasih.`
  );
}

export function waLink(orders: WarehouseOrder[], wh: Warehouse): string {
  return `https://wa.me/${normalizeWa(wh.wa_number)}?text=${encodeURIComponent(buildWaMessage(orders, wh))}`;
}

/** Upload a resi image to storage and return its public URL. */
export async function uploadResi(file: File): Promise<{ url: string | null; error: string | null }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(WAREHOUSE_RESI_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from(WAREHOUSE_RESI_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
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
