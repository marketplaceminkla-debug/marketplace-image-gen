import { supabase, WAREHOUSE_RESI_BUCKET } from "./supabase";

// Nomor SO mask: SO/#####/###### (5 digits then 6 digits) — shared by
// Orderan Gudang and Stock Management (Retur & Gagal Kirim), since both
// reference the same Shopee/marketplace SO numbers.
export const SO_RE = /^SO\/\d{5}\/\d{6}$/;
export function formatSo(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  let out = "SO/" + d.slice(0, 5);
  if (d.length > 5) out += "/" + d.slice(5, 11);
  return out;
}

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
  item_qtys: number[];
  so_number: string | null;
  order_number: string | null;
  keterangan: string | null;
  ekspedisi: Ekspedisi;
  shipment: Shipment;
  status: OrderStatus;
  resi_url: string | null;
  store_account_id: string | null;
  revenue: number;
  kombo_hemat: "garansi" | "non_garansi" | null;
  created_at: string;
}

export interface AutoReportData {
  revenue_today: number;
  revenue_total: number;
  revenue_estimate: number;
  deal_qty: number;
  kombo_garansi: number;
  kombo_non_garansi: number;
  deals: { name: string; qty: number }[];
}

/** Aggregate order data across multiple stores (PIC-level). */
export async function getAutoReportDataForStores(storeIds: string[], date: string): Promise<AutoReportData> {
  if (!storeIds.length) return { revenue_today: 0, revenue_total: 0, revenue_estimate: 0, deal_qty: 0, kombo_garansi: 0, kombo_non_garansi: 0, deals: [] };
  const [y, m] = date.split("-");
  const monthStart = `${y}-${m}-01`;
  const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
  const dayOfMonth = parseInt(date.split("-")[2]);
  const monthEnd = `${y}-${m}-${String(daysInMonth).padStart(2, "0")}`;

  const [{ data: todayOrders }, { data: monthOrders }] = await Promise.all([
    supabase.from("warehouse_orders").select("revenue, kombo_hemat, items, item_qtys").in("store_account_id", storeIds).eq("order_date", date).neq("status", "denied"),
    supabase.from("warehouse_orders").select("revenue").in("store_account_id", storeIds).gte("order_date", monthStart).lte("order_date", monthEnd).neq("status", "denied"),
  ]);

  const revenue_today = (todayOrders ?? []).reduce((s, o) => s + (o.revenue ?? 0), 0);
  const revenue_total = (monthOrders ?? []).reduce((s, o) => s + (o.revenue ?? 0), 0);
  const revenue_estimate = dayOfMonth > 0 ? Math.round((revenue_total / dayOfMonth) * daysInMonth) : 0;
  const kombo_garansi = (todayOrders ?? []).filter((o) => o.kombo_hemat === "garansi").length;
  const kombo_non_garansi = (todayOrders ?? []).filter((o) => o.kombo_hemat === "non_garansi").length;

  const dealMap = new Map<string, number>();
  for (const o of todayOrders ?? []) {
    const names: string[] = o.items?.length ? o.items : [];
    const qtys: number[] = o.item_qtys ?? [];
    for (let i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      dealMap.set(names[i], (dealMap.get(names[i]) ?? 0) + (qtys[i] ?? 1));
    }
  }
  const deals = Array.from(dealMap.entries()).map(([name, qty]) => ({ name, qty }));
  const deal_qty = deals.reduce((s, d) => s + d.qty, 0);
  return { revenue_today, revenue_total, revenue_estimate, deal_qty, kombo_garansi, kombo_non_garansi, deals };
}

/** Aggregate order data for Report Harian auto-calculation. */
export async function getAutoReportData(storeAccountId: string, date: string): Promise<AutoReportData> {
  const [y, m] = date.split("-");
  const monthStart = `${y}-${m}-01`;
  const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
  const dayOfMonth = parseInt(date.split("-")[2]);
  const monthEnd = `${y}-${m}-${String(daysInMonth).padStart(2, "0")}`;

  const [{ data: todayOrders }, { data: monthOrders }] = await Promise.all([
    supabase
      .from("warehouse_orders")
      .select("revenue, kombo_hemat, items, item_qtys")
      .eq("store_account_id", storeAccountId)
      .eq("order_date", date)
      .neq("status", "denied"),
    supabase
      .from("warehouse_orders")
      .select("revenue")
      .eq("store_account_id", storeAccountId)
      .gte("order_date", monthStart)
      .lte("order_date", monthEnd)
      .neq("status", "denied"),
  ]);

  const revenue_today = (todayOrders ?? []).reduce((s, o) => s + (o.revenue ?? 0), 0);
  const revenue_total = (monthOrders ?? []).reduce((s, o) => s + (o.revenue ?? 0), 0);
  const revenue_estimate = dayOfMonth > 0 ? Math.round((revenue_total / dayOfMonth) * daysInMonth) : 0;

  const kombo_garansi = (todayOrders ?? []).filter((o) => o.kombo_hemat === "garansi").length;
  const kombo_non_garansi = (todayOrders ?? []).filter((o) => o.kombo_hemat === "non_garansi").length;

  // Aggregate deal list (combine same product names)
  const dealMap = new Map<string, number>();
  for (const o of todayOrders ?? []) {
    const names: string[] = o.items?.length ? o.items : [];
    const qtys: number[] = o.item_qtys ?? [];
    for (let i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      dealMap.set(names[i], (dealMap.get(names[i]) ?? 0) + (qtys[i] ?? 1));
    }
  }
  const deals = Array.from(dealMap.entries()).map(([name, qty]) => ({ name, qty }));
  const deal_qty = deals.reduce((s, d) => s + d.qty, 0);

  return { revenue_today, revenue_total, revenue_estimate, deal_qty, kombo_garansi, kombo_non_garansi, deals };
}

export interface OrderItem { name: string; qty: number; }

/** Items of an order (name + qty), falling back to the legacy single item_name. */
export function orderItems(o: WarehouseOrder): OrderItem[] {
  const names = o.items && o.items.length ? o.items : o.item_name ? [o.item_name] : [];
  const qtys = o.item_qtys ?? [];
  return names.map((name, i) => ({ name, qty: qtys[i] ?? 1 }));
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
    lines.push(`Nama Barang: ${items[0] ? `${items[0].name} (${items[0].qty} pcs)` : "-"}`);
  } else {
    lines.push(`Nama Barang:`);
    items.forEach((it) => lines.push(`  - ${it.name} (${it.qty} pcs)`));
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
/** Orders filtered by store account and date — used by Report Harian to sync deals. */
export async function listOrdersByStore(storeAccountId: string, date: string): Promise<WarehouseOrder[]> {
  const { data, error } = await supabase
    .from("warehouse_orders")
    .select("*")
    .eq("store_account_id", storeAccountId)
    .eq("order_date", date)
    .neq("status", "denied")
    .order("created_at");
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
