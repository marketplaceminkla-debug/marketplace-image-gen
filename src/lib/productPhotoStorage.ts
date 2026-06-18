/**
 * productPhotoStorage.ts
 *
 * Uploads generated product photos to Supabase Storage and returns their
 * public URL. This is needed because Shopee Mass Upload's Excel template
 * only accepts photo LINKS (not file attachments) in the "Foto Sampul" /
 * "Foto Produk 1-8" columns — see SKILL/README notes on Shopee template.
 *
 * Bucket: PRODUCT_PHOTOS_BUCKET ("product-photos"), must be created as a
 * PUBLIC bucket in the Supabase dashboard (see supabase-setup.sql).
 *
 * No DB table needed here — we only need the public URL at upload time,
 * there's nothing to list/manage afterwards.
 */

import { supabase, PRODUCT_PHOTOS_BUCKET } from "./supabase";

export interface UploadedPhoto {
  path: string;
  publicUrl: string;
}

/**
 * Upload a single generated photo blob to Supabase Storage.
 * @param blob   The composited JPEG blob (output of compositeImage)
 * @param folderHint  A folder-safe string (e.g. sanitized product title) to group files, purely cosmetic
 * @param filename    File name within that folder, e.g. "1.jpg"
 */
export async function uploadProductPhoto(
  blob: Blob,
  folderHint: string,
  filename: string
): Promise<UploadedPhoto> {
  // Prefix with timestamp to avoid collisions across runs/users sharing the same bucket
  const path = `${Date.now()}_${folderHint}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .upload(path, blob, {
      cacheControl: "31536000", // 1 year — these links are meant to be long-lived (Shopee may re-fetch anytime)
      upsert: true, // overwrite if a same-named path somehow exists, avoids 400 "Duplicate"
      contentType: "image/jpeg",
    });

  if (uploadError) {
    // Surface as much detail as Supabase gives us, plus the most common cause.
    const detail =
      uploadError.message ||
      (uploadError as { error?: string }).error ||
      JSON.stringify(uploadError);
    throw new Error(
      `Upload foto ke Supabase gagal (${detail}). ` +
        `Cek: bucket "${PRODUCT_PHOTOS_BUCKET}" sudah dibuat (Public ON) dan punya storage policy untuk INSERT (anon).`
    );
  }

  const { data: urlData } = supabase.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: urlData.publicUrl };
}

/**
 * Sanitize a string for safe use as a storage path segment.
 * Supabase Storage paths don't like spaces/special chars as much as local filesystems.
 */
export function sanitizePathSegment(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "produk";
}
