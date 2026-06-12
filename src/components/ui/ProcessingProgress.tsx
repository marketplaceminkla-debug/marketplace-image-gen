"use client";

import { CheckCircle, AlertCircle, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProcessingProgressProps {
  progress: number;
  success: number;
  failed: number;
  total: number;
  isDone: boolean;
  errors: Array<{ filename: string; message: string }>;
}

export default function ProcessingProgress({ progress, success, failed, total, isDone, errors }: ProcessingProgressProps) {
  const [showErrors, setShowErrors] = useState(false);

  return (
    <div className={cn("rounded-xl border mb-5 overflow-hidden animate-slide-up bg-white", isDone ? "border-slate-200" : "border-kla-purple/30")}
      style={isDone ? {} : { background: "#F9F7FF" }}>
      <div className="px-5 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: isDone ? "#D1FAE5" : "#EDE9FF" }}>
          {isDone
            ? <CheckCircle size={16} className="text-green-600" />
            : <Zap size={16} className="animate-progress-pulse" style={{ color: "#4B2D9F" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{isDone ? "Selesai diproses!" : "Sedang memproses..."}</p>
          <p className="text-xs text-slate-500">
            {isDone
              ? `${success} berhasil${failed > 0 ? `, ${failed} gagal` : ""} dari ${total} foto`
              : `${success + failed} / ${total} foto · ${progress}%`}
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-800 leading-none">{progress}%</p>
      </div>

      <div className="h-1.5 mx-5 mb-4 rounded-full overflow-hidden" style={{ background: "#E2E8F0" }}>
        <div className="h-full rounded-full progress-bar-fill"
          style={{ width: `${progress}%`, background: isDone ? (failed > 0 ? "#F59E0B" : "#10B981") : "#4B2D9F" }} />
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-slate-100" style={{ background: "#F1F5F9" }}>
        {[["Total", total, "text-slate-700"], ["Berhasil", success, "text-green-600"], ["Gagal", failed, failed > 0 ? "text-red-500" : "text-slate-400"]].map(([label, value, color]) => (
          <div key={label as string} className="bg-white px-4 py-2.5 text-center">
            <p className={cn("text-lg font-bold tabular-nums leading-none", color as string)}>{value as number}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{label as string}</p>
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="border-t border-slate-100">
          <button onClick={() => setShowErrors(!showErrors)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-red-500 hover:bg-red-50 transition-colors">
            <span className="flex items-center gap-1.5 font-medium"><AlertCircle size={12} />{errors.length} file gagal</span>
            {showErrors ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showErrors && (
            <div className="px-5 pb-3 space-y-1 animate-fade-in max-h-40 overflow-auto scrollbar-thin">
              {errors.map((err, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-slate-400 truncate max-w-[180px] shrink-0">{err.filename}</span>
                  <span className="text-red-500">{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
