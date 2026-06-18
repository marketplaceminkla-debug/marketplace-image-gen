/**
 * templateStorage.ts
 *
 * All template CRUD operations backed by Supabase.
 * - Files   → Supabase Storage bucket "templates"
 * - Metadata → Supabase table "templates"
 *
 * No auth: all users share the same pool of templates (public bucket + no RLS user filter).
 *
 * SQL to run once in Supabase SQL editor:
 * ─────────────────────────────────────────
 * create table if not exists templates (
 *   id           text primary key,
 *   name         text not null,
 *   filename     text not null,
 *   storage_path text not null,
 *   public_url   text not null,
 *   size         bigint not null,
 *   uploaded_at  timestamptz not null default now()
 * );
 *
 * -- Also create a public Storage bucket named "templates" in the Supabase dashboard
 * -- (Storage → New bucket → name: templates → Public: ON)
 * ─────────────────────────────────────────
 */

import { supabase, TEMPLATES_BUCKET, TEMPLATES_TABLE } from "./supabase";
import type { TemplateData } from "@/types";

// ─── Active template (still kept in localStorage — it's just a pointer ID) ───
const ACTIVE_TEMPLATE_KEY = "pixelseller_active_template";

function getActiveId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_TEMPLATE_KEY) ?? "";
}

function setActiveId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_TEMPLATE_KEY, id);
}

// ─── Row shape returned by Supabase ──────────────────────────────────────────
interface TemplateRow {
  id: string;
  name: string;
  filename: string;
  storage_path: string;
  public_url: string;
  size: number;
  uploaded_at: string;
}

function rowToTemplateData(row: TemplateRow): TemplateData {
  return {
    id: row.id,
    name: row.name,
    filename: row.filename,
    uploadedAt: row.uploaded_at,
    size: row.size,
    // dataUrl here is actually the public CDN URL from Storage
    dataUrl: row.public_url,
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getAllTemplates(): Promise<TemplateData[]> {
  const { data, error } = await supabase
    .from(TEMPLATES_TABLE)
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("[templateStorage] getAllTemplates error:", error.message);
    return [];
  }

  return (data as TemplateRow[]).map(rowToTemplateData);
}

export async function getActiveTemplate(): Promise<TemplateData | null> {
  const all = await getAllTemplates();
  if (all.length === 0) return null;

  const activeId = getActiveId();
  return all.find((t) => t.id === activeId) ?? all[0];
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function saveTemplate(
  file: File,
  name: string
): Promise<TemplateData> {
  const id = Date.now().toString();
  const ext = file.name.split(".").pop() ?? "png";
  const storagePath = `${id}.${ext}`;

  // 1. Upload file to Storage
  const { error: uploadError } = await supabase.storage
    .from(TEMPLATES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Upload ke Storage gagal: ${uploadError.message}`);
  }

  // 2. Get public URL
  const { data: urlData } = supabase.storage
    .from(TEMPLATES_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // 3. Insert metadata row
  const row: TemplateRow = {
    id,
    name,
    filename: file.name,
    storage_path: storagePath,
    public_url: publicUrl,
    size: file.size,
    uploaded_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from(TEMPLATES_TABLE)
    .insert(row);

  if (insertError) {
    // Rollback: delete the uploaded file
    await supabase.storage.from(TEMPLATES_BUCKET).remove([storagePath]);
    throw new Error(`Simpan metadata gagal: ${insertError.message}`);
  }

  // 4. Set as active
  setActiveId(id);

  return rowToTemplateData(row);
}

export async function deleteTemplate(id: string): Promise<void> {
  // Get storage_path first
  const { data, error: fetchError } = await supabase
    .from(TEMPLATES_TABLE)
    .select("storage_path")
    .eq("id", id)
    .single();

  if (fetchError || !data) {
    console.error("[templateStorage] deleteTemplate fetch error:", fetchError?.message);
    return;
  }

  // Delete from DB
  await supabase.from(TEMPLATES_TABLE).delete().eq("id", id);

  // Delete from Storage
  await supabase.storage
    .from(TEMPLATES_BUCKET)
    .remove([(data as { storage_path: string }).storage_path]);

  // If it was active, point to first remaining
  if (getActiveId() === id) {
    const remaining = await getAllTemplates();
    setActiveId(remaining[0]?.id ?? "");
  }
}

export function setActiveTemplate(id: string): void {
  setActiveId(id);
}
