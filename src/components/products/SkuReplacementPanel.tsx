"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowLeftRight, ArrowRight, Plus, Loader2, Trash2, Search, Ban } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SkuReplacement, listSkuReplacements, addSkuReplacement, deleteSkuReplacement } from "@/lib/products";

const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand";

export default function SkuReplacementPanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [rows, setRows] = useState<SkuReplacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "replaced" | "eol">("all");

  // form
  const [oldSku, setOldSku] = useState("");
  const [newSku, setNewSku] = useState("");
  const [mode, setMode] = useState<"replaced" | "eol">("replaced");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listSkuReplacements());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "eol" && !r.is_eol) return false;
      if (filter === "replaced" && r.is_eol) return false;
      if (q && !(`${r.old_sku} ${r.new_sku ?? ""} ${r.note ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, query, filter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!oldSku.trim()) { setError("Isi SKU lama dulu."); return; }
    if (mode === "replaced" && !newSku.trim()) { setError("Isi SKU penggantinya, atau pilih EOL."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addSkuReplacement({
      old_sku: oldSku.trim(),
      new_sku: mode === "replaced" ? newSku.trim() : null,
      is_eol: mode === "eol",
      note: note.trim() || null,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setOldSku(""); setNewSku(""); setNote("");
    load();
  }

  async function handleDelete(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteSkuReplacement(id);
    if (error) { setError(error); load(); }
  }

  const eolCount = rows.filter((r) => r.is_eol).length;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-4xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <ArrowLeftRight size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">SKU Pengganti</h1>
            <p className="text-sm text-slate-500 mt-1">Catat seri/SKU yang discontinue & penggantinya. Yang tanpa pengganti ditandai EOL.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {canEdit && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-3 w-full md:w-80">
              {([["replaced", "Ada pengganti"], ["eol", "EOL (tanpa pengganti)"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <input value={oldSku} onChange={(e) => setOldSku(e.target.value)} placeholder="SKU lama (discontinue)" className={INPUT} />
              {mode === "replaced" ? (
                <input value={newSku} onChange={(e) => setNewSku(e.target.value)} placeholder="SKU baru (pengganti)" className={INPUT} />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-danger/30 bg-danger-light text-danger text-sm">
                  <Ban size={15} /> Ditandai EOL — tidak ada pengganti
                </div>
              )}
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className={`${INPUT} md:col-span-2`} />
            </div>
            <button type="submit" disabled={busy} className="btn-bounce mt-3 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
            </button>
          </form>
        )}

        {/* Search + filter */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari SKU…" className={`${INPUT} pl-9`} />
          </div>
          {([["all", "Semua"], ["replaced", "Ada pengganti"], ["eol", "EOL"]] as const).map(([f, label]) => {
            const count = f === "all" ? rows.length : f === "eol" ? eolCount : rows.length - eolCount;
            return (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada data SKU pengganti.</p>
        ) : (
          <div className="space-y-2.5">
            {shown.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-700 line-through decoration-slate-300">{r.old_sku}</span>
                    {r.is_eol ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger-light text-danger border border-danger/30">
                        <Ban size={11} /> EOL
                      </span>
                    ) : (
                      <>
                        <ArrowRight size={14} className="text-slate-400" />
                        <span className="text-sm font-bold text-success">{r.new_sku}</span>
                      </>
                    )}
                  </div>
                  {r.note && <p className="text-xs text-slate-400 mt-1">{r.note}</p>}
                </div>
                {canEdit && (
                  <button onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-danger shrink-0"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
