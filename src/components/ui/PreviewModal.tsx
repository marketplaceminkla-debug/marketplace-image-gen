"use client";

import { X, Loader2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { ProcessingSettings } from "@/types";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl: string | null;
  loading: boolean;
  imageName?: string;
  settings: ProcessingSettings;
  // Multi-image navigation
  currentIndex?: number;
  totalImages?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export default function PreviewModal({
  isOpen, onClose, previewUrl, loading, imageName, settings,
  currentIndex, totalImages, onPrev, onNext,
}: PreviewModalProps) {
  if (!isOpen) return null;
  const hasNav = totalImages && totalImages > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">Preview Output</p>
            {hasNav && <span className="text-xs text-slate-400 ml-1">{(currentIndex ?? 0) + 1} / {totalImages}</span>}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
            <X size={14} />
          </button>
        </div>

        <div className="bg-slate-100 flex items-center justify-center relative" style={{ minHeight: 360 }}>
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin" style={{ color: "#4B2D9F" }} />
              <p className="text-sm">Generating preview...</p>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[500px] object-contain" />
          ) : null}

          {/* Navigation arrows */}
          {hasNav && !loading && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                className="absolute left-2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors">
                <ChevronLeft size={18} className="text-slate-700" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                className="absolute right-2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors">
                <ChevronRight size={18} className="text-slate-700" />
              </button>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-400 truncate max-w-[200px]">{imageName}</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span>{settings.outputWidth}×{settings.outputHeight}px</span>
            <span>·</span>
            <span>Q{settings.outputQuality}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
