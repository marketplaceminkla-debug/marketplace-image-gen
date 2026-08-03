const CLOUD_NAME   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

export interface CloudinaryResult {
  url: string;
  public_id: string;
}

/**
 * Upload file ke Cloudinary via unsigned upload preset.
 * Tidak butuh API secret — aman di client-side.
 */
export async function uploadToCloudinary(
  file: File,
  folder = "marketplace",
): Promise<{ url: string | null; error: string | null }> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return { url: null, error: "Cloudinary belum dikonfigurasi (cek env vars)" };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      { method: "POST", body: formData },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { url: null, error: err?.error?.message ?? `Upload gagal (${res.status})` };
    }
    const data: CloudinaryResult = await res.json();
    return { url: data.url.replace("http://", "https://"), error: null };
  } catch (e) {
    return { url: null, error: String(e) };
  }
}
