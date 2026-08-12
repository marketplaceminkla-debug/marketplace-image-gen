"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface MultiSelectOption<T extends string> { value: T; label: string; count: number; }

/** Multi-select filter dropdown (pill button + checklist popup), shared across
 * list views — e.g. Orderan Gudang and Retur & Gagal Kirim. */
export default function MultiSelectFilter<T extends string>({
  label, options, selected, onChange,
}: {
  label: string;
  options: MultiSelectOption<T>[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle(v: T) {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }

  const summary = selected.size === 0
    ? "Semua"
    : selected.size === 1
      ? (options.find((o) => o.value === Array.from(selected)[0])?.label ?? "1 dipilih")
      : `${selected.size} dipilih`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected.size ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}
      >
        {label}: {summary}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="glass-panel absolute left-0 z-20 mt-1.5 min-w-[200px] max-h-64 overflow-y-auto rounded-xl py-1">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="w-full text-left px-3 py-1.5 text-xs text-brand-hover hover:bg-slate-50 font-medium border-b border-slate-100 mb-1"
            >
              Reset (semua)
            </button>
          )}
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">Tidak ada opsi.</p>
          ) : (
            options.map((o) => {
              const checked = selected.has(o.value);
              return (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 text-left"
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${checked ? "bg-brand border-brand" : "border-slate-300"}`}>
                    {checked && <Check size={10} className="text-slate-900" />}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="text-slate-400 shrink-0">({o.count})</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
