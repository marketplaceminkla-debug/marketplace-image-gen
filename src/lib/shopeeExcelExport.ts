/**
 * shopeeExcelExport.ts
 *
 * Fills a copy of the user's Shopee Mass Upload .xlsx template, one row per
 * product, WITHOUT rewriting the whole workbook.
 *
 * Why not SheetJS write? The Shopee template carries internal metadata
 * (template fingerprint, named ranges, data validations, hidden sheets) that
 * Shopee validates on upload. Rewriting the workbook with SheetJS drops some
 * of that, causing Shopee to reject the file ("Please download the newest
 * template", status 0/0). Instead we surgically inject <row> XML into the
 * worksheet's <sheetData> inside the .xlsx zip and leave every other byte
 * untouched — the same low-touch approach used to patch the file elsewhere.
 *
 * Column positions (1-based), mapped from the "Template" sheet header row:
 *   B(2)=Nama Produk  C(3)=Deskripsi  Q(17)=Harga  R(18)=Stok
 *   W(23)=Foto Sampul  X(24)..AA(27)=Foto Produk 1-4
 *   AF(32)=Berat  AJ(36)..AM(39)=Jasa Kirim 1-4
 *
 * Photos must be public URLs (Shopee only accepts links) — upload first.
 * Kategori/Harga/Berat have no source data → placeholder defaults; the user
 * MUST review them before uploading to Shopee.
 */

const COL = {
  namaProduk: 2,
  deskripsi: 3,
  harga: 17,
  stok: 18,
  fotoSampul: 23,
  fotoProduk1: 24,
  fotoProduk2: 25,
  fotoProduk3: 26,
  fotoProduk4: 27,
  berat: 32,
  jasaKirim1: 36,
  jasaKirim2: 37,
  jasaKirim3: 38,
  jasaKirim4: 39,
};

export interface ShopeeProductRow {
  namaProduk: string;
  deskripsi: string;
  coverUrl: string;
  extraPhotoUrls: string[];
}

export interface ShopeeExportDefaults {
  harga: number;
  stok: number;
  berat: number;
}

export const DEFAULT_SHOPEE_PLACEHOLDERS: ShopeeExportDefaults = {
  harga: 0,
  stok: 1,
  berat: 100,
};

function colLetter(col1: number): string {
  let s = "";
  let n = col1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build a single <c> cell element (inline string or number). */
function cellXml(col1: number, row1: number, value: string | number): string {
  const ref = `${colLetter(col1)}${row1}`;
  if (typeof value === "number") {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  // inline string keeps us from having to touch sharedStrings.xml
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Collect the (column, value) pairs we write for one product, filtered to template width, sorted. */
function collectDataColumns(
  product: ShopeeProductRow,
  defaults: ShopeeExportDefaults,
  maxCol1: number
): Array<{ col: number; value: string | number }> {
  const cells: Array<{ col: number; value: string | number }> = [];
  cells.push({ col: COL.namaProduk, value: product.namaProduk });
  cells.push({ col: COL.deskripsi, value: product.deskripsi });
  cells.push({ col: COL.harga, value: defaults.harga });
  cells.push({ col: COL.stok, value: defaults.stok });
  cells.push({ col: COL.fotoSampul, value: product.coverUrl });

  const extraCols = [COL.fotoProduk1, COL.fotoProduk2, COL.fotoProduk3, COL.fotoProduk4];
  extraCols.forEach((c, i) => {
    const url = product.extraPhotoUrls[i];
    if (url) cells.push({ col: c, value: url });
  });

  cells.push({ col: COL.berat, value: defaults.berat });
  [COL.jasaKirim1, COL.jasaKirim2, COL.jasaKirim3, COL.jasaKirim4].forEach((c) => {
    cells.push({ col: c, value: "Aktif" });
  });

  return cells.filter((c) => c.col <= maxCol1).sort((a, b) => a.col - b.col);
}

/** Build one fresh <row> for a product. */
function rowXml(
  row1: number,
  product: ShopeeProductRow,
  defaults: ShopeeExportDefaults,
  maxCol1: number
): string {
  const filtered = collectDataColumns(product, defaults, maxCol1);
  const cellsXml = filtered.map((c) => cellXml(c.col, row1, c.value)).join("");
  return `<row r="${row1}" spans="1:${maxCol1}">${cellsXml}</row>`;
}

/** Sort the <c> cells inside a row's inner XML by their column index. */
function sortRowCells(innerXml: string): string {
  const cellRegex = /<c r="([A-Z]+)\d+"(?:[^>]*\/>|[^>]*>[\s\S]*?<\/c>)/g;
  const matches = Array.from(innerXml.matchAll(cellRegex));
  const colIndex = (letters: string) => {
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  };
  const sorted = matches
    .map((m) => ({ xml: m[0], col: colIndex(m[1]) }))
    .sort((a, b) => a.col - b.col)
    .map((x) => x.xml)
    .join("");
  return sorted;
}

/** Insert row XML right before </sheetData> (handle self-closing <sheetData/> too). */
function injectRowsBeforeClose(sheetXml: string, rowsXml: string): string {
  if (sheetXml.includes("</sheetData>")) {
    return sheetXml.replace("</sheetData>", `${rowsXml}</sheetData>`);
  }
  if (/<sheetData\s*\/>/.test(sheetXml)) {
    return sheetXml.replace(/<sheetData\s*\/>/, `<sheetData>${rowsXml}</sheetData>`);
  }
  throw new Error("Struktur sheet Shopee tidak dikenali (sheetData tidak ditemukan).");
}

/** Find the worksheet xml path for the sheet named "Template" (fallback: first sheet). */
function resolveTemplateSheetPath(
  workbookXml: string | undefined,
  relsXml: string | undefined,
): string {
  if (!workbookXml || !relsXml) {
    return "xl/worksheets/sheet1.xml";
  }

  const sheetMatches = Array.from(
    workbookXml.matchAll(/<sheet[^>]*\bname="([^"]*)"[^>]*\br:id="([^"]*)"[^>]*\/?>/g)
  );
  let targetRid: string | null = null;
  for (const m of sheetMatches) {
    if (m[1].toLowerCase() === "template") {
      targetRid = m[2];
      break;
    }
  }
  if (!targetRid && sheetMatches.length > 0) {
    targetRid = sheetMatches[0][2];
  }
  if (!targetRid) return "xl/worksheets/sheet1.xml";

  const relMatch = relsXml.match(
    new RegExp(`<Relationship[^>]*\\bId="${targetRid}"[^>]*\\bTarget="([^"]*)"[^>]*/?>`)
  );
  let target = relMatch?.[1] ?? "worksheets/sheet1.xml";
  target = target.replace(/^\//, "");
  if (!target.startsWith("xl/")) target = `xl/${target}`;
  return target;
}

/**
 * Detect the row where the FIRST product should be written.
 *
 * Shopee templates keep header rows (1..N) where the LAST of those rows is an
 * instruction row whose data-columns are meant to be overwritten by the first
 * product. Verified against a manually-filled, successfully-uploaded file:
 * data started on the last existing (instruction) row, not the row after it.
 *
 * So: first data row = the max existing <row> number (overwrite that row's
 * data columns). If the sheet has no rows at all, fall back to 6.
 */
function detectFirstDataRow(sheetXml: string): number {
  const rowNums = Array.from(sheetXml.matchAll(/<row[^>]*\br="(\d+)"/g)).map((m) =>
    parseInt(m[1], 10)
  );
  if (rowNums.length === 0) return 6;
  return Math.max(...rowNums);
}

/** Read the template's column count from <dimension ref="A1:XX#"> (fallback 41). */
function detectMaxCol(sheetXml: string): number {
  const m = sheetXml.match(/<dimension\s+ref="[A-Z]+\d+:([A-Z]+)\d+"/);
  if (!m) return 41;
  const letters = m[1];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  // Ensure we at least cover up to the photo columns we need (AA = 27)
  return Math.max(n, 27);
}

export async function buildShopeeExcel(
  templateArrayBuffer: ArrayBuffer,
  products: ShopeeProductRow[],
  defaults: ShopeeExportDefaults = DEFAULT_SHOPEE_PLACEHOLDERS
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;

  let zip;
  try {
    zip = await JSZip.loadAsync(templateArrayBuffer);
  } catch (err) {
    throw new Error(
      "Gagal membaca file template Shopee. Pastikan file .xlsx asli dari Shopee dan tidak rusak. " +
        (err instanceof Error ? `(${err.message})` : "")
    );
  }

  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  const sheetPath = resolveTemplateSheetPath(workbookXml, relsXml);
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) {
    throw new Error('Tidak menemukan sheet "Template" di file Excel Shopee.');
  }

  let sheetXml = await sheetFile.async("string");

  const firstDataRow = detectFirstDataRow(sheetXml);
  const maxCol = detectMaxCol(sheetXml);

  if (products.length > 0) {
    // Product #0 goes onto the existing instruction row (firstDataRow): we
    // overwrite only the data columns, preserving any other cells already
    // there (e.g. category/quantity instruction cells Shopee keeps).
    const firstRowRegex = new RegExp(`<row[^>]*\\br="${firstDataRow}"[^>]*>([\\s\\S]*?)</row>`);
    const existing = sheetXml.match(firstRowRegex);

    const dataCols = collectDataColumns(products[0], defaults, maxCol);

    if (existing) {
      // Remove existing cells that occupy our data columns, then add ours, re-sorted.
      let inner = existing[1];
      for (const { col } of dataCols) {
        const ref = `${colLetter(col)}${firstDataRow}`;
        // remove a <c r="REF" .../> or <c r="REF" ...>...</c>
        inner = inner.replace(
          new RegExp(`<c r="${ref}"(?:[^>]*/>|[^>]*>[\\s\\S]*?</c>)`),
          ""
        );
      }
      // Append our cells, then sort all cells in the row by column index
      const ourCells = dataCols.map((d) => cellXml(d.col, firstDataRow, d.value)).join("");
      const merged = sortRowCells(inner + ourCells);
      const rebuilt = `<row r="${firstDataRow}" spans="1:${maxCol}">${merged}</row>`;
      sheetXml = sheetXml.replace(firstRowRegex, rebuilt);
    } else {
      // No existing row — just create it
      const created = rowXml(firstDataRow, products[0], defaults, maxCol);
      sheetXml = injectRowsBeforeClose(sheetXml, created);
    }

    // Products #1.. go as brand new rows after firstDataRow
    if (products.length > 1) {
      const extraRows = products
        .slice(1)
        .map((p, i) => rowXml(firstDataRow + 1 + i, p, defaults, maxCol))
        .join("");
      sheetXml = injectRowsBeforeClose(sheetXml, extraRows);
    }
  }

  // Update <dimension>. Templates vary: "A1:AO6" (ranged) or bare "A1".
  const lastRow = firstDataRow + products.length - 1;
  if (/<dimension\s+ref="[A-Z]+\d+:[A-Z]+\d+"/.test(sheetXml)) {
    sheetXml = sheetXml.replace(
      /<dimension\s+ref="([A-Z]+\d+):([A-Z]+)(\d+)"/,
      (_full, start: string, endCol: string, endRow: string) => {
        const newEndRow = Math.max(parseInt(endRow, 10), lastRow);
        return `<dimension ref="${start}:${endCol}${newEndRow}"`;
      }
    );
  } else {
    // bare dimension like ref="A1" — expand to cover our written area
    sheetXml = sheetXml.replace(
      /<dimension\s+ref="[A-Z]+\d+"/,
      `<dimension ref="A1:${colLetter(maxCol)}${lastRow}"`
    );
  }

  // Rebuild the zip from scratch so we don't introduce directory entries
  // (JSZip's zip.file()+generateAsync can add "xl/" folder entries that aren't
  // in the original Shopee file). We copy every original file byte-for-byte,
  // substituting only the modified worksheet, and create no folder entries.
  const JSZipCtor = (await import("jszip")).default;
  const outZip = new JSZipCtor();

  const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  for (const name of fileNames) {
    if (name === sheetPath) {
      outZip.file(name, sheetXml, { createFolders: false });
    } else {
      const content = await zip.files[name].async("uint8array");
      outZip.file(name, content, { createFolders: false });
    }
  }

  const out: Blob = await outZip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
  return out;
}
