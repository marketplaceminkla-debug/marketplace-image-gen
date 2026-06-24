/**
 * shopeeExcelExport.ts
 *
 * Fills a copy of the user's Shopee Mass Upload .xlsx template, one row per
 * product, WITHOUT rewriting the whole workbook (surgical XML injection into
 * <sheetData> so Shopee's template metadata stays intact).
 *
 * Columns are detected at runtime from row 1 of the "Template" sheet, which
 * holds Shopee's stable machine keys (ps_product_name, ps_item_cover_image,
 * ps_item_image_N, ps_price, ps_weight, ps_stock.*, ps_maximum/minimum_
 * purchase_quantity, channel_id.*). This survives column shifts (e.g. adding
 * a new warehouse/gudang adds ps_stock.* columns and pushes everything right).
 *
 * Photos must be public URLs (Shopee only accepts links) — upload first.
 * Kategori has no source data → leave blank; user reviews before upload.
 */

interface ColumnMap {
  namaProduk?: number;
  deskripsi?: number;
  maxPurchase?: number;
  minPurchase?: number;
  harga?: number;
  berat?: number;
  fotoSampul?: number;
  fotoProduk: number[]; // image 1..4 in order
  stockCols: number[];  // every ps_stock.* column (one per gudang/cabang)
  shippingCols: number[]; // every channel_id.* column (jasa kirim)
}

export interface ShopeeProductRow {
  namaProduk: string;
  deskripsi: string;
  coverUrl: string;
  extraPhotoUrls: string[];
}

export interface ShopeeExportDefaults {
  harga: number;
  berat: number;
  stok: number;
  maxPurchase: number;
  minPurchase: number;
}

export const DEFAULT_SHOPEE_PLACEHOLDERS: ShopeeExportDefaults = {
  harga: 9999999,
  berat: 3000,
  stok: 1,
  maxPurchase: 999999,
  minPurchase: 1,
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

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cellXml(col1: number, row1: number, value: string | number): string {
  const ref = `${colLetter(col1)}${row1}`;
  if (typeof value === "number") {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** Detect column positions from row 1 machine keys of the Template sheet. */
async function detectColumns(buf: ArrayBuffer): Promise<ColumnMap> {
  const XLSXmod = await import("xlsx");
  const XLSX = (XLSXmod as unknown as { default?: typeof import("xlsx") }).default ?? XLSXmod;
  const map: ColumnMap = { fotoProduk: [], stockCols: [], shippingCols: [] };
  let wb;
  try {
    wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  } catch {
    return map;
  }
  const sheetName = wb.SheetNames.find((n: string) => n.toLowerCase() === "template") ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws["!ref"]) return map;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const imageByIndex: Record<number, number> = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell || cell.v == null) continue;
    const key = String(cell.v).split("|")[0].trim();
    const col1 = c + 1;
    if (key === "ps_product_name") map.namaProduk = col1;
    else if (key === "ps_product_description") map.deskripsi = col1;
    else if (key === "ps_maximum_purchase_quantity") map.maxPurchase = col1;
    else if (key === "ps_minimum_purchase_quantity") map.minPurchase = col1;
    else if (key === "ps_price") map.harga = col1;
    else if (key === "ps_weight") map.berat = col1;
    else if (key === "ps_item_cover_image") map.fotoSampul = col1;
    else if (key.startsWith("ps_item_image_")) {
      const n = parseInt(key.slice("ps_item_image_".length), 10);
      if (n >= 1) imageByIndex[n] = col1;
    } else if (key.startsWith("ps_stock.")) {
      map.stockCols.push(col1);
    } else if (key.startsWith("channel_id.")) {
      map.shippingCols.push(col1);
    }
  }
  for (let n = 1; n <= 4; n++) if (imageByIndex[n]) map.fotoProduk.push(imageByIndex[n]);
  return map;
}

/** Collect the (column, value) pairs for one product, filtered to template width, sorted. */
function collectDataColumns(
  product: ShopeeProductRow,
  defaults: ShopeeExportDefaults,
  maxCol1: number,
  cols: ColumnMap
): Array<{ col: number; value: string | number }> {
  const cells: Array<{ col: number; value: string | number }> = [];
  if (cols.namaProduk) cells.push({ col: cols.namaProduk, value: product.namaProduk });
  if (cols.deskripsi) cells.push({ col: cols.deskripsi, value: product.deskripsi });
  if (cols.maxPurchase) cells.push({ col: cols.maxPurchase, value: defaults.maxPurchase });
  if (cols.minPurchase) cells.push({ col: cols.minPurchase, value: defaults.minPurchase });
  if (cols.harga) cells.push({ col: cols.harga, value: defaults.harga });
  if (cols.berat) cells.push({ col: cols.berat, value: defaults.berat });
  if (cols.fotoSampul) cells.push({ col: cols.fotoSampul, value: product.coverUrl });
  cols.fotoProduk.forEach((c, i) => {
    const url = product.extraPhotoUrls[i];
    if (url) cells.push({ col: c, value: url });
  });
  cols.stockCols.forEach((c) => cells.push({ col: c, value: defaults.stok }));
  cols.shippingCols.forEach((c) => cells.push({ col: c, value: "Aktif" }));

  return cells.filter((c) => c.col <= maxCol1).sort((a, b) => a.col - b.col);
}

function rowXml(
  row1: number,
  product: ShopeeProductRow,
  defaults: ShopeeExportDefaults,
  maxCol1: number,
  cols: ColumnMap
): string {
  const filtered = collectDataColumns(product, defaults, maxCol1, cols);
  const cellsXml = filtered.map((c) => cellXml(c.col, row1, c.value)).join("");
  return `<row r="${row1}" spans="1:${maxCol1}">${cellsXml}</row>`;
}

function sortRowCells(innerXml: string): string {
  const cellRegex = /<c r="([A-Z]+)\d+"(?:[^>]*\/>|[^>]*>[\s\S]*?<\/c>)/g;
  const matches = Array.from(innerXml.matchAll(cellRegex));
  const sorted = matches
    .map((m) => ({ xml: m[0], col: colIndex(m[1]) }))
    .sort((a, b) => a.col - b.col)
    .map((x) => x.xml)
    .join("");
  return sorted;
}

function injectRowsBeforeClose(sheetXml: string, rowsXml: string): string {
  if (sheetXml.includes("</sheetData>")) {
    return sheetXml.replace("</sheetData>", `${rowsXml}</sheetData>`);
  }
  if (/<sheetData\s*\/>/.test(sheetXml)) {
    return sheetXml.replace(/<sheetData\s*\/>/, `<sheetData>${rowsXml}</sheetData>`);
  }
  throw new Error("Struktur sheet Shopee tidak dikenali (sheetData tidak ditemukan).");
}

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

function detectFirstDataRow(sheetXml: string): number {
  const rowNums = Array.from(sheetXml.matchAll(/<row[^>]*\br="(\d+)"/g)).map((m) =>
    parseInt(m[1], 10)
  );
  if (rowNums.length === 0) return 6;
  return Math.max(...rowNums);
}

function detectMaxCol(sheetXml: string, cols: ColumnMap): number {
  const needed = Math.max(
    27,
    cols.fotoSampul ?? 0,
    ...cols.fotoProduk,
    ...cols.stockCols,
    ...cols.shippingCols,
    cols.berat ?? 0,
  );
  const m = sheetXml.match(/<dimension\s+ref="[A-Z]+\d+:([A-Z]+)\d+"/);
  if (!m) return needed;
  return Math.max(colIndex(m[1]), needed);
}

export async function buildShopeeExcel(
  templateArrayBuffer: ArrayBuffer,
  products: ShopeeProductRow[],
  defaults: ShopeeExportDefaults = DEFAULT_SHOPEE_PLACEHOLDERS
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;

  const cols = await detectColumns(templateArrayBuffer);
  if (!cols.fotoSampul || !cols.namaProduk) {
    throw new Error(
      "Tidak bisa mengenali kolom di template Shopee (baris kode 'ps_*' tidak ketemu). " +
        "Pastikan file .xlsx asli dari Shopee Seller Centre dan sheet 'Template' utuh."
    );
  }

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
  const maxCol = detectMaxCol(sheetXml, cols);

  if (products.length > 0) {
    const firstRowRegex = new RegExp(`<row[^>]*\\br="${firstDataRow}"[^>]*>([\\s\\S]*?)</row>`);
    const existing = sheetXml.match(firstRowRegex);
    const dataCols = collectDataColumns(products[0], defaults, maxCol, cols);

    if (existing) {
      let inner = existing[1];
      for (const { col } of dataCols) {
        const ref = `${colLetter(col)}${firstDataRow}`;
        inner = inner.replace(
          new RegExp(`<c r="${ref}"(?:[^>]*/>|[^>]*>[\\s\\S]*?</c>)`),
          ""
        );
      }
      const ourCells = dataCols.map((d) => cellXml(d.col, firstDataRow, d.value)).join("");
      const merged = sortRowCells(inner + ourCells);
      const rebuilt = `<row r="${firstDataRow}" spans="1:${maxCol}">${merged}</row>`;
      sheetXml = sheetXml.replace(firstRowRegex, rebuilt);
    } else {
      const created = rowXml(firstDataRow, products[0], defaults, maxCol, cols);
      sheetXml = injectRowsBeforeClose(sheetXml, created);
    }

    if (products.length > 1) {
      const extraRows = products
        .slice(1)
        .map((p, i) => rowXml(firstDataRow + 1 + i, p, defaults, maxCol, cols))
        .join("");
      sheetXml = injectRowsBeforeClose(sheetXml, extraRows);
    }
  }

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
    sheetXml = sheetXml.replace(
      /<dimension\s+ref="[A-Z]+\d+"/,
      `<dimension ref="A1:${colLetter(maxCol)}${lastRow}"`
    );
  }

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
