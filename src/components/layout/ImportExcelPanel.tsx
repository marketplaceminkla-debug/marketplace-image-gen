"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Upload, ImageIcon, AlertCircle, CheckCircle2, XCircle, ArrowRight, Loader2, X } from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { parseProductExcel, ExcelRow } from "@/lib/excelParser";
import { ProductImage, DEFAULT_TEXT_LAYER } from "@/types";

interface ImportExcelPanelProps {
  onImport: (images: ProductImage[]) => void;
  templateUploaded: boolean;
}

interface MatchedRow {
  row: ExcelRow;
  file: File | null;
  previewUrl: string | null;
}

export default function ImportExcelPanel({ onImport, templateUploaded }: ImportExcelPanelProps) {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [matched, setMatched] = useState<MatchedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "review">("upload");

  // ── Excel dropzone ──────────────────────────────────────────────────────────
  const onDropExcel = useCallback(async (accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setExcelFile(file);
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseProductExcel(file);
      if (parsed.length === 0) throw new Error("Tidak ada data yang terbaca. Pastikan kolom A = nomor, B = judul, C = spek.");
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca Excel.");
      setExcelFile(null);
      setRows([]);
    } finally {
      setParsing(false);
    }
  }, []);

  const { getRootProps: getExcelProps, getInputProps: getExcelInput, isDragActive: isDragExcel } = useDropzone({
    onDrop: onDropExcel,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: parsing,
  });

  // ── Photo dropzone ──────────────────────────────────────────────────────────
  const onDropPhotos = useCallback((accepted: File[]) => {
    setPhotoFiles(accepted);
    setError(null);
  }, []);

  const { getRootProps: getPhotoProps, getInputProps: getPhotoInput, isDragActive: isDragPhoto } = useDropzone({
    onDrop: onDropPhotos,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] },
    disabled: parsing,
  });

  // ── Match & preview ─────────────────────────────────────────────────────────
  const handleMatch = useCallback(() => {
    if (rows.length === 0 || photoFiles.length === 0) return;

    // Build map: nomor → file (by filename: "1.jpg", "2.jpg", etc.)
    const fileMap = new Map<number, File>();
    for (const f of photoFiles) {
      const baseName = f.name.replace(/\.[^.]+$/, "");
      const n = Number(baseName);
      if (!isNaN(n) && n > 0) fileMap.set(n, f);
    }

    const result: MatchedRow[] = rows.map((row) => {
      const file = fileMap.get(row.nomor) ?? null;
      return {
        row,
        file,
        previewUrl: file ? URL.createObjectURL(file) : null,
      };
    });

    setMatched(result);
    setStep("review");
  }, [rows, photoFiles]);

  // ── Remove a row from review ────────────────────────────────────────────────
  const removeRow = (nomor: number) => {
    setMatched((prev) => prev.filter((m) => m.row.nomor !== nomor));
  };

  // ── Send to Generate panel ──────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    const validRows = matched.filter((m) => m.file !== null);
    if (validRows.length === 0) return;

    const productImages: ProductImage[] = validRows.map((m) => ({
      id: generateId(),
      file: m.file!,
      name: m.file!.name,
      previewUrl: m.previewUrl!,
      status: "pending" as const,
      judul: m.row.judul || undefined,
      spekLengkap: m.row.spekLengkap || undefined,
      textLayer: {
        title: {
          ...DEFAULT_TEXT_LAYER.title,
          text: m.row.judul,
        },
        subtitle: {
          ...DEFAULT_TEXT_LAYER.subtitle,
          text: m.row.spek,
        },
      },
    }));

    onImport(productImages);
  }, [matched, onImport]);

  const reset = () => {
    setExcelFile(null);
    setPhotoFiles([]);
    setRows([]);
    setMatched([]);
    setError(null);
    setStep("upload");
  };

  const matchedCount = matched.filter((m) => m.file !== null).length;
  const unmatchedCount = matched.filter((m) => m.file === null).length;

  // ── REVIEW STEP ─────────────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="border-b border-main-border bg-white px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Review Import</h1>
            <p className="text-xs text-slate-400">
              {matchedCount} foto cocok · {unmatchedCount} tidak ditemukan
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            >
              Mulai ulang
            </button>
            <button
              onClick={handleImport}
              disabled={matchedCount === 0 || !templateUploaded}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                matchedCount === 0 || !templateUploaded
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "text-white"
              )}
              style={matchedCount > 0 && templateUploaded ? { background: "#4B2D9F" } : {}}
            >
              <ArrowRight size={14} />
              Kirim ke Generate ({matchedCount} foto)
            </button>
          </div>
        </div>

        {!templateUploaded && (
          <div
            className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
            style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid rgba(245,194,0,0.4)" }}
          >
            <AlertCircle size={16} className="shrink-0" />
            Upload template frame terlebih dahulu di menu &quot;Upload Template&quot;
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto p-6 scrollbar-thin">
          <div className="rounded-xl border border-main-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-main-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-20">Foto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Judul Produk</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Spek Singkat</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 w-24">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matched.map((m) => (
                  <tr key={m.row.nomor} className={cn("bg-white", !m.file && "bg-red-50/40")}>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{m.row.nomor}</td>
                    <td className="px-4 py-3">
                      {m.previewUrl ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                          <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center">
                          <ImageIcon size={16} className="text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">
                      {m.row.judul || <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {m.row.spek || <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.file ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 size={12} /> Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500">
                          <XCircle size={12} /> Foto {m.row.nomor}.jpg tidak ditemukan
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => removeRow(m.row.nomor)}
                        className="p-1 text-slate-300 hover:text-red-400 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unmatchedCount > 0 && (
            <p className="text-xs text-slate-400 mt-3">
              Baris yang fotonya tidak ditemukan akan dilewati saat generate. Bisa juga dihapus pakai tombol ×.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── UPLOAD STEP ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-main-border bg-white px-4 md:px-8 py-3 md:py-4 shrink-0">
        <h1 className="text-lg font-semibold text-slate-900">Import Excel</h1>
        <p className="text-xs text-slate-400">Upload file Excel + foto produk, judul & spek langsung ter-apply otomatis</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5 scrollbar-thin">
        {error && (
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* Format info */}
        <div className="rounded-xl border border-main-border bg-slate-50 p-4 text-xs text-slate-500 space-y-2">
          <p className="font-semibold text-slate-700 text-sm">Format Excel yang diharapkan</p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  {["Kolom A", "Kolom B", "Kolom C", "Kolom D"].map((h) => (
                    <th key={h} className="text-left px-3 py-1.5 bg-slate-200 border border-slate-300 font-semibold text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {["Nomor urut (1, 2, 3…)", "Judul Produk", "Spek Singkat", "Spek Lengkap (opsional)"].map((v, i) => (
                    <td key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 italic">{v}</td>
                  ))}
                </tr>
                <tr>
                  {["1", "Lenovo Legion 5", "Core i7, 16GB", "Intel Core i7-13700H | 16GB DDR5 | ..."].map((v, i) => (
                    <td key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700">{v}</td>
                  ))}
                </tr>
                <tr>
                  {["2", "Logitech MX3", "Wireless, 4000 DPI", ""].map((v, i) => (
                    <td key={i} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700">{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-slate-400">
            Foto produk diberi nama sesuai nomor urut: <code className="bg-slate-200 px-1 rounded">1.jpg</code>, <code className="bg-slate-200 px-1 rounded">2.jpg</code>, dst. Format JPG, JPEG, PNG, WEBP.
          </p>
        </div>

        {/* Step 1: Excel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
              style={{ background: "#4B2D9F", color: "#fff" }}
            >1</span>
            <p className="text-sm font-semibold text-slate-700">Upload file Excel (.xlsx)</p>
            {excelFile && !parsing && (
              <span className="ml-auto text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> {rows.length} baris terbaca
              </span>
            )}
          </div>
          <div
            {...getExcelProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 flex items-center gap-4 cursor-pointer transition-all",
              isDragExcel ? "border-purple-400 bg-purple-50" : excelFile ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 hover:border-purple-400 hover:bg-purple-50/30"
            )}
          >
            <input {...getExcelInput()} />
            {parsing ? (
              <Loader2 size={28} className="animate-spin text-purple-400 shrink-0" />
            ) : (
              <FileSpreadsheet size={28} className={cn("shrink-0", excelFile ? "text-emerald-500" : "text-slate-300")} />
            )}
            <div className="min-w-0">
              {parsing ? (
                <p className="text-sm text-slate-500">Membaca Excel...</p>
              ) : excelFile ? (
                <>
                  <p className="text-sm font-medium text-slate-700 truncate">{excelFile.name}</p>
                  <p className="text-xs text-slate-400">{rows.length} produk · klik untuk ganti</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">Drag & drop file .xlsx</p>
                  <p className="text-xs text-slate-400">atau klik untuk pilih</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Photos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
              style={{ background: "#4B2D9F", color: "#fff" }}
            >2</span>
            <p className="text-sm font-semibold text-slate-700">Upload foto produk</p>
            {photoFiles.length > 0 && (
              <span className="ml-auto text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={12} /> {photoFiles.length} foto
              </span>
            )}
          </div>
          <div
            {...getPhotoProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6 flex items-center gap-4 cursor-pointer transition-all",
              isDragPhoto ? "border-purple-400 bg-purple-50" : photoFiles.length > 0 ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 hover:border-purple-400 hover:bg-purple-50/30"
            )}
          >
            <input {...getPhotoInput()} />
            {photoFiles.length > 0 ? (
              <div className="flex -space-x-2 shrink-0">
                {photoFiles.slice(0, 4).map((f, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg border-2 border-white overflow-hidden bg-slate-100">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {photoFiles.length > 4 && (
                  <div className="w-10 h-10 rounded-lg border-2 border-white bg-slate-200 flex items-center justify-center text-xs text-slate-500 font-medium">
                    +{photoFiles.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <Upload size={28} className="text-slate-300 shrink-0" />
            )}
            <div className="min-w-0">
              {photoFiles.length > 0 ? (
                <>
                  <p className="text-sm font-medium text-slate-700">{photoFiles.length} foto dipilih</p>
                  <p className="text-xs text-slate-400">klik untuk ganti</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-600">Drag & drop semua foto produk</p>
                  <p className="text-xs text-slate-400">Nama file: 1.jpg, 2.jpg, 3.jpg, dst · JPG PNG WEBP</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Match button */}
        <button
          onClick={handleMatch}
          disabled={rows.length === 0 || photoFiles.length === 0}
          className={cn(
            "w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors",
            rows.length === 0 || photoFiles.length === 0
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "text-white hover:opacity-90"
          )}
          style={rows.length > 0 && photoFiles.length > 0 ? { background: "#4B2D9F" } : {}}
        >
          <ArrowRight size={16} />
          Cocokkan & Review
        </button>
      </div>
    </div>
  );
}
