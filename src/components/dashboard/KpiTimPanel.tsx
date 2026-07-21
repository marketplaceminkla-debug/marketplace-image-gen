"use client";

import { useEffect, useState, useCallback } from "react";
import { Award, TrendingUp, Loader2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  PIC_LIST, PicName, KpiRow, KpiUnit,
  listIndicators, listActuals, listMonthlyTargets,
  upsertActual, upsertMonthlyTarget, buildKpiRows, fmtKpiValue,
  syncKpiFromOrders,
} from "@/lib/kpi";

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
function currentMonth() { return new Date().toISOString().slice(0, 7); }
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTHS_ID[Number(mo) - 1] ?? mo} ${y}`;
}

function capaianColor(pct: number) {
  if (pct >= 100) return "text-green-400";
  if (pct >= 75)  return "text-brand";
  if (pct >= 50)  return "text-yellow-400";
  return "text-red-400";
}

function ProgressBar({ pct }: { pct: number }) {
  const clamp = Math.min(pct, 100);
  const color = pct >= 100 ? "bg-green-500" : pct >= 75 ? "bg-brand" : pct >= 50 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamp}%` }} />
    </div>
  );
}

function ActualInput({ row, onSave }: { row: KpiRow; onSave: (id: string, val: number) => Promise<void> }) {
  const [val, setVal] = useState(String(row.actual_value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setVal(String(row.actual_value)); }, [row.actual_value]);

  async function commit() {
    const n = parseFloat(val) || 0;
    setSaving(true);
    await onSave(row.id, n);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex items-center gap-1">
      <input type="number" value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        placeholder={row.unit === "currency" ? "misal: 150000000" : row.unit === "percent" ? "0–100" : "0"}
        className="w-32 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand"
      />
      {saving ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
               : saved ? <span className="text-xs text-green-400">✓</span>
               : null}
    </div>
  );
}

function TargetEdit({ row, month, onSave, onCancel }: {
  row: KpiRow;
  month: string;
  onSave: (id: string, month: string, val: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(String(row.effective_target));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const n = parseFloat(val) || 0;
    setSaving(true);
    await onSave(row.id, month, n);
    setSaving(false);
  }

  return (
    <div className="flex items-center gap-1">
      <input type="number" value={val} autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
        className="w-36 px-2 py-1 text-sm bg-slate-600 border border-brand rounded text-white focus:outline-none"
      />
      {saving
        ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
        : <>
            <button onClick={commit} className="text-green-400 hover:text-green-300"><Check size={14}/></button>
            <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={14}/></button>
          </>}
    </div>
  );
}

export default function KpiTimPanel() {
  const { profile } = useAuth();
  const [pic, setPic] = useState<PicName>("Rona");
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const indicators = await listIndicators(pic);
    const ids = indicators.map((i) => i.id);
    const [actuals, monthlyTargets] = await Promise.all([
      listActuals(ids, month),
      listMonthlyTargets(ids, month),
    ]);
    setRows(buildKpiRows(indicators, actuals, monthlyTargets));
    setLoading(false);
  }, [pic, month]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveActual(indicatorId: string, val: number) {
    await upsertActual(indicatorId, month, val, profile?.id ?? null);
    await load();
  }

  async function handleSaveTarget(indicatorId: string, targetMonth: string, val: number) {
    await upsertMonthlyTarget(indicatorId, targetMonth, val, profile?.id ?? null);
    setEditingTargetId(null);
    await load();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    const indicators = await listIndicators(pic);
    const autoInds = indicators.filter((i) => i.source_field);
    if (!autoInds.length) { setSyncMsg("Tidak ada indikator auto untuk " + pic); setSyncing(false); return; }
    const { revenue, kombo } = await syncKpiFromOrders(pic, month, autoInds, profile?.id ?? null);
    await load();
    setSyncing(false);
    const parts: string[] = [];
    if (autoInds.some((i) => i.source_field === "revenue"))
      parts.push(`Revenue: Rp ${(revenue / 1_000_000).toFixed(1)}jt`);
    if (autoInds.some((i) => i.source_field === "kombo_total"))
      parts.push(`Kombo: ${kombo}`);
    setSyncMsg("Disync: " + parts.join(" · "));
    setTimeout(() => setSyncMsg(null), 4000);
  }

  const proses = rows.filter((r) => r.category === "proses");
  const hasil  = rows.filter((r) => r.category === "hasil");
  const totalNilai = rows.reduce((s, r) => s + r.nilai_akhir, 0);
  const totalBobot = rows.reduce((s, r) => s + r.bobot, 0);
  const totalPct = totalBobot > 0 ? (totalNilai / totalBobot) * 100 : 0;
  const hasAutoIndicators = rows.some((r) => r.source_field);

  return (
    <div className="p-6 space-y-6 max-w-4xl overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
            <Award className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">KPI Tim</h1>
            <p className="text-sm text-slate-400">Target disimpan per bulan · klik ✏️ untuk ubah target bulan ini</p>
          </div>
        </div>
        {hasAutoIndicators && (
          <div className="flex flex-col items-end gap-1">
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-sm text-white font-medium transition-all disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync…" : "Sync dari Orderan"}
            </button>
            {syncMsg && <p className="text-xs text-green-400">{syncMsg}</p>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl">
          {PIC_LIST.map((p) => (
            <button key={p} onClick={() => setPic(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pic === p ? "bg-brand text-black" : "text-slate-400 hover:text-white"
              }`}>
              {p}
            </button>
          ))}
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand" />
      </div>

      {/* Score Card */}
      <div className="bg-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-2">
          <p className="text-slate-400 text-sm">Total Nilai KPI — {pic} · {monthLabel(month)}</p>
          <p className="text-4xl font-bold text-white">
            {totalNilai.toFixed(1)}
            <span className="text-xl text-slate-400 font-normal"> / {totalBobot.toFixed(0)}</span>
          </p>
          <ProgressBar pct={totalPct} />
        </div>
        <div className={`text-5xl font-bold ${capaianColor(totalPct)}`}>{totalPct.toFixed(0)}%</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat KPI…
        </div>
      ) : (
        <div className="space-y-6">
          {[{ label: "PROSES", data: proses }, { label: "HASIL", data: hasil }].map(({ label, data }) =>
            data.length === 0 ? null : (
              <div key={label} className="bg-slate-800/60 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand" />
                  <span className="text-sm font-semibold text-slate-300 tracking-wider">{label}</span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {data.map((row) => (
                    <div key={row.id} className="px-5 py-4 grid grid-cols-[1fr_auto] gap-4 items-start">
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{row.name}</span>
                          <span className="text-xs text-slate-500">bobot {row.bobot}%</span>
                          {row.source_field && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">AUTO</span>
                          )}
                        </div>

                        {/* Target row — per bulan */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                          <span>Target {monthLabel(month)}:</span>
                          {editingTargetId === row.id ? (
                            <TargetEdit row={row} month={month} onSave={handleSaveTarget} onCancel={() => setEditingTargetId(null)} />
                          ) : (
                            <span className="flex items-center gap-1">
                              <b className="text-slate-300">{fmtKpiValue(row.effective_target, row.unit as KpiUnit)}</b>
                              <button onClick={() => setEditingTargetId(row.id)} title="Ubah target bulan ini"
                                className="text-slate-600 hover:text-brand ml-0.5">
                                <Pencil size={11} />
                              </button>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                          <span>Aktual: <b className={capaianColor(row.capaian_pct)}>{fmtKpiValue(row.actual_value, row.unit as KpiUnit)}</b></span>
                          <span>Capaian: <b className={capaianColor(row.capaian_pct)}>{row.capaian_pct.toFixed(0)}%</b></span>
                          <span>Nilai: <b className="text-slate-300">{row.nilai_akhir.toFixed(1)}</b></span>
                        </div>
                        <ProgressBar pct={row.capaian_pct} />
                      </div>

                      <div className="relative">
                        <ActualInput row={row} onSave={handleSaveActual} />
                        {row.source_field && (
                          <p className="text-[10px] text-slate-500 mt-0.5 text-right">dari orderan</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
