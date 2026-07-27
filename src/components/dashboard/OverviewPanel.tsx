"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, AlertCircle, Loader2, ChevronRight, Zap } from "lucide-react";
import { listOpenPendingItems, listStoreAccounts, type PendingItem, type StoreAccount } from "@/lib/reporting";
import { loadAllPicKpi, fmtKpiValue, type PicKpiSummary } from "@/lib/kpi";
import type { ViewId } from "@/components/layout/workspaceNav";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function currentMonth() { return new Date().toISOString().slice(0, 7); }
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTHS_ID[Number(mo) - 1] ?? mo} ${y}`;
}

// Score → color tokens
function scoreColor(pct: number) {
  if (pct >= 100) return { text: "text-emerald-400", ring: "ring-emerald-500/30", glow: "shadow-emerald-500/20", bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (pct >= 75)  return { text: "text-brand",       ring: "ring-brand/30",        glow: "shadow-brand/20",       bar: "bg-brand",       badge: "bg-brand/15 text-brand border-brand/30" };
  if (pct >= 50)  return { text: "text-amber-400",   ring: "ring-amber-400/30",    glow: "shadow-amber-400/20",   bar: "bg-amber-400",   badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" };
  return           { text: "text-red-400",    ring: "ring-red-400/30",     glow: "shadow-red-400/20",    bar: "bg-red-500",     badge: "bg-red-500/15 text-red-400 border-red-500/30" };
}

function scoreLabel(pct: number) {
  if (pct >= 100) return "Tercapai";
  if (pct >= 75)  return "On Track";
  if (pct >= 50)  return "Perlu Upaya";
  return "Perlu Perhatian";
}

function RadialScore({ pct }: { pct: number }) {
  const c = scoreColor(pct);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8"
          stroke="currentColor" className={c.text}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-black ${c.text}`}>{pct.toFixed(0)}%</span>
        <span className="text-[10px] text-slate-500 font-medium">{scoreLabel(pct)}</span>
      </div>
    </div>
  );
}

function MiniRadial({ pct, size = 48 }: { pct: number; size?: number }) {
  const c = scoreColor(pct);
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-700" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth="5"
          stroke="currentColor" className={c.text}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[11px] font-bold ${c.text}`}>{pct.toFixed(0)}%</span>
      </div>
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
    Promise.all([loadAllPicKpi(month), listOpenPendingItems(), listStoreAccounts()])
      .then(([summaries, pending, stores]) => {
        if (!active) return;
        setPicSummaries(summaries);
        setPendingItems(pending);
        setStoreMap(new Map(stores.map((s) => [s.id, s])));
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => { active = false; };
  }, [month]);

  const avgPct = picSummaries.length
    ? picSummaries.reduce((s, p) => s + p.totalPct, 0) / picSummaries.length
    : 0;
  const avgC = scoreColor(avgPct);

  const allNeedsAttention = picSummaries.flatMap((p) =>
    p.needsAttention.map((r) => ({ ...r, pic: p.pic })),
  );

  return (
    <div className="h-full overflow-y-auto bg-slate-950 scrollbar-thin">
      <div className="px-6 md:px-8 py-6 max-w-4xl space-y-5">

        {/* ── Hero: total score ── */}
        <div className={`relative overflow-hidden rounded-3xl bg-slate-900 ring-1 ${avgC.ring} shadow-lg ${avgC.glow} p-6`}>
          {/* decorative glow blob */}
          <div className={`absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-20 ${avgC.bar}`} />
          <div className="relative flex items-center gap-6">
            <RadialScore pct={avgPct} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mb-1">Overview / KPI</p>
              <h1 className="text-2xl font-black text-white leading-tight">Total Marketplace</h1>
              <p className="text-sm text-slate-400 mt-0.5">{monthLabel(month)}</p>
              <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full border text-xs font-semibold ${avgC.badge}`}>
                <Zap size={11} />
                {scoreLabel(avgPct)} · rata-rata {picSummaries.length} anggota
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat data…
          </div>
        ) : (
          <>
            {/* ── Per-PIC cards ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Capaian per Anggota</p>
                <button onClick={() => onNavigate("dash-kpi")}
                  className="flex items-center gap-1 text-xs text-brand hover:text-brand-hover font-medium">
                  Detail KPI <ChevronRight size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {picSummaries.map((p) => {
                  const c = scoreColor(p.totalPct);
                  return (
                    <button key={p.pic} onClick={() => onNavigate("dash-kpi")}
                      className={`relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ${c.ring} p-4 text-left group hover:bg-slate-800 transition-all`}>
                      <div className={`absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-15 ${c.bar}`} />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-xs text-slate-500 font-medium">{p.pic}</p>
                            <p className={`text-3xl font-black mt-0.5 ${c.text}`}>{p.totalPct.toFixed(0)}%</p>
                          </div>
                          <MiniRadial pct={p.totalPct} size={44} />
                        </div>
                        <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(p.totalPct, 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">{p.totalNilai.toFixed(1)} / {p.totalBobot} poin</p>
                        {p.needsAttention.length > 0 ? (
                          <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={9} /> {p.needsAttention.length} perlu dikejar
                          </p>
                        ) : (
                          <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                            <CheckCircle2 size={9} /> Semua on track
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Indikator perlu dikejar ── */}
            {allNeedsAttention.length > 0 ? (
              <div className="rounded-2xl bg-slate-900 ring-1 ring-red-500/20 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <AlertTriangle size={13} className="text-red-400" />
                  </div>
                  <span className="text-sm font-semibold text-white">Perlu Dikejar</span>
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                    {allNeedsAttention.length} indikator
                  </span>
                </div>
                <div className="divide-y divide-slate-800">
                  {allNeedsAttention.map((r) => {
                    const c = scoreColor(r.capaian_pct);
                    return (
                      <div key={`${r.pic}-${r.id}`} className="flex items-center gap-4 px-5 py-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 shrink-0 w-14 text-center">
                          {r.pic}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 font-medium truncate">{r.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {fmtKpiValue(r.actual_value, r.unit)} <span className="text-slate-600">dari</span> {fmtKpiValue(r.effective_target, r.unit)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${r.capaian_pct}%` }} />
                          </div>
                          <span className={`text-xs font-bold w-9 text-right ${c.text}`}>{r.capaian_pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 px-5 py-4">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Semua indikator on track!</p>
                  <p className="text-xs text-slate-500 mt-0.5">Pertahankan performa bulan ini.</p>
                </div>
              </div>
            )}

            {/* ── Pending followup ── */}
            {pendingItems.length > 0 && (
              <div className="rounded-2xl bg-slate-900 ring-1 ring-amber-400/20 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800">
                  <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center">
                    <AlertCircle size={13} className="text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-white">Pending Followup</span>
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">
                    {pendingItems.length} item
                  </span>
                  <button onClick={() => onNavigate("dash-report")}
                    className="text-xs text-brand hover:text-brand-hover font-medium flex items-center gap-1">
                    Kelola <ChevronRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-slate-800">
                  {pendingItems.slice(0, 6).map((p) => {
                    const store = storeMap.get(p.store_account_id);
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="flex-1 text-sm text-slate-300 truncate">{p.product_name}</span>
                        {store && <span className="text-[10px] text-slate-500 shrink-0">{store.pic_name}</span>}
                        <span className="text-[10px] text-slate-600 shrink-0">{p.report_date}</span>
                      </div>
                    );
                  })}
                  {pendingItems.length > 6 && (
                    <p className="text-[11px] text-slate-500 px-5 py-2">+{pendingItems.length - 6} lainnya</p>
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
