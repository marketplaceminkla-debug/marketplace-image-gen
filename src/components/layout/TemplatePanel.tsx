"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { LayoutTemplate, Upload, Trash2, AlertCircle, Star, Loader2, RefreshCw } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import {
  saveTemplate,
  getAllTemplates,
  deleteTemplate,
  setActiveTemplate,
  getActiveTemplate,
} from "@/lib/imageProcessor";
import type { TemplateData } from "@/types";
import DescriptionTemplateSection from "@/components/ui/DescriptionTemplateSection";

interface TemplatePanelProps {
  onTemplateChange: (hasTemplate: boolean) => void;
}

export default function TemplatePanel({ onTemplateChange }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, active] = await Promise.all([getAllTemplates(), getActiveTemplate()]);
      setTemplates(all);
      setActiveId(active?.id ?? "");
      onTemplateChange(all.length > 0);
    } catch (err) {
      setError("Gagal memuat template. Cek koneksi internet.");
    } finally {
      setLoading(false);
    }
  }, [onTemplateChange]);

  useEffect(() => { refresh(); }, [refresh]);

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted[0]) return;
    setPendingFile(accepted[0]);
    setNewName(accepted[0].name.replace(/\.[^.]+$/, ""));
    setShowForm(true);
    setError(null);
  }, []);

  const handleSave = async () => {
    if (!pendingFile || !newName.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await saveTemplate(pendingFile, newName.trim());
      await refresh();
      setShowForm(false);
      setPendingFile(null);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const handleSetActive = (id: string) => {
    setActiveTemplate(id);
    setActiveId(id);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteTemplate(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hapus gagal");
    } finally {
      setDeletingId(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="h-full overflow-auto p-8 scrollbar-thin">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#EDE9FF" }}>
              <LayoutTemplate size={18} style={{ color: "#4B2D9F" }} />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Template Manager</h1>
            <button
              onClick={refresh}
              disabled={loading}
              title="Refresh"
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <p className="text-slate-500 text-sm ml-12">
            Kelola template frame untuk setiap toko. Klik bintang untuk set aktif.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Memuat template dari cloud...</span>
          </div>
        )}

        {/* Template list */}
        {!loading && templates.length > 0 && (
          <div className="space-y-2 mb-6">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className={cn(
                  "bg-white border rounded-xl p-4 flex items-center gap-3 transition-all",
                  tmpl.id === activeId
                    ? "border-yellow-400 shadow-sm"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                {/* Preview thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                  <img
                    src={tmpl.dataUrl}
                    alt={tmpl.name}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{tmpl.name}</p>
                    {tmpl.id === activeId && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: "#F5C200", color: "#2D1B69" }}
                      >
                        AKTIF
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {tmpl.filename} · {formatBytes(tmpl.size)}
                  </p>
                  <p className="text-xs text-slate-300">
                    {new Date(tmpl.uploadedAt).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {tmpl.id !== activeId ? (
                    <button
                      onClick={() => handleSetActive(tmpl.id)}
                      title="Set aktif"
                      className="w-8 h-8 rounded-lg hover:bg-yellow-50 flex items-center justify-center transition-colors text-slate-400 hover:text-yellow-500"
                    >
                      <Star size={15} />
                    </button>
                  ) : (
                    <Star size={15} style={{ color: "#F5C200" }} className="mx-1" />
                  )}
                  <button
                    onClick={() => handleDelete(tmpl.id)}
                    disabled={deletingId === tmpl.id}
                    title="Hapus"
                    className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors text-slate-400 hover:text-red-500 disabled:opacity-40"
                  >
                    {deletingId === tmpl.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Name form after file pick */}
        {showForm && pendingFile && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 animate-slide-up">
            <p className="text-sm font-medium text-slate-700 mb-2">Beri nama template ini:</p>
            <p className="text-xs text-slate-400 mb-3">
              File: {pendingFile.name} · {formatBytes(pendingFile.size)}
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="cth: KLA Computer, Gadget Klik..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-400"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setPendingFile(null); }}
                className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={!newName.trim() || uploading}
                className="flex-1 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#4B2D9F" }}
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Mengupload...
                  </>
                ) : (
                  "Simpan Template"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Drop zone */}
        {!loading && !showForm && (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
              isDragActive
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40",
              uploading && "opacity-60 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#EDE9FF" }}
              >
                <Upload size={20} style={{ color: "#4B2D9F" }} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {isDragActive ? "Lepaskan di sini" : "Tambah template baru"}
                </p>
                <p className="text-xs text-slate-400 mt-1">PNG (transparansi) atau JPG</p>
              </div>
              <button className="text-xs font-medium hover:underline" style={{ color: "#4B2D9F" }}>
                Pilih file
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-600 rounded-lg px-4 py-3 text-sm">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        {/* Description templates */}
        <DescriptionTemplateSection />

        {/* Tips */}
        <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tips</p>
          <ul className="space-y-1.5 text-xs text-slate-500">
            <li className="flex gap-2">
              <span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">→</span>
              Template tersimpan di cloud — tidak hilang walau ganti browser
            </li>
            <li className="flex gap-2">
              <span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">→</span>
              Satu template aktif dipakai untuk semua generate
            </li>
            <li className="flex gap-2">
              <span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">→</span>
              Klik ⭐ untuk ganti template aktif kapan saja
            </li>
            <li className="flex gap-2">
              <span style={{ color: "#4B2D9F" }} className="font-bold shrink-0">→</span>
              Template bisa diakses dari perangkat mana pun
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
