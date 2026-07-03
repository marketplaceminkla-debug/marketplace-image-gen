"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { PackageX, Plus, Loader2, Trash2, Pencil, Check, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Warehouse, listWarehouses, SO_RE, formatSo } from "@/lib/warehouse";
import {
  StockReturn, ReturnCategory, ReturnStatus,
  CATEGORY_LABEL, STATUS_LABEL,
  listStockReturns, addStockReturn, updateStockReturn, deleteStockReturn,
} from "@/lib/stockReturns";

const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand";

const CATEGORIES: ReturnCategory[] = ["tukar_unit", "refund", "refund_sebagian", "ganti_item"];
const STATUSES: ReturnStatus[] = ["new", "ship_user", "dispute", "ship_seller", "done"];

const STATUS_STYLE: Record<ReturnStatus, string> = {
  new: "bg-slate-100 text-slate-500 border-slate-200",
  ship_user: "bg-warning-light text-warning border-warning/30",
  dispute: "bg-danger-light text-danger border-danger/30",
  ship_seller: "bg-kla-purpleLight text-kla-purple border-kla-purple/30",
  done: "bg-success text-white border-success",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function StockReturnsPanel() {
  const { profile } = useAuth();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReturnStatus>("all");
  const [whFilter, setWhFilter] = useState<"all" | string>("all");

  // Add form
  const [returnDate, setReturnDate] = useState(todayISO());
  const [so, setSo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [itemName, setItemName] = useState("");
  const [qty, setQty] = useState(1);
  const [warehouseId, setWarehouseId] = useState("");
  const [category, setCategory] = useState<ReturnCategory>("tukar_unit");
  const [reason, setReason] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSo, setEditSo] = useState("");
  const [editOrderNo, setEditOrderNo] = useState("");
  const [editItemName, setEditItemName] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editCategory, setEditCategory] = useState<ReturnCategory>("tukar_unit");
  const [editReason, setEditReason] = useState("");
  const [editProofUrl, setEditProofUrl] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const fetchData = useCallback(async () => {
    const [w, r] = await Promise.all([listWarehouses(), listStockReturns()]);
    setWarehouses(w);
    setReturns(r);
    setWarehouseId((cur) => cur || (w[0]?.id ?? ""));
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }, [fetchData]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refresh = () => fetchData();
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const shown = useMemo(() => returns.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (whFilter !== "all" && r.warehouse_id !== whFilter) return false;
    return true;
  }), [returns, statusFilter, whFilter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) { setError("Pilih asal cabang dulu."); return; }
    if (!itemName.trim()) { setError("Isi nama barang dulu."); return; }
    if (so.trim() && !SO_RE.test(so.trim())) { setError("Format Nomor SO harus lengkap: SO/12345/123456 (5 digit lalu 6 digit)."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addStockReturn({
      return_date: returnDate || todayISO(),
      so_number: so.trim() || null,
      order_number: orderNo.trim() || null,
      item_name: itemName.trim(),
      qty: Math.max(1, Math.round(qty) || 1),
      warehouse_id: warehouseId,
      category,
      reason: reason.trim() || null,
      proof_url: proofUrl.trim() || null,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setSo(""); setOrderNo(""); setItemName(""); setQty(1); setCategory("tukar_unit"); setReason(""); setProofUrl(""); setReturnDate(todayISO());
    fetchData();
  }

  async function setStatus(r: StockReturn, status: ReturnStatus) {
    setReturns((rs) => rs.map((x) => (x.id === r.id ? { ...x, status } : x)));
    const { error } = await updateStockReturn(r.id, { status });
    if (error) { setError(error); load(); }
  }

  async function handleDelete(id: string) {
    setReturns((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteStockReturn(id);
    if (error) { setError(error); load(); }
  }

  function startEdit(r: StockReturn) {
    setEditDate(r.return_date);
    setEditSo(r.so_number ?? "");
    setEditOrderNo(r.order_number ?? "");
    setEditItemName(r.item_name);
    setEditQty(r.qty);
    setEditWarehouseId(r.warehouse_id ?? "");
    setEditCategory(r.category);
    setEditReason(r.reason ?? "");
    setEditProofUrl(r.proof_url ?? "");
    setEditingId(r.id);
  }
  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    if (!editItemName.trim()) { setError("Isi nama barang dulu."); return; }
    if (editSo.trim() && !SO_RE.test(editSo.trim())) { setError("Format Nomor SO harus lengkap: SO/12345/123456 (5 digit lalu 6 digit)."); return; }
    setEditBusy(true);
    setError(null);
    const patch = {
      return_date: editDate || todayISO(),
      so_number: editSo.trim() || null,
      order_number: editOrderNo.trim() || null,
      item_name: editItemName.trim(),
      qty: Math.max(1, Math.round(editQty) || 1),
      warehouse_id: editWarehouseId || null,
      category: editCategory,
      reason: editReason.trim() || null,
      proof_url: editProofUrl.trim() || null,
    };
    setReturns((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await updateStockReturn(id, patch);
    setEditBusy(false);
    if (error) { setError(error); load(); return; }
    setEditingId(null);
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-4xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <PackageX size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Retur &amp; Gagal Kirim</h1>
            <p className="text-sm text-slate-500 mt-1">Catat & pantau pesanan retur atau gagal kirim, dari input sampai selesai.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {warehouses.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500">Belum ada gudang. Tambah dulu di <span className="font-semibold text-slate-700">Multiwarehouse → Database Gudang</span>.</p>
          </div>
        ) : (
          <>
            {/* Add form */}
            <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <Labeled label="Tanggal">
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={INPUT} />
                </Labeled>
                <Labeled label="Asal cabang">
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={INPUT}>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Nomor SO">
                  <input value={so} onChange={(e) => setSo(formatSo(e.target.value))} placeholder="SO/12345/123456" inputMode="numeric" maxLength={15} className={INPUT} />
                </Labeled>
                <Labeled label="Nomor Pesanan">
                  <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="No Pesanan" className={INPUT} />
                </Labeled>
                <Labeled label="Nama barang">
                  <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Nama barang" className={INPUT} />
                </Labeled>
                <Labeled label="Jumlah">
                  <input
                    type="number" min={1} value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className={INPUT}
                  />
                </Labeled>
                <Labeled label="Kategori retur">
                  <select value={category} onChange={(e) => setCategory(e.target.value as ReturnCategory)} className={INPUT}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Link bukti (Google Drive)">
                  <input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://drive.google.com/..." className={INPUT} />
                </Labeled>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-500">Alasan retur / gagal kirim</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Jelasin alasannya…"
                    rows={2}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand resize-none"
                  />
                </div>
              </div>
              <button type="submit" disabled={busy} className="btn-bounce mt-3 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah Retur
              </button>
            </form>

            {/* Filters */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {(["all", ...STATUSES] as const).map((f) => {
                const count = f === "all" ? returns.length : returns.filter((r) => r.status === f).length;
                return (
                  <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${statusFilter === f ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                    {f === "all" ? "Semua" : STATUS_LABEL[f]} ({count})
                  </button>
                );
              })}
            </div>
            {warehouses.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                <button onClick={() => setWhFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${whFilter === "all" ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                  Semua cabang
                </button>
                {warehouses.map((w) => (
                  <button key={w.id} onClick={() => setWhFilter(w.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${whFilter === w.id ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                    {w.name}
                  </button>
                ))}
              </div>
            )}

            {/* List */}
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat…
              </div>
            ) : shown.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center">Belum ada retur di kategori ini.</p>
            ) : (
              <div className="space-y-2">
                {shown.map((r) => {
                  const isEditing = editingId === r.id;
                  const wh = r.warehouse_id ? whMap.get(r.warehouse_id) : undefined;

                  if (isEditing) {
                    return (
                      <div key={r.id} className="bg-white rounded-xl border-2 border-brand shadow-sm p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <Labeled label="Tanggal">
                            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={INPUT} />
                          </Labeled>
                          <Labeled label="Asal cabang">
                            <select value={editWarehouseId} onChange={(e) => setEditWarehouseId(e.target.value)} className={INPUT}>
                              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                          </Labeled>
                          <Labeled label="Nomor SO">
                            <input value={editSo} onChange={(e) => setEditSo(formatSo(e.target.value))} placeholder="SO/12345/123456" inputMode="numeric" maxLength={15} className={INPUT} />
                          </Labeled>
                          <Labeled label="Nomor Pesanan">
                            <input value={editOrderNo} onChange={(e) => setEditOrderNo(e.target.value)} placeholder="No Pesanan" className={INPUT} />
                          </Labeled>
                          <Labeled label="Nama barang">
                            <input value={editItemName} onChange={(e) => setEditItemName(e.target.value)} className={INPUT} />
                          </Labeled>
                          <Labeled label="Jumlah">
                            <input type="number" min={1} value={editQty} onChange={(e) => setEditQty(Number(e.target.value))} className={INPUT} />
                          </Labeled>
                          <Labeled label="Kategori retur">
                            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as ReturnCategory)} className={INPUT}>
                              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                            </select>
                          </Labeled>
                          <Labeled label="Link bukti (Google Drive)">
                            <input value={editProofUrl} onChange={(e) => setEditProofUrl(e.target.value)} placeholder="https://drive.google.com/..." className={INPUT} />
                          </Labeled>
                          <div className="md:col-span-2">
                            <label className="text-[11px] text-slate-500">Alasan retur / gagal kirim</label>
                            <textarea
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                              rows={2}
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand resize-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={() => saveEdit(r.id)} disabled={editBusy} className="btn-bounce inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 text-xs font-semibold disabled:opacity-60">
                            {editBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Simpan
                          </button>
                          <button onClick={cancelEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-50">
                            <X size={13} /> Batal
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 truncate">{r.item_name}{r.qty > 1 ? ` ×${r.qty}` : ""}</p>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-kla-purpleLight text-kla-purple border-kla-purple/30">{CATEGORY_LABEL[r.category]}</span>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                            {r.proof_url && (
                              <a href={r.proof_url} target="_blank" rel="noopener noreferrer" className="text-[11px] inline-flex items-center gap-1 text-brand-hover hover:underline">
                                <ExternalLink size={11} /> Bukti
                              </a>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{r.return_date} · {wh?.name ?? "Cabang tidak dikenal"} · SO {r.so_number || "-"} · Pesanan {r.order_number || "-"}</p>
                          {r.reason && <p className="text-sm text-slate-600 mt-1">{r.reason}</p>}

                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <button onClick={() => startEdit(r)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-hover">
                              <Pencil size={13} /> Edit
                            </button>
                            <select value={r.status} onChange={(e) => setStatus(r, e.target.value as ReturnStatus)} className="text-xs rounded-lg border border-slate-200 bg-white text-slate-700 px-2 py-1.5">
                              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          </div>
                        </div>
                        <button onClick={() => handleDelete(r.id)} className="text-slate-300 hover:text-danger shrink-0"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
