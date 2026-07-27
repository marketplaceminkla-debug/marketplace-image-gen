"use client";

import { useEffect, useState, useCallback } from "react";
import { Award, TrendingUp, Loader2, Pencil, Check, X, RefreshCw, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  PIC_LIST, PicName, KpiRow, KpiUnit, KpiCategory,
  listIndicators, listActuals, listMonthlyTargets,
  upsertActual, upsertMonthlyTarget, buildKpiRows, fmtKpiValue,
  syncKpiFromOrders, updateIndicatorName, addIndicator, deleteIndicator,
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
  const c = pct >= 100 ? "bg-green-500" : pct >= 75 ? "bg-brand" : pct >= 50 ? "bg-yellow-400" : "bg-red-500";
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${c}`} style={{ width: `${Math.min(pct,100)}%` }} />
    </div>
  );
}

// ── Inline actual input ──
function ActualInput({ row, onSave }: { row: KpiRow; onSave: (id: string, val: number) => Promise<void> }) {
  const [val, setVal] = useState(String(row.actual_value));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setVal(String(row.actual_value)); }, [row.actual_value]);
  async function commit() {
    const n = parseFloat(val) || 0;
    setSaving(true); await onSave(row.id, n); setSaving(false);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  return (
    <div className="flex items-center gap-1">
      <input type="number" value={val} onChange={(e) => setVal(e.target.value)}
        onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()}
        placeholder={row.unit === "currency" ? "e.g. 150000000" : "0"}
        className="w-28 px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand" />
      {saving ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
               : saved ? <span className="text-xs text-green-400">✓</span> : null}
    </div>
  );
}

// ── Inline text edit helper ──
function InlineEdit({ value, onSave, onCancel, className }: {
  value: string; onSave: (v: string) => Promise<void>; onCancel: () => void; className?: string;
}) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  async function commit() {
    if (!val.trim()) return;
    setSaving(true); await onSave(val.trim()); setSaving(false);
  }
  return (
    <div className="flex items-center gap-1 flex-1">
      <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
        className={`flex-1 px-2 py-0.5 bg-slate-700 border border-brand rounded text-white text-sm focus:outline-none ${className}`} />
      {saving ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
               : <>
                   <button onClick={commit} className="text-green-400 hover:text-green-300"><Check size={13}/></button>
                   <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={13}/></button>
                 </>}
    </div>
  );
}

// ── Add indicator form ──
function AddIndicatorRow({ pic, category, sortOrder, onAdded }: {
  pic: PicName; category: KpiCategory; sortOrder: number; onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<KpiUnit>("number");
  const [target, setTarget] = useState("");
  const [bobot, setBobot] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  async function submit() {
    if (!name.trim()) { setErr("Nama indikator wajib diisi"); return; }
    setSaving(true); setErr(null);
    const { error } = await addIndicator({
      pic_name: pic, category, name: name.trim(),
      target_value: parseFloat(target) || 0,
      unit, bobot: parseFloat(bobot) || 0,
      sort_order: sortOrder,
    });
    setSaving(false);
    if (error) { setErr(error); return; }
    setOpen(false); setName(""); setTarget(""); setBobot("");
    onAdded();
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand px-5 py-3 w-full transition-colors">
      <Plus size={13}/> Tambah indikator {category}
    </button>
  );

  return (
    <div className="px-5 py-4 bg-slate-900 border-t border-slate-700 space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Indikator baru — {category}</p>
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama indikator"
          className="col-span-2 px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand" />
        <select value={unit} onChange={(e) => setUnit(e.target.value as KpiUnit)}
          className="px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-brand">
          <option value="number">Angka</option>
          <option value="percent">Persen (%)</option>
          <option value="currency">Rupiah (Rp)</option>
        </select>
        <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target"
          className="px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand" />
        <input type="number" value={bobot} onChange={(e) => setBobot(e.target.value)} placeholder="Bobot % (mis. 10)"
          className="px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand" />
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={saving}
          className="px-4 py-1.5 rounded-lg bg-brand text-black text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60">
          {saving ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>} Simpan
        </button>
        <button onClick={() => setOpen(false)} className="px-4 py-1.5 rounded-lg border border-slate-600 text-slate-400 text-sm hover:bg-slate-800">
          Batal
        </button>
      </div>
    </div>
  );
}

// ── Target edit (per bulan) ──
function TargetEdit({ row, month, onSave, onCancel }: {
  row: KpiRow; month: string;
  onSave: (id: string, month: string, val: number) => Promise<void>; onCancel: () => void;
}) {
  const [val, setVal] = useState(String(row.effective_target));
  const [saving, setSaving] = useState(false);
  async function commit() {
    setSaving(true); await onSave(row.id, month, parseFloat(val) || 0); setSaving(false);
  }
  return (
    <div className="flex items-center gap-1">
      <input type="number" value={val} autoFocus onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel(); }}
        className="w-32 px-2 py-1 text-sm bg-slate-600 border border-brand rounded text-white focus:outline-none" />
      {saving ? <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin"/>
               : <><button onClick={commit} className="text-green-400 hover:text-green-300"><Check size={14}/></button>
                   <button onClick={onCancel} className="text-slate-400 hover:text-white"><X size={14}/></button></>}
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
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const indicators = await listIndicators(pic);
    const ids = indicators.map((i) => i.id);

    // Auto-sync indikator AUTO dari orderan sebelum render
    const autoInds = indicators.filter((i) => i.source_field);
    if (autoInds.length) {
      await syncKpiFromOrders(pic, month, autoInds, profile?.id ?? null);
    }

    const [actuals, monthlyTargets] = await Promise.all([listActuals(ids, month), listMonthlyTargets(ids, month)]);
    setRows(buildKpiRows(indicators, actuals, monthlyTargets));
    setLoading(false);
  }, [pic, month, profile?.id]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveActual(id: string, val: number) {
    await upsertActual(id, month, val, profile?.id ?? null); await load();
  }
  async function handleSaveTarget(id: string, m: string, val: number) {
    await upsertMonthlyTarget(id, m, val, profile?.id ?? null); setEditingTargetId(null); await load();
  }
  async function handleSaveName(id: string, name: string) {
    await updateIndicatorName(id, name); setEditingNameId(null); await load();
  }
  async function handleDelete(id: string) {
    setDeletingId(null); await deleteIndicator(id); await load();
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null);
    const indicators = await listIndicators(pic);
    const autoInds = indicators.filter((i) => i.source_field);
    if (!autoInds.length) { setSyncMsg("Tidak ada indikator auto untuk " + pic); setSyncing(false); return; }
    const { revenue, kombo } = await syncKpiFromOrders(pic, month, autoInds, profile?.id ?? null);
    await load(); setSyncing(false);
    const parts: string[] = [];
    if (autoInds.some((i) => i.source_field === "revenue")) parts.push(`Revenue: Rp ${(revenue/1_000_000).toFixed(1)}jt`);
    if (autoInds.some((i) => i.source_field === "kombo_total")) parts.push(`Kombo: ${kombo}`);
    setSyncMsg("Disync: " + parts.join(" · "));
    setTimeout(() => setSyncMsg(null), 4000);
  }

  const proses = rows.filter((r) => r.category === "proses");
  const hasil  = rows.filter((r) => r.category === "hasil");
  const totalNilai = rows.reduce((s, r) => s + r.nilai_akhir, 0);
  const totalBobot = rows.reduce((s, r) => s + r.bobot, 0);
  const totalPct = totalBobot > 0 ? (totalNilai / totalBobot) * 100 : 0;

  function renderSection(label: string, data: KpiRow[], category: KpiCategory) {
    return (
      <div className="bg-slate-800/60 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold text-slate-300 tracking-wider">{label}</span>
        </div>
        <div className="divide-y divide-slate-700/50">
          {data.map((row) => (
            <div key={row.id} className="px-5 py-4 group">
              <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                {/* Left */}
                <div className="space-y-2 min-w-0">

                  {/* Name row — click pencil to rename */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {editingNameId === row.id ? (
                      <InlineEdit value={row.name}
                        onSave={(v) => handleSaveName(row.id, v)}
                        onCancel={() => setEditingNameId(null)} />
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-white">{row.name}</span>
                        <button onClick={() => setEditingNameId(row.id)}
                          title="Rename indikator"
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-brand transition-opacity">
                          <Pencil size={11}/>
                        </button>
                        <span className="text-xs text-slate-500">bobot {row.bobot}%</span>
                        {row.source_field && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">AUTO</span>
                        )}
                        {/* Delete confirm */}
                        {deletingId === row.id ? (
                          <span className="flex items-center gap-1 text-[11px] text-red-400">
                            Hapus?
                            <button onClick={() => handleDelete(row.id)} className="underline">Ya</button>
                            <button onClick={() => setDeletingId(null)} className="text-slate-400 underline">Batal</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingId(row.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-opacity ml-1">
                            <Trash2 size={11}/>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Target row */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                    <span>Target {monthLabel(month)}:</span>
                    {editingTargetId === row.id ? (
                      <TargetEdit row={row} month={month} onSave={handleSaveTarget} onCancel={() => setEditingTargetId(null)} />
                    ) : (
                      <span className="flex items-center gap-1">
                        <b className="text-slate-300">{fmtKpiValue(row.effective_target, row.unit as KpiUnit)}</b>
                        <button onClick={() => setEditingTargetId(row.id)} title="Ubah target bulan ini"
                          className="text-slate-600 hover:text-brand ml-0.5"><Pencil size={11}/></button>
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

                {/* Right: actual input */}
                <div>
                  <ActualInput row={row} onSave={handleSaveActual} />
                  {row.source_field && <p className="text-[10px] text-slate-500 mt-0.5 text-right">dari orderan</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add new indicator */}
        <AddIndicatorRow pic={pic} category={category} sortOrder={data.length + 1} onAdded={load} />
      </div>
    );
  }

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
            <p className="text-sm text-slate-400">Hover indikator untuk rename ✏️ atau hapus · target disimpan per bulan</p>
          </div>
        </div>
        <button onClick={() => load()} disabled={loading}
          title="Refresh data dari orderan"
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white transition-all disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 p-1 bg-slate-800 rounded-xl">
          {PIC_LIST.map((p) => (
            <button key={p} onClick={() => setPic(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pic === p ? "bg-brand text-black" : "text-slate-400 hover:text-white"
              }`}>{p}</button>
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
            {totalNilai.toFixed(1)}<span className="text-xl text-slate-400 font-normal"> / {totalBobot.toFixed(0)}</span>
          </p>
          <ProgressBar pct={totalPct} />
        </div>
        <div className={`text-5xl font-bold ${capaianColor(totalPct)}`}>{totalPct.toFixed(0)}%</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</div>
      ) : (
        <div className="space-y-6">
          {proses.length > 0 || true ? renderSection("PROSES", proses, "proses") : null}
          {hasil.length > 0  || true ? renderSection("HASIL",  hasil,  "hasil")  : null}
        </div>
      )}
    </div>
  );
}
