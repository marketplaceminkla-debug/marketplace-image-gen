"use client";

import { X, CheckCircle, AlertCircle, Loader2, Pencil, Eye, Type } from "lucide-react";
import { ProductImage } from "@/types";
import { cn } from "@/lib/utils";

interface ImageGridProps {
  images: ProductImage[];
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  disabled?: boolean;
}

export default function ImageGrid({ images, onRemove, onEdit, onPreview, disabled }: ImageGridProps) {
  const stats = {
    total: images.length,
    done: images.filter((i) => i.status === "done").length,
    processing: images.filter((i) => i.status === "processing").length,
    error: images.filter((i) => i.status === "error").length,
    edited: images.filter((i) => i.transform || i.textLayer?.title).length,
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <p className="text-sm font-medium text-slate-700">{stats.total} foto</p>
        {stats.edited > 0 && <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#4B2D9F" }}><Pencil size={11} /> {stats.edited} diedit</span>}
        {stats.done > 0 && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> {stats.done} selesai</span>}
        {stats.processing > 0 && <span className="flex items-center gap-1 text-xs" style={{ color: "#4B2D9F" }}><Loader2 size={12} className="animate-spin" /> {stats.processing} diproses</span>}
        {stats.error > 0 && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle size={12} /> {stats.error} gagal</span>}
      </div>

      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
        {images.map((img) => {
          const hasEdit = !!(img.transform || img.textLayer?.title);
          const isDone = img.status === "done";
          return (
            <div key={img.id} className="relative group aspect-square">
              {/* Show result if done, otherwise show original */}
              <img
                src={isDone && img.resultUrl ? img.resultUrl : img.previewUrl}
                alt={img.name}
                className={cn("w-full h-full object-cover rounded-lg border-2 transition-all",
                  hasEdit ? "border-yellow-400" : isDone ? "border-green-400" : "border-slate-200")} />

              {/* Status overlay */}
              {img.status === "processing" && (
                <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-purple-500/40">
                  <Loader2 size={14} className="text-white animate-spin" />
                </div>
              )}
              {img.status === "error" && (
                <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-red-500/40">
                  <AlertCircle size={14} className="text-white" />
                </div>
              )}

              {/* Badges */}
              {hasEdit && img.status === "pending" && (
                <div className="absolute top-1 left-1 flex gap-1">
                  {img.transform && <div className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "#F5C200", color: "#2D1B69" }}>POS</div>}
                  {img.textLayer?.title && <div className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "#4B2D9F", color: "#fff" }}>TXT</div>}
                </div>
              )}

              {/* Hover actions */}
              {!disabled && (
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 bg-black/40">
                  <button onClick={() => onPreview(img.id)} title="Preview"
                    className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors">
                    <Eye size={11} />
                  </button>
                  <button onClick={() => onEdit(img.id)} title="Edit"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white transition-colors"
                    style={{ background: "#4B2D9F" }}>
                    <Pencil size={11} />
                  </button>
                  {img.status === "pending" && (
                    <button onClick={() => onRemove(img.id)} title="Hapus"
                      className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors">
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
