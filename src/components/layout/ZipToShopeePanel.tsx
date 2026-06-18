"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { PackageOpen, Upload, AlertCircle, Loader2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { parseGeneratedZip, ImportedProduct } from "@/lib/zipImporter";
import { getActiveShopeeTemplate } from "@/lib/shopeeTemplateStorage";
import { uploadProductPhoto, sanitizePathSegment } from "@/lib/productPhotoStorage";
import { buildShopeeExcel, ShopeeProductRow } from "@/lib/shopeeExcelExport";

type Stage = "idle" | "parsing" | "ready" | "uploading" | "building" | "done" | "error";

export default function ZipToShopeePanel() {
  const [stage, setStage] = useState<Stage>("idle");
  const [products, setProducts] = useState<ImportedProduct[]>([]);
  const [zipName, setZipName] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setError(null);
    setExcelBlob(null);
    setZipName(file.name);
    setStage("parsing");
    try {
      const parsed = await parseGeneratedZip(file);
      if (parsed.length === 0) {
        setError("ZIP tidak berisi folder produk yang valid. Pastikan ini hasil generate PixelSeller (folder per produk berisi 1.jpg–5.jpg + deskripsi.txt).");
        setStage("error");
        return;
      }
      setProducts(parsed);
      setStage("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca ZIP.");
      setStage("error");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"], "application/x-zip-compressed": [".zip"] },
    maxFiles: 1,
    disabled: stage === "parsing" || stage === "uploading" || stage === "building",
  });

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopee-mass-upload_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (excelBlob) { downloadBlob(excelBlob); return; }
    setError(null);

    const shopeeTemplate = await getActiveShopeeTemplate();
    if (!shopeeTemplate) {
      setError('Belum ada template Excel Shopee. Upload dulu di menu "Template Shopee".');
      setStage("error");
      return;
    }

    try {
      setStage("uploading");
      setProgress(0);

      const templateResp = await fetch(shopeeTemplate.publicUrl);
      if (!templateResp.ok) throw new Error("Gagal mengambil file template Shopee dari cloud.");
      const templateBuffer = await templateResp.arrayBuffer();

      const totalPhotos = products.reduce((sum, p) => sum + p.photos.length, 0);
      let uploaded = 0;

      const rows: ShopeeProductRow[] = [];
      for (const product of products) {
        const folderHint = sanitizePathSegment(product.namaProduk);
        const urls: string[] = [];
        for (const photo of product.photos) {
          const { publicUrl } = await uploadProductPhoto(photo.blob, folderHint, photo.filename);
          urls.push(publicUrl);
          uploaded++;
          setProgress(Math.round((uploaded / totalPhotos) * 100));
        }
        if (urls.length === 0) continue;
        rows.push({
          namaProduk: product.namaProduk,
          deskripsi: product.deskripsi,
          coverUrl: urls[0],
          extraPhotoUrls: urls.slice(1),
        });
      }

      setStage("building");
      const blob = await buildShopeeExcel(templateBuffer, rows);
      setExcelBlob(blob);
      setStage("done");
      downloadBlob(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export Excel Shopee gagal.");
      setStage("error");
    }
  };

  const busy = stage === "uploading" || stage === "building";

  return (
    <div className="h-full overflow-auto p-8 scrollbar-thin">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#EDE9FF" }}>
              <PackageOpen size={18} style={{ color: "#4B2D9F" }} />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Import Hasil &rarr; Excel Shopee</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">
            Punya ZIP hasil generate lama? Import langsung ke sini untuk dibuatkan Excel Mass Upload Shopee &mdash; tanpa perlu generate ulang.
          </p>
        </div>

        {/* Dropzone */}
        {(stage === "idle" || stage === "parsing" || stage === "error") && (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
              isDragActive
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40",
              stage === "parsing" && "opacity-60 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#EDE9FF" }}>
                {stage === "parsing" ? (
                  <Loader2 size={20} className="animate-spin" style={{ color: "#4B2D9F" }} />
                ) : (
                  <Upload size={20} style={{ color: "#4B2D9F" }} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {stage === "parsing" ? "Membaca ZIP..." : isDragActive ? "Lepaskan di sini" : "Drop ZIP hasil generate PixelSeller"}
                </p>
                <p className="text-xs text-slate-400 mt-1">File .zip berisi folder per produk (1.jpg&ndash;5.jpg + deskripsi.txt)</p>
              </div>
              <button className="text-xs font-medium hover:underline" style={{ color: "#4B2D9F" }}>
                Pilih file ZIP
              </button>
            </div>
          </div>
        )}

        {/* Ready / summary */}
        {(stage === "ready" || busy || stage === "done") && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{zipName}</p>
                <p className="text-xs text-slate-400">{products.length} produk terdeteksi &middot; {products.reduce((s, p) => s + p.photos.length, 0)} foto total</p>
              </div>
            </div>

            {/* Preview list (first few) */}
            <div className="border-t border-slate-100 pt-3 mb-4 max-h-48 overflow-auto scrollbar-thin">
              {products.slice(0, 8).map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs text-slate-500">
                  <span className="w-5 text-slate-300">{i + 1}.</span>
                  <span className="font-medium text-slate-700 truncate flex-1">{p.namaProduk}</span>
                  <span className="text-slate-400 shrink-0">{p.photos.length} foto</span>
                </div>
              ))}
              {products.length > 8 && (
                <p className="text-xs text-slate-400 pl-7 pt-1">+ {products.length - 8} produk lainnya</p>
              )}
            </div>

            {busy && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{stage === "uploading" ? "Mengupload foto ke cloud..." : "Menyusun Excel..."}</span>
                  {stage === "uploading" && <span>{progress}%</span>}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all" style={{ width: `${stage === "building" ? 100 : progress}%`, background: "#4B2D9F" }} />
                </div>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={busy}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "#EE4D2D" }}
            >
              {stage === "uploading" ? (
                <><Loader2 size={15} className="animate-spin" /> Upload foto {progress}%</>
              ) : stage === "building" ? (
                <><Loader2 size={15} className="animate-spin" /> Menyusun Excel...</>
              ) : (
                <><FileSpreadsheet size={15} /> {excelBlob ? "Download Excel Shopee Lagi" : "Buat & Download Excel Shopee"}</>
              )}
            </button>
          </div>
        )}

        {stage === "done" && excelBlob && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>
              Excel Shopee berhasil dibuat. <strong>Wajib dicek manual</strong> sebelum upload: kolom Kategori, Harga, dan Berat masih placeholder default. Nama Produk, Deskripsi, dan link Foto sudah terisi otomatis.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cara kerja</p>
          <ul className="space-y-1.5 text-xs text-slate-500">
            <li className="flex gap-2"><span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">1.</span>Drop ZIP hasil generate (yang sudah punya folder per produk)</li>
            <li className="flex gap-2"><span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">2.</span>PixelSeller upload semua foto ke cloud &amp; ambil link publiknya</li>
            <li className="flex gap-2"><span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">3.</span>Nama folder &rarr; Nama Produk, deskripsi.txt &rarr; Deskripsi, foto &rarr; kolom Foto Shopee</li>
            <li className="flex gap-2"><span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">4.</span>Output: file Excel Mass Upload siap diedit (Kategori/Harga/Berat) lalu diupload ke Shopee</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
