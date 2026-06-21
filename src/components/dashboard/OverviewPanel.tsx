"use client";

import { useEffect, useState } from "react";
import { Gauge, TrendingUp, Target, Percent, Loader2, type LucideIcon } from "lucide-react";
import { getTarget, listEntries, formatIDR } from "@/lib/revenue";
import type { ViewId } from "@/components/layout/workspaceNav";

export default function OverviewPanel({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [target, setTarget] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([getTarget(), listEntries()]).then(([t, entries]) => {
      if (!active) return;
      setTarget(t);
      setTotal(entries.reduce((s, e) => s + e.amount, 0));
      setCount(entries.length);
      setLoading(false);
    }).catch(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-5xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Gauge size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Overview / KPI</h1>
            <p className="text-sm text-slate-500 mt-1">Ringkasan performa tim marketplace.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi icon={Percent} label="Pencapaian Target" value={`${pct.toFixed(1)}%`} accent />
              <Kpi icon={TrendingUp} label="Total Revenue" value={formatIDR(total)} />
              <Kpi icon={Target} label="Target Revenue" value={formatIDR(target)} />
              <Kpi icon={Gauge} label="Jumlah Input" value={`${count}×`} />
            </div>

            {/* Progress bar shortcut */}
            <button
              onClick={() => onNavigate("dash-revenue")}
              className="template-card w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mt-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">Progress revenue ke target</span>
                <span className="text-sm font-bold text-brand-hover">{pct.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="progress-bar-fill h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Klik buat buka & input revenue →</p>
            </button>

            <p className="text-xs text-slate-400 mt-5">
              KPI produk (produk baru, listing pending) bakal muncul di sini setelah modul Product Listing dibangun. 🚧
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${accent ? "bg-brand-light border-brand-muted" : "bg-white border-slate-200"}`}>
      <Icon size={18} className={accent ? "text-brand-hover" : "text-slate-400"} />
      <p className="text-lg font-bold text-slate-900 mt-2 truncate">{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
