/**
 * excelParser.ts
 * Columns: A=nomor, B=judul produk (teks cover), C=spek singkat,
 *          D=spek lengkap (optional), E=nama produk (untuk Excel Shopee, optional)
 * Semua kolom selain nomor boleh kosong — row tetap diproses selama nomor valid.
 */

export interface ExcelRow {
  nomor: number;
  judul: string;
  spek: string;
  spekLengkap: string;
  namaProduk: string;
}

export async function parseProductExcel(file: File): Promise<ExcelRow[]> {
  const XLSX = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const results: ExcelRow[] = [];
  for (const row of rows) {
    const colA = String((row as unknown[])[0] ?? "").trim();
    const nomor = Number(colA);
    // Skip header (non-numeric col A) and truly empty rows
    if (!colA || isNaN(nomor) || nomor <= 0) continue;

    results.push({
      nomor,
      judul:       String((row as unknown[])[1] ?? "").trim(),
      spek:        String((row as unknown[])[2] ?? "").trim(),
      spekLengkap: String((row as unknown[])[3] ?? "").trim(),
      namaProduk:  String((row as unknown[])[4] ?? "").trim(),
    });
  }

  return results.sort((a, b) => a.nomor - b.nomor);
}
