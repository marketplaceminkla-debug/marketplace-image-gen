"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { TrendingUp, Target, Plus, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { RevenueEntry, listEntries, getTarget, setTarget as saveTarget, addEntry, deleteEntry, formatIDR, formatShort } from "@/lib/revenue";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function RevenuePanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [target, setTargetState] = useState(0);
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // forms
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, e] = await Promise.all([getTarget(), listEntries()]);
      setTargetState(t);
      setEntries(e);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);
  const pct = target > 0 ? Math.min(100, (total / target) * 100) : 0;

  // Aggregate by date for the mini bar chart (last 14 days with data).
  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.entry_date, (map.get(e.entry_date) ?? 0) + e.amount);
    const days = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
    const max = Math.max(1, ...days.map((d) => d[1]));
    return { days, max };
  }, [entries]);

  async function handleSaveTarget() {
    const val = Number(targetInput.replace(/[^\d]/g, ""));
    setBusy(true);
    const { error } = await saveTarget(val);
    setBusy(false);
    if (error) { setError(error); return; }
    setTargetState(val);
    setEditingTarget(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(amount.replace(/[^\d]/g, ""));
    if (!val) { setError("Isi jumlah revenue dulu."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addEntry({ entry_date: date, amount: val, note: note.trim() || null, created_by: profile?.id ?? null });
    setBusy(false);
    if (error) { setError(error); return; }
    setAmount("");
    setNote("");
    setDate(todayISO());
    load();
  }

  async function handleDelete(id: string) {
    setEntries((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteEntry(id);
    if (error) { setError(error); load(); }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <TrendingUp size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Revenue</h1>
            <p className="text-sm text-slate-500 mt-1">Pantau pencapaian revenue terhadap target.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat data…
          </div>
        ) : (
          <>
            {/* Progress card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Revenue</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{formatIDR(total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 justify-end">
                    <Target size={12} /> Target
                  </p>
                  {editingTarget ? (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        autoFocus
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        placeholder="0"
                        inputMode="numeric"
                        className="w-36 text-right px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand"
                      />
                      <button onClick={handleSaveTarget} disabled={busy} className="w-7 h-7 rounded-lg bg-success-light text-success flex items-center justify-center"><Check size={14} /></button>
                      <button onClick={() => setEditingTarget(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1 justify-end">
                      <p className="text-xl font-bold text-slate-700">{formatIDR(target)}</p>
                      {canEdit && (
                        <button onClick={() => { setTargetInput(String(target || "")); setEditingTarget(true); }} className="text-slate-400 hover:text-brand-hover">
                          <Pencil size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-500">Pencapaian target</span>
                  <span className="text-sm font-bold text-brand-hover">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden relative">
                  <div className="progress-bar-fill h-full rounded-full bg-brand relative" style={{ width: `${pct}%` }} />
                </div>
                {target > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Sisa ke target: {formatIDR(Math.max(0, target - total))}
                  </p>
                )}
              </div>
            </div>

            {/* Chart + Add form */}
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {/* Mini bar chart */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Tren harian (terbaru)</p>
                {chart.days.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">Belum ada data. Tambah revenue harian dulu.</p>
                ) : (
                  <div className="flex items-end gap-1.5 h-32">
                    {chart.days.map(([d, v]) => (
                      <div key={d} className="flex-1 flex flex-col items-center gap-1 group" title={`${d}: ${formatIDR(v)}`}>
                        <div className="w-full rounded-t bg-brand-muted group-hover:bg-brand transition-colors" style={{ height: `${Math.max(4, (v / chart.max) * 100)}%` }} />
                        <span className="text-[8px] text-slate-400">{d.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add entry */}
              {canEdit ? (
                <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Tambah revenue harian</p>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[11px] text-slate-500">Tanggal</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500">Jumlah (Rp)</label>
                      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="contoh: 1500000" inputMode="numeric" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500">Catatan (opsional)</label>
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="misal: dari Shopee" className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
                    </div>
                    <button type="submit" disabled={busy} className="btn-bounce w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                      {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-center text-center">
                  <p className="text-sm text-slate-400">Cuma Admin / Super Admin yang bisa input revenue.</p>
                </div>
              )}
            </div>

            {/* Recent entries */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mt-4 overflow-hidden">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-5 pt-4 pb-2">Riwayat input ({entries.length})</p>
              {entries.length === 0 ? (
                <p className="text-sm text-slate-400 px-5 pb-5">Belum ada riwayat.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {entries.slice(0, 30).map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{formatIDR(e.amount)}</p>
                        <p className="text-xs text-slate-400 truncate">{e.entry_date}{e.note ? ` · ${e.note}` : ""}</p>
                      </div>
                      {canEdit && (
                        <button onClick={() => handleDelete(e.id)} className="text-slate-300 hover:text-danger shrink-0">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
