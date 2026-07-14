import { supabase } from "./supabase";

export type ReturnCategory = "tukar_unit" | "refund" | "refund_sebagian" | "ganti_item";
export type ReturnStatus = "new" | "ship_user" | "dispute" | "ship_seller" | "done";

export const CATEGORY_LABEL: Record<ReturnCategory, string> = {
  tukar_unit: "Tukar Unit",
  refund: "Refund",
  refund_sebagian: "Refund Sebagian",
  ganti_item: "Ganti Item",
};

export const STATUS_LABEL: Record<ReturnStatus, string> = {
  new: "New",
  ship_user: "Ship User",
  dispute: "Dispute",
  ship_seller: "Ship Seller",
  done: "Done",
};

export interface StockReturn {
  id: string;
  return_date: string; // YYYY-MM-DD
  so_number: string | null;
  order_number: string | null;
  item_name: string | null; // legacy fallback for the first item
  qty: number;
  items: string[];
  item_qtys: number[];
  warehouse_id: string | null;
  category: ReturnCategory;
  reason: string | null;
  proof_url: string | null;
  status: ReturnStatus;
  created_by: string | null;
  created_at: string;
}

export interface ReturnItem { name: string; qty: number; }

/** Items of a return (name + qty), falling back to the legacy single item_name. */
export function returnItems(r: StockReturn): ReturnItem[] {
  const names = r.items && r.items.length ? r.items : r.item_name ? [r.item_name] : [];
  const qtys = r.item_qtys ?? [];
  return names.map((name, i) => ({ name, qty: qtys[i] ?? 1 }));
}

export async function listStockReturns(): Promise<StockReturn[]> {
  const { data, error } = await supabase
    .from("stock_returns")
    .select("*")
    .order("return_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as StockReturn[];
}

export async function addStockReturn(input: {
  return_date: string;
  so_number: string | null;
  order_number: string | null;
  items: string[];
  item_qtys: number[];
  warehouse_id: string | null;
  category: ReturnCategory;
  reason: string | null;
  proof_url: string | null;
  created_by: string | null;
}) {
  const { error } = await supabase.from("stock_returns").insert({
    ...input,
    item_name: input.items[0] ?? null,
    qty: input.item_qtys[0] ?? 1,
  });
  return { error: error ? error.message : null };
}

export async function updateStockReturn(id: string, patch: Partial<StockReturn>) {
  const { error } = await supabase.from("stock_returns").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}

export async function deleteStockReturn(id: string) {
  const { error } = await supabase.from("stock_returns").delete().eq("id", id);
  return { error: error ? error.message : null };
}
