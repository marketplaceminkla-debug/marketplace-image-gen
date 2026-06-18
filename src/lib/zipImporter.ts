/**
 * zipImporter.ts
 *
 * Reads a previously-generated PixelSeller ZIP (the per-product folder format)
 * back into structured product data, so users can export to Shopee Excel
 * WITHOUT regenerating all the images.
 *
 * Expected ZIP structure (produced by GeneratePanel):
 *   <Nama Produk>/1.jpg ... 5.jpg
 *   <Nama Produk>/deskripsi.txt
 *
 * Folder name  -> Nama Produk
 * deskripsi.txt -> Deskripsi Produk (already fully rendered)
 * 1.jpg         -> Foto Sampul
 * 2-5.jpg       -> Foto Produk 1-4
 */

export interface ImportedProduct {
  namaProduk: string;
  deskripsi: string;
  photos: { filename: string; blob: Blob }[]; // ordered: 1.jpg, 2.jpg, ...
}

export async function parseGeneratedZip(file: File): Promise<ImportedProduct[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file);

  // Group entries by their top-level folder name
  const folders = new Map<
    string,
    { images: Map<string, import("jszip").JSZipObject>; desc?: import("jszip").JSZipObject }
  >();

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    // Normalize separators and split
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length < 2) return; // skip files at root (shouldn't happen)
    const folderName = parts[0];
    const fileName = parts[parts.length - 1].toLowerCase();

    if (!folders.has(folderName)) {
      folders.set(folderName, { images: new Map() });
    }
    const bucket = folders.get(folderName)!;

    if (fileName === "deskripsi.txt") {
      bucket.desc = entry;
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      bucket.images.set(fileName, entry);
    }
  });

  const products: ImportedProduct[] = [];

  // Preserve a natural order (by folder name) — matches how they were generated
  const sortedFolders = Array.from(folders.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "id", { numeric: true })
  );

  for (const [folderName, bucket] of sortedFolders) {
    // Sort images numerically by their leading number (1.jpg, 2.jpg, ...)
    const sortedImageNames = Array.from(bucket.images.keys()).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, "id", { numeric: true });
    });

    const photos: { filename: string; blob: Blob }[] = [];
    for (const name of sortedImageNames) {
      const entry = bucket.images.get(name)!;
      const blob = await entry.async("blob");
      photos.push({ filename: name, blob });
    }

    let deskripsi = "";
    if (bucket.desc) {
      deskripsi = await bucket.desc.async("string");
    }

    if (photos.length === 0) continue; // skip folders without any image

    products.push({
      namaProduk: folderName,
      deskripsi,
      photos,
    });
  }

  return products;
}
