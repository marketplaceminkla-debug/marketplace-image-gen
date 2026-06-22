"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Loader2, Trash2, Pencil, Check, X, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Warehouse, listWarehouses, addWarehouse, updateWarehouse, deleteWarehouse, normalizeWa } from "@/lib/warehouse";

export default function WarehouseDbPanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eWa, setEWa] = useState("");
  const [eNote, setENote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listWarehouses());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Isi nama gudang dulu."); return; }
    if (!normalizeWa(wa)) { setError("Isi nomor WA yang valid."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addWarehouse({ name: name.trim(), wa_number: wa.trim(), note: note.trim() || null });
    setBusy(false);
    if (error) { setError(error); return; }
    setName(""); setWa(""); setNote("");
    load();
  }

  function startEdit(w: Warehouse) {
    setEditId(w.id); setEName(w.name); setEWa(w.wa_number); setENote(w.note ?? "");
  }
  async function saveEdit(id: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name: eName, wa_number: eWa, note: eNote || null } : r)));
    setEditId(null);
    const { error } = await updateWarehouse(id, { name: eName.trim(), wa_number: eWa.trim(), note: eNote.trim() || null });
    if (error) { setError(error); load(); }
  }
  async function handleDelete(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteWarehouse(id);
    if (error) { setError(error); load(); }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-3xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Building2 size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Database Gudang</h1>
            <p className="text-sm text-slate-500 mt-1">Daftar nomor WA tiap gudang/cabang. Dipakai tombol Kirim WA di Orderan.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {canEdit && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama gudang (cth: Cirebon)" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <input value={wa} onChange={(e) => setWa(e.target.value)} placeholder="Nomor WA (cth: 0812...)" inputMode="tel" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
            </div>
            <button type="submit" disabled={busy} className="btn-bounce mt-2.5 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah Gudang
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada gudang. {canEdit ? "Tambah di atas." : ""}</p>
        ) : (
          <div className="space-y-2.5">
            {rows.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                {editId === w.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <input value={eName} onChange={(e) => setEName(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    <input value={eWa} onChange={(e) => setEWa(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                    <div className="flex items-center gap-1.5">
                      <input value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Catatan" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900" />
                      <button onClick={() => saveEdit(w.id)} className="w-8 h-8 rounded-lg bg-success-light text-success flex items-center justify-center shrink-0"><Check size={15} /></button>
                      <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><X size={15} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{w.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={11} /> {w.wa_number} <span className="text-slate-300">→ wa.me/{normalizeWa(w.wa_number)}</span></p>
                      {w.note && <p className="text-xs text-slate-400 truncate mt-0.5">{w.note}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => startEdit(w)} className="text-slate-300 hover:text-brand-hover"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(w.id)} className="text-slate-300 hover:text-danger"><Trash2 size={15} /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
