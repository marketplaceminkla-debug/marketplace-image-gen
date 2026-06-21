"use client";

import { useEffect, useState, useCallback } from "react";
import { Percent, Plus, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatIDR } from "@/lib/revenue";
import { Fee, listFees, addFee, updateFee, deleteFee } from "@/lib/products";

const MARKETPLACES = ["Shopee", "Tokopedia", "TikTok Shop", "Lazada", "Lainnya"];

function fmtValue(f: Fee): string {
  return f.unit === "%" ? `${f.value}%` : formatIDR(f.value);
}

export default function FeeDatabasePanel() {
  const { profile } = useAuth();
  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";

  const [rows, setRows] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // add form
  const [marketplace, setMarketplace] = useState("Shopee");
  const [feeName, setFeeName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"%" | "Rp">("%");
  const [busy, setBusy] = useState(false);

  // inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUnit, setEditUnit] = useState<"%" | "Rp">("%");

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await listFees());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!feeName.trim()) { setError("Isi nama fee dulu."); return; }
    const val = Number(value.replace(/[^\d.]/g, ""));
    setBusy(true);
    setError(null);
    const { error } = await addFee({ marketplace, fee_name: feeName.trim(), value: val, unit, note: null });
    setBusy(false);
    if (error) { setError(error); return; }
    setFeeName(""); setValue("");
    load();
  }

  function startEdit(f: Fee) {
    setEditId(f.id);
    setEditValue(String(f.value));
    setEditUnit(f.unit);
  }

  async function saveEdit(id: string) {
    const val = Number(editValue.replace(/[^\d.]/g, ""));
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, value: val, unit: editUnit } : r)));
    setEditId(null);
    const { error } = await updateFee(id, { value: val, unit: editUnit });
    if (error) { setError(error); load(); }
  }

  async function handleDelete(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteFee(id);
    if (error) { setError(error); load(); }
  }

  // group by marketplace
  const grouped = rows.reduce<Record<string, Fee[]>>((acc, f) => {
    (acc[f.marketplace] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-4xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Percent size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Database Fee Marketplace</h1>
            <p className="text-sm text-slate-500 mt-1">Referensi fee tiap marketplace. Update kalau kebijakan berubah.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {canEdit && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand">
                {MARKETPLACES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={feeName} onChange={(e) => setFeeName(e.target.value)} placeholder="Nama fee (cth: Admin)" className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
              <div className="flex gap-1.5">
                <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" inputMode="decimal" className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
                <select value={unit} onChange={(e) => setUnit(e.target.value as "%" | "Rp")} className="px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand">
                  <option value="%">%</option>
                  <option value="Rp">Rp</option>
                </select>
              </div>
              <button type="submit" disabled={busy} className="btn-bounce px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">Belum ada data fee. {canEdit ? "Tambah di atas." : ""}</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([mp, fees]) => (
              <div key={mp}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{mp}</p>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                  {fees.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                      <p className="flex-1 text-sm text-slate-700 truncate">{f.fee_name}</p>
                      {editId === f.id ? (
                        <div className="flex items-center gap-1.5">
                          <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} inputMode="decimal" className="w-20 text-right px-2 py-1 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand" />
                          <select value={editUnit} onChange={(e) => setEditUnit(e.target.value as "%" | "Rp")} className="px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-sm text-slate-900">
                            <option value="%">%</option>
                            <option value="Rp">Rp</option>
                          </select>
                          <button onClick={() => saveEdit(f.id)} className="w-7 h-7 rounded-lg bg-success-light text-success flex items-center justify-center"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{fmtValue(f)}</span>
                          {canEdit && (
                            <>
                              <button onClick={() => startEdit(f)} className="text-slate-300 hover:text-brand-hover"><Pencil size={14} /></button>
                              <button onClick={() => handleDelete(f.id)} className="text-slate-300 hover:text-danger"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
