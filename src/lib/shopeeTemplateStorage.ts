/**
 * shopeeTemplateStorage.ts
 *
 * Stores the raw Shopee Mass Upload .xlsx template file (downloaded by the
 * user from Shopee Seller Centre) in Supabase Storage, so it can be reused
 * every time we export generated product data into Shopee's format.
 *
 * Same pattern as templateStorage.ts (for frame templates), just a separate
 * bucket/table since this stores .xlsx files instead of .png frames.
 *
 * SQL to run once in Supabase SQL editor: see supabase-setup.sql
 * Also create a public Storage bucket named "shopee-templates".
 */

import { supabase, SHOPEE_TEMPLATES_BUCKET, SHOPEE_TEMPLATES_TABLE } from "./supabase";
import type { ShopeeTemplateData } from "@/types";

const ACTIVE_SHOPEE_TEMPLATE_KEY = "pixelseller_active_shopee_template";

function getActiveId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_SHOPEE_TEMPLATE_KEY) ?? "";
}

function setActiveId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_SHOPEE_TEMPLATE_KEY, id);
}

interface ShopeeTemplateRow {
  id: string;
  name: string;
  filename: string;
  storage_path: string;
  public_url: string;
  size: number;
  uploaded_at: string;
}

function rowToShopeeTemplateData(row: ShopeeTemplateRow): ShopeeTemplateData {
  return {
    id: row.id,
    name: row.name,
    filename: row.filename,
    uploadedAt: row.uploaded_at,
    size: row.size,
    publicUrl: row.public_url,
  };
}

export async function getAllShopeeTemplates(): Promise<ShopeeTemplateData[]> {
  const { data, error } = await supabase
    .from(SHOPEE_TEMPLATES_TABLE)
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("[shopeeTemplateStorage] getAllShopeeTemplates error:", error.message);
    return [];
  }

  return (data as ShopeeTemplateRow[]).map(rowToShopeeTemplateData);
}

export async function getActiveShopeeTemplate(): Promise<ShopeeTemplateData | null> {
  const all = await getAllShopeeTemplates();
  if (all.length === 0) return null;

  const activeId = getActiveId();
  return all.find((t) => t.id === activeId) ?? all[0];
}

export async function saveShopeeTemplate(
  file: File,
  name: string
): Promise<ShopeeTemplateData> {
  const id = Date.now().toString();
  const ext = file.name.split(".").pop() ?? "xlsx";
  const storagePath = `${id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(SHOPEE_TEMPLATES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

  if (uploadError) {
    throw new Error(`Upload template Shopee gagal: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(SHOPEE_TEMPLATES_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  const row: ShopeeTemplateRow = {
    id,
    name,
    filename: file.name,
    storage_path: storagePath,
    public_url: publicUrl,
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from(SHOPEE_TEMPLATES_TABLE)
    .insert(row);

  if (insertError) {
    await supabase.storage.from(SHOPEE_TEMPLATES_BUCKET).remove([storagePath]);
    throw new Error(`Simpan metadata template Shopee gagal: ${insertError.message}`);
  }

  setActiveId(id);

  return rowToShopeeTemplateData(row);
}

export async function deleteShopeeTemplate(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from(SHOPEE_TEMPLATES_TABLE)
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchError || !data) {
    console.error("[shopeeTemplateStorage] deleteShopeeTemplate fetch error:", fetchError?.message);
    return;
  }

  await supabase.from(SHOPEE_TEMPLATES_TABLE).delete().eq("id", id);

  await supabase.storage
    .from(SHOPEE_TEMPLATES_BUCKET)
    .remove([(data as { storage_path: string }).storage_path]);

  if (getActiveId() === id) {
    const remaining = await getAllShopeeTemplates();
    setActiveId(remaining[0]?.id ?? "");
  }
}

export function setActiveShopeeTemplate(id: string): void {
  setActiveId(id);
}
