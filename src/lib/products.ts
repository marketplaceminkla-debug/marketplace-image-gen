import { supabase } from "./supabase";

export type MpStatus = "pending" | "process" | "done";
export const MP_STATUS_NEXT: Record<MpStatus, MpStatus> = { pending: "process", process: "done", done: "pending" };
export const MP_STATUS_LABEL: Record<MpStatus, string> = { pending: "Belum", process: "Proses", done: "Live" };

export interface Product {
  id: string;
  name: string;
  note: string | null;
  status_shopee: MpStatus;
  status_tokopedia: MpStatus;
  status_tiktok: MpStatus;
  created_at: string;
}

export interface PriceUpdate {
  id: string;
  product_name: string;
  old_price: number;
  new_price: number;
  note: string | null;
  created_at: string;
}

export interface Fee {
  id: string;
  marketplace: string;
  fee_name: string;
  value: number;
  unit: "%" | "Rp";
  note: string | null;
}

// ── Products ──
export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as Product[];
}
export async function addProduct(input: { name: string; note: string | null; created_by: string | null }) {
  const { error } = await supabase.from("products").insert(input);
  return { error: error ? error.message : null };
}
export async function updateProduct(id: string, patch: Partial<Product>) {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}
export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// ── Price updates ──
export async function listPriceUpdates(): Promise<PriceUpdate[]> {
  const { data, error } = await supabase.from("price_updates").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((d) => ({ ...d, old_price: Number(d.old_price), new_price: Number(d.new_price) })) as PriceUpdate[];
}
export async function addPriceUpdate(input: { product_name: string; old_price: number; new_price: number; note: string | null; created_by: string | null }) {
  const { error } = await supabase.from("price_updates").insert(input);
  return { error: error ? error.message : null };
}
export async function deletePriceUpdate(id: string) {
  const { error } = await supabase.from("price_updates").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// ── Marketplace fees ──
export async function listFees(): Promise<Fee[]> {
  const { data, error } = await supabase.from("marketplace_fees").select("*").order("marketplace", { ascending: true });
  if (error || !data) return [];
  return data.map((d) => ({ ...d, value: Number(d.value) })) as Fee[];
}
export async function addFee(input: { marketplace: string; fee_name: string; value: number; unit: "%" | "Rp"; note: string | null }) {
  const { error } = await supabase.from("marketplace_fees").insert(input);
  return { error: error ? error.message : null };
}
export async function updateFee(id: string, patch: Partial<Fee>) {
  const { error } = await supabase.from("marketplace_fees").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}
export async function deleteFee(id: string) {
  const { error } = await supabase.from("marketplace_fees").delete().eq("id", id);
  return { error: error ? error.message : null };
}
