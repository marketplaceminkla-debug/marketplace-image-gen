import { supabase } from "./supabase";
import { uploadToCloudinary } from "./cloudinary";

export type TalCategory = "target" | "strategi" | "lainnya";

export interface TalItem {
  id: string;
  month: string; // 'YYYY-MM'
  title: string;
  category: TalCategory;
  is_done: boolean;
  pic_name: string | null;
  proof_url: string | null;
  proof_name: string | null;
  created_at: string;
}

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const idx = Number(mo) - 1;
  return `${MONTHS_ID[idx] ?? mo} ${y}`;
}

export async function listTalItems(): Promise<TalItem[]> {
  const { data, error } = await supabase
    .from("tal_items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data as TalItem[];
}

export async function addTalItem(input: {
  month: string;
  title: string;
  category: TalCategory;
  pic_name: string | null;
  created_by: string | null;
}) {
  const { error } = await supabase.from("tal_items").insert(input);
  return { error: error ? error.message : null };
}

export async function updateTalItem(id: string, patch: Partial<TalItem>) {
  const { error } = await supabase.from("tal_items").update(patch).eq("id", id);
  return { error: error ? error.message : null };
}

export async function deleteTalItem(id: string) {
  const { error } = await supabase.from("tal_items").delete().eq("id", id);
  return { error: error ? error.message : null };
}

export async function uploadTalProof(
  file: File,
): Promise<{ url: string | null; name: string | null; error: string | null }> {
  const { url, error } = await uploadToCloudinary(file, "marketplace/tal-proof");
  return { url, name: file.name, error };
}
