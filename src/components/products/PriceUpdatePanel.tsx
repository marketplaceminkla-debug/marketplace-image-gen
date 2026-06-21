"use client";

import { useEffect, useState, useCallback } from "react";
import { Tag, Plus, Loader2, Trash2, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/revenue";
import { PriceUpdate, listPriceUpdates, addPriceUpdate, deletePriceUpdate } from "@/lib/products";

export default function PriceUpdatePanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [rows, setRows] = useState<PriceUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listPriceUpdates());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const np = Number(newPrice.replace(/[^\d]/g, ""));
    const op = Number(oldPrice.replace(/[^\d]/g, ""));
    if (!name.trim()) { setError("Isi nama produk dulu."); return; }
    if (!np) { setError("Isi harga baru dulu."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addPriceUpdate({ product_name: name.trim(), old_price: op, new_price: np, note: note.trim() || null, created_by: profile?.id ?? null });
    setBusy(false);
    if (error) { setError(error); return; }
    setName(""); setOldPrice(""); setNewPrice(""); setNote("");
    load();
  }

  async function handleDelete(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deletePriceUpdate(id);
    if (error) { setError(error); load(); }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-4xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Tag size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Update Harga</h1>
            <p className="text-sm text-slate-500 mt-1">Catat perubahan harga produk biar tim selalu update.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {canEdit && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4 space-y-2.5">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama produk" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
            <div className="grid grid-cols-2 gap-2.5">
              <input value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} placeholder="Harga lama (Rp)" inputMode="numeric" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Harga baru (Rp)" inputMode="numeric" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
            </div>
            <div className="flex gap-2.5">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (misal: restock)" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <button type="submit" disabled={busy} className="btn-bounce px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Catat
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada riwayat perubahan harga.</p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => {
              const up = row.new_price > row.old_price;
              const flat = row.new_price === row.old_price || !row.old_price;
              return (
                <div key={row.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{row.product_name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {!!row.old_price && <span className="text-xs text-slate-400 line-through">{formatIDR(row.old_price)}</span>}
                      <span className={`inline-flex items-center gap-0.5 text-sm font-semibold ${flat ? "text-slate-700" : up ? "text-danger" : "text-success"}`}>
                        {flat ? <ArrowRight size={12} /> : up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {formatIDR(row.new_price)}
                      </span>
                      <span className="text-[11px] text-slate-400">{row.created_at.slice(0, 10)}{row.note ? ` · ${row.note}` : ""}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => handleDelete(row.id)} className="text-slate-300 hover:text-danger shrink-0">
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
