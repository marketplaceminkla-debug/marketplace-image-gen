"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ListChecks, Plus, Loader2, Trash2, Check, Target, Lightbulb, Pin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  TalItem, TalCategory, listTalItems, addTalItem, updateTalItem, deleteTalItem,
  currentMonth, monthLabel,
} from "@/lib/tal";

const CATEGORY = {
  target: { label: "Target", icon: Target, style: "bg-brand-light text-brand-hover border-brand-muted" },
  strategi: { label: "Strategi", icon: Lightbulb, style: "bg-kla-purpleLight text-kla-purple border-kla-purple/20" },
  lainnya: { label: "Lainnya", icon: Pin, style: "bg-slate-100 text-slate-500 border-slate-200" },
} as const;

export default function TalPanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [items, setItems] = useState<TalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth());

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TalCategory>("target");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await listTalItems());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Month chips: every month that has items, plus the current month.
  const months = useMemo(() => {
    const set = new Set(items.map((i) => i.month));
    set.add(currentMonth());
    set.add(month);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [items, month]);

  const monthItems = useMemo(() => items.filter((i) => i.month === month), [items, month]);
  const doneCount = monthItems.filter((i) => i.is_done).length;
  const pct = monthItems.length > 0 ? (doneCount / monthItems.length) * 100 : 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Isi dulu apa yang mau dicapai."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addTalItem({ month, title: title.trim(), category, created_by: profile?.id ?? null });
    setBusy(false);
    if (error) { setError(error); return; }
    setTitle("");
    load();
  }

  async function toggle(item: TalItem) {
    if (!canEdit) return;
    setItems((rs) => rs.map((r) => (r.id === item.id ? { ...r, is_done: !r.is_done } : r)));
    const { error } = await updateTalItem(item.id, { is_done: !item.is_done });
    if (error) { setError(error); load(); }
  }

  async function handleDelete(id: string) {
    setItems((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteTalItem(id);
    if (error) { setError(error); load(); }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-3xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <ListChecks size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">TAL — To Achieve List</h1>
            <p className="text-sm text-slate-500 mt-1">Target & strategi tim tiap bulan, lengkap dengan progress.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Month selector */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setMonth(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                m === month ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {monthLabel(m)}
            </button>
          ))}
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="px-2 py-1.5 rounded-full text-xs border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-brand"
            title="Pilih / tambah bulan lain"
          />
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-slate-700">Progress {monthLabel(month)}</span>
            <span className="text-sm font-bold text-brand-hover">{doneCount}/{monthItems.length} · {pct.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="progress-bar-fill h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Add form */}
        {canEdit && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
            <div className="flex flex-col md:flex-row gap-2.5">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Apa yang mau dicapai di ${monthLabel(month)}?`} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <select value={category} onChange={(e) => setCategory(e.target.value as TalCategory)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand">
                <option value="target">🎯 Target</option>
                <option value="strategi">💡 Strategi</option>
                <option value="lainnya">📌 Lainnya</option>
              </select>
              <button type="submit" disabled={busy} className="btn-bounce px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : monthItems.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada TAL untuk {monthLabel(month)}. {canEdit ? "Tambah di atas." : ""}</p>
        ) : (
          <div className="space-y-2">
            {monthItems.map((item) => {
              const cat = CATEGORY[item.category];
              const CatIcon = cat.icon;
              return (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center gap-3">
                  <button
                    onClick={() => toggle(item)}
                    disabled={!canEdit}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      item.is_done ? "bg-success border-success text-white" : "bg-white border-slate-300"
                    } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {item.is_done && <Check size={15} />}
                  </button>
                  <p className={`flex-1 text-sm ${item.is_done ? "text-slate-400 line-through" : "text-slate-800"}`}>{item.title}</p>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border shrink-0 ${cat.style}`}>
                    <CatIcon size={11} /> {cat.label}
                  </span>
                  {canEdit && (
                    <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-danger shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
