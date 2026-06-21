import { supabase } from "./supabase";

export interface RevenueEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  amount: number;
  note: string | null;
  created_at: string;
}

export function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export function formatShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} jt`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)} rb`;
  return `${n}`;
}

export async function getTarget(): Promise<number> {
  const { data, error } = await supabase.from("revenue_settings").select("target").eq("id", 1).single();
  if (error || !data) return 0;
  return Number(data.target) || 0;
}

export async function setTarget(target: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from("revenue_settings").update({ target, updated_at: new Date().toISOString() }).eq("id", 1);
  return { error: error ? error.message : null };
}

export async function listEntries(): Promise<RevenueEntry[]> {
  const { data, error } = await supabase
    .from("revenue_entries")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((d) => ({ ...d, amount: Number(d.amount) })) as RevenueEntry[];
}

export async function addEntry(input: { entry_date: string; amount: number; note: string | null; created_by: string | null }): Promise<{ error: string | null }> {
  const { error } = await supabase.from("revenue_entries").insert(input);
  return { error: error ? error.message : null };
}

export async function deleteEntry(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("revenue_entries").delete().eq("id", id);
  return { error: error ? error.message : null };
}
