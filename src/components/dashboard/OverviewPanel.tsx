"use client";

import { useEffect, useState } from "react";
import { Gauge, AlertTriangle, CheckCircle2, AlertCircle, Loader2, TrendingUp, Users } from "lucide-react";
import { listOpenPendingItems, listStoreAccounts, type PendingItem, type StoreAccount } from "@/lib/reporting";
import { loadAllPicKpi, fmtKpiValue, type PicKpiSummary } from "@/lib/kpi";
import type { ViewId } from "@/components/layout/workspaceNav";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function currentMonth() { return new Date().toISOString().slice(0, 7); }
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTHS_ID[Number(mo) - 1] ?? mo} ${y}`;
}

function capaianColor(pct: number) {
  if (pct >= 100) return "text-green-500";
  if (pct >= 75)  return "text-brand-hover";
  if (pct >= 50)  return "text-yellow-500";
  return "text-red-500";
}
function capaianBg(pct: number) {
  if (pct >= 100) return "bg-green-50 border-green-200";
  if (pct >= 75)  return "bg-brand-light border-brand-muted";
  if (pct >= 50)  return "bg-yellow-50 border-yellow-200";
  return "bg-red-50 border-red-200";
}
function barColor(pct: number) {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 75)  return "bg-brand";
  if (pct >= 50)  return "bg-yellow-400";
  return "bg-red-500";
}

function MiniBar({ pct }: { pct: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
      <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

export default function OverviewPanel({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const [loading, setLoading] = useState(true);
  const [picSummaries, setPicSummaries] = useState<PicKpiSummary[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [storeMap, setStoreMap] = useState<Map<string, StoreAccount>>(new Map());
  const month = currentMonth();

  useEffect(() => {
    let active = true;
    Promise.all([
      loadAllPicKpi(month),
      listOpenPendingItems(),
      listStoreAccounts(),
    ]).then(([summaries, pending, stores]) => {
      if (!active) return;
      setPicSummaries(summaries);
      setPendingItems(pending);
      setStoreMap(new Map(stores.map((s) => [s.id, s])));
      setLoading(false);
    }).catch(() => active && setLoading(false));
    return () => { active = false; };
  }, [month]);

  // Total semua PIC: rata-rata nilai KPI
  const avgPct = picSummaries.length
    ? picSummaries.reduce((s, p) => s + p.totalPct, 0) / picSummaries.length
    : 0;

  // Semua indikator yang perlu dikejar (gabungan semua PIC)
  const allNeedsAttention = picSummaries.flatMap((p) =>
    p.needsAttention.map((r) => ({ ...r, pic: p.pic })),
  );

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Gauge size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Overview / KPI</h1>
            <p className="text-sm text-slate-500 mt-1">Ringkasan pencapaian tim marketplace · {monthLabel(month)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : (
          <>
            {/* Total marketplace score */}
            <div className={`rounded-2xl border p-5 ${capaianBg(avgPct)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">Total KPI Marketplace — {monthLabel(month)}</span>
                </div>
                <span className={`text-2xl font-bold ${capaianColor(avgPct)}`}>{avgPct.toFixed(0)}%</span>
              </div>
              <MiniBar pct={avgPct} />
              <p className="text-[11px] text-slate-400 mt-2">Rata-rata dari {picSummaries.length} anggota tim</p>
            </div>

            {/* Per-PIC cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">Capaian per Anggota Tim</h2>
                <button onClick={() => onNavigate("dash-kpi")}
                  className="ml-auto text-[11px] text-brand-hover hover:underline font-medium">
                  Detail KPI →
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {picSummaries.map((p) => (
                  <button key={p.pic} onClick={() => onNavigate("dash-kpi")}
                    className={`rounded-2xl border p-4 text-left transition-all hover:shadow-md ${capaianBg(p.totalPct)}`}>
                    <p className="text-xs text-slate-500 font-medium">{p.pic}</p>
                    <p className={`text-2xl font-bold mt-1 ${capaianColor(p.totalPct)}`}>
                      {p.totalPct.toFixed(0)}%
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {p.totalNilai.toFixed(1)} / {p.totalBobot}
                    </p>
                    <MiniBar pct={p.totalPct} />
                    {p.needsAttention.length > 0 && (
                      <p className="text-[10px] text-red-500 mt-1.5 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        {p.needsAttention.length} perlu dikejar
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Indikator yang perlu dikejar */}
            {allNeedsAttention.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={15} className="text-red-500 shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    Indikator yang Perlu Dikejar ({allNeedsAttention.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {allNeedsAttention.map((r) => (
                    <div key={`${r.pic}-${r.id}`}
                      className="flex items-center gap-3 bg-white rounded-xl border border-red-100 px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{r.pic}</span>
                          <span className="text-sm text-slate-800 font-medium truncate">{r.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Aktual {fmtKpiValue(r.actual_value, r.unit)} dari target {fmtKpiValue(r.effective_target, r.unit)}
                        </p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${capaianColor(r.capaian_pct)}`}>
                        {r.capaian_pct.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allNeedsAttention.length === 0 && picSummaries.length > 0 && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm font-medium">
                <CheckCircle2 size={16} />
                Semua indikator KPI on track bulan ini! 🎉
              </div>
            )}

            {/* Pending Followup Widget */}
            {pendingItems.length > 0 && (
              <div className="bg-warning-light border border-warning/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-warning shrink-0" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    Perlu Followup — {pendingItems.length} pending
                  </h3>
                  <button onClick={() => onNavigate("dash-report")}
                    className="ml-auto text-[11px] text-brand-hover hover:underline font-medium">
                    Kelola →
                  </button>
                </div>
                <div className="space-y-1.5">
                  {pendingItems.slice(0, 6).map((p) => {
                    const store = storeMap.get(p.store_account_id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={13} className="text-warning shrink-0" />
                        <span className="flex-1 text-slate-700">{p.product_name}</span>
                        {store && <span className="text-[10px] text-slate-400 shrink-0">{store.pic_name}</span>}
                        <span className="text-[10px] text-slate-400 shrink-0">{p.report_date}</span>
                      </div>
                    );
                  })}
                  {pendingItems.length > 6 && (
                    <p className="text-[11px] text-slate-400 pl-5">+{pendingItems.length - 6} lainnya…</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
