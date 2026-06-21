"use client";

import { useEffect, useState, useCallback } from "react";
import { PackagePlus, Plus, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Product, MpStatus, MP_STATUS_NEXT, MP_STATUS_LABEL,
  listProducts, addProduct, updateProduct, deleteProduct,
} from "@/lib/products";

const MARKETPLACES: { key: "status_shopee" | "status_tokopedia" | "status_tiktok"; label: string }[] = [
  { key: "status_shopee", label: "Shopee" },
  { key: "status_tokopedia", label: "Tokopedia" },
  { key: "status_tiktok", label: "TikTok" },
];

const STATUS_STYLE: Record<MpStatus, string> = {
  pending: "bg-slate-100 text-slate-500 border-slate-200",
  process: "bg-warning-light text-warning border-warning/30",
  done: "bg-success-light text-success border-success/30",
};

export default function NewProductPanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listProducts());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const doneCount = rows.filter((r) => r.status_shopee === "done" && r.status_tokopedia === "done" && r.status_tiktok === "done").length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Isi nama produk dulu."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addProduct({ name: name.trim(), note: note.trim() || null, created_by: profile?.id ?? null });
    setBusy(false);
    if (error) { setError(error); return; }
    setName(""); setNote("");
    load();
  }

  async function cycleStatus(row: Product, key: "status_shopee" | "status_tokopedia" | "status_tiktok") {
    if (!canEdit) return;
    const next = MP_STATUS_NEXT[row[key]];
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [key]: next } : r)));
    const { error } = await updateProduct(row.id, { [key]: next });
    if (error) { setError(error); load(); }
  }

  async function handleDelete(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteProduct(id);
    if (error) { setError(error); load(); }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-4xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <PackagePlus size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">New Product</h1>
            <p className="text-sm text-slate-500 mt-1">Catat produk baru & pantau status uploadnya. Klik status buat ganti: Belum → Proses → Live.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {canEdit && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
            <div className="flex flex-col md:flex-row gap-2.5">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama produk baru" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <button type="submit" disabled={busy} className="btn-bounce px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
              </button>
            </div>
          </form>
        )}

        {!loading && rows.length > 0 && (
          <p className="text-xs text-slate-400 mb-3">Total {rows.length} produk · {doneCount} sudah live di semua marketplace</p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada produk. {canEdit ? "Tambah di atas." : ""}</p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((row) => (
              <div key={row.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                  {row.note && <p className="text-xs text-slate-400 truncate">{row.note}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  {MARKETPLACES.map((mp) => {
                    const status = row[mp.key];
                    return (
                      <button
                        key={mp.key}
                        onClick={() => cycleStatus(row, mp.key)}
                        disabled={!canEdit}
                        title={`${mp.label}: ${MP_STATUS_LABEL[status]}`}
                        className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${STATUS_STYLE[status]} ${canEdit ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {mp.label}: {MP_STATUS_LABEL[status]}
                      </button>
                    );
                  })}
                  {canEdit && (
                    <button onClick={() => handleDelete(row.id)} className="text-slate-300 hover:text-danger ml-1">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
