const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;
const SKIP_BELOW_BYTES = 300 * 1024; // already small enough, not worth the work

/**
 * Downscale + re-encode an image client-side before upload (canvas-based,
 * no dependency). Photos straight off a phone camera can be 3-5MB; this
 * gets them down to a few hundred KB without visible quality loss at the
 * sizes this app actually displays them — directly cuts Supabase egress
 * every time the file is viewed afterward.
 *
 * Non-images (PDF proof, etc.), GIFs, and anything that fails to process
 * pass through untouched — never block an upload over this.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file; // compression didn't help, keep original

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
