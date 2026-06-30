"use client";

import { useEffect, useState, useCallback } from "react";
import { Award, TrendingUp, Loader2, Save } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  PIC_LIST, PicName, KpiRow, KpiUnit,
  listIndicators, listActuals, upsertActual, buildKpiRows, fmtKpiValue,
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

interface ActualInputProps {
  row: KpiRow;
  onSave: (id: string, val: number) => Promise<void>;
}

function ActualInput({ row, onSave }: ActualInputProps) {
  const [val, setVal] = useState(String(row.actual_value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setVal(String(row.actual_value)); }, [row.actual_value]);

  async function handleSave() {
    const n = parseFloat(val) || 0;
    setSaving(true);
    await onSave(row.id, n);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const placeholder = row.unit === "currency" ? "misal: 150000000" : row.unit === "percent" ? "0–100" : "0";

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder={placeholder}
        className="w-32 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand"
      />
      {saving ? (
        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
      ) : saved ? (
        <span className="text-xs text-green-400">✓</span>
      ) : null}
    </div>
  );
}

export default function KpiTimPanel() {
  const { profile } = useAuth();
  const [pic, setPic] = useState<PicName>("Rona");
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const indicators = await listIndicators(pic);
    const actuals = await listActuals(indicators.map((i) => i.id), month);
    setRows(buildKpiRows(indicators, actuals));
    setLoading(false);
  }, [pic, month]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(indicatorId: string, val: number) {
    await upsertActual(indicatorId, month, val, profile?.id ?? null);
    await load();
  }

  const proses = rows.filter((r) => r.category === "proses");
  const hasil  = rows.filter((r) => r.category === "hasil");
  const totalNilai = rows.reduce((s, r) => s + r.nilai_akhir, 0);
  const totalBobot = rows.reduce((s, r) => s + r.bobot, 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
          <Award className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">KPI Tim</h1>
          <p className="text-sm text-slate-400">Capaian KPI bulanan per anggota tim</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl">
          {PIC_LIST.map((p) => (
            <button
              key={p}
              onClick={() => setPic(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pic === p ? "bg-brand text-black" : "text-slate-400 hover:text-white"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand"
        />
      </div>

      {/* Score Card */}
      <div className="bg-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-slate-400 text-sm">Total Nilai KPI — {pic} · {monthLabel(month)}</p>
          <p className="text-4xl font-bold text-white mt-1">
            {totalNilai.toFixed(1)}
            <span className="text-xl text-slate-400 font-normal"> / {totalBobot.toFixed(0)}</span>
          </p>
          <ProgressBar pct={(totalNilai / (totalBobot || 100)) * 100} />
        </div>
        <div className={`text-5xl font-bold ${capaianColor((totalNilai / (totalBobot || 100)) * 100)}`}>
          {totalBobot > 0 ? ((totalNilai / totalBobot) * 100).toFixed(0) : 0}%
        </div>
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
                      {/* Left: indicator info */}
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{row.name}</span>
                          <span className="text-xs text-slate-500">bobot {row.bobot}%</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                          <span>Target: <b className="text-slate-300">{fmtKpiValue(row.target_value, row.unit as KpiUnit)}</b></span>
                          <span>Aktual: <b className={capaianColor(row.capaian_pct)}>{fmtKpiValue(row.actual_value, row.unit as KpiUnit)}</b></span>
                          <span>Capaian: <b className={capaianColor(row.capaian_pct)}>{row.capaian_pct.toFixed(0)}%</b></span>
                          <span>Nilai: <b className="text-slate-300">{row.nilai_akhir.toFixed(1)}</b></span>
                        </div>
                        <ProgressBar pct={row.capaian_pct} />
                      </div>

                      {/* Right: input */}
                      <ActualInput row={row} onSave={handleSave} />
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
