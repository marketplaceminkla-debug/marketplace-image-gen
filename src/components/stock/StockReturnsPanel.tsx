"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { PackageX, Plus, Loader2, Trash2, Pencil, Check, X, Search, PackageSearch } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Warehouse, WarehouseOrder, listWarehouses, SO_RE, formatSo, searchOrdersByOrderNumber, orderItems } from "@/lib/warehouse";
import { StoreAccount, listStoreAccounts, storeDisplayName, formatIDR } from "@/lib/reporting";
import {
  StockReturn, ReturnCategory, ReturnStatus,
  CATEGORY_LABEL, STATUS_LABEL, returnItems,
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
  const [stores, setStores] = useState<StoreAccount[]>([]);
  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReturnStatus>("all");
  const [whFilter, setWhFilter] = useState<"all" | string>("all");
  const [storeFilter, setStoreFilter] = useState<"all" | string>("all");

  // Add form: cari orderan yang mau diretur, lalu isi sisanya manual.
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<WarehouseOrder[]>([]);
  const [searchingOrders, setSearchingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WarehouseOrder | null>(null);
  const [returnDate, setReturnDate] = useState(todayISO());
  const [category, setCategory] = useState<ReturnCategory>("tukar_unit");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSo, setEditSo] = useState("");
  const [editOrderNo, setEditOrderNo] = useState("");
  const [editItems, setEditItems] = useState<{ name: string; qty: number }[]>([{ name: "", qty: 1 }]);
  const [editWarehouseId, setEditWarehouseId] = useState("");
  const [editCategory, setEditCategory] = useState<ReturnCategory>("tukar_unit");
  const [editReason, setEditReason] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const fetchData = useCallback(async () => {
    const [w, s, r] = await Promise.all([listWarehouses(), listStoreAccounts(), listStockReturns()]);
    setWarehouses(w);
    setStores(s);
    setReturns(r);
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
  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const shown = useMemo(() => returns.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (whFilter !== "all" && r.warehouse_id !== whFilter) return false;
    if (storeFilter !== "all" && r.store_account_id !== storeFilter) return false;
    return true;
  }), [returns, statusFilter, whFilter, storeFilter]);

  // Cari orderan by Nomor Pesanan (debounced) buat diambil datanya.
  useEffect(() => {
    const q = orderQuery.trim();
    if (!q) { setOrderResults([]); setSearchingOrders(false); return; }
    setSearchingOrders(true);
    const t = setTimeout(async () => {
      const res = await searchOrdersByOrderNumber(q);
      setOrderResults(res);
      setSearchingOrders(false);
    }, 350);
    return () => clearTimeout(t);
  }, [orderQuery]);

  function pickOrder(o: WarehouseOrder) {
    setSelectedOrder(o);
    setOrderQuery("");
    setOrderResults([]);
  }
  function clearPickedOrder() {
    setSelectedOrder(null);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrder) { setError("Cari & pilih orderan yang mau diretur dulu."); return; }
    setBusy(true);
    setError(null);
    const list = orderItems(selectedOrder);
    const { error } = await addStockReturn({
      return_date: returnDate || todayISO(),
      so_number: selectedOrder.so_number,
      order_number: selectedOrder.order_number,
      items: list.map((it) => it.name),
      item_qtys: list.map((it) => it.qty),
      warehouse_id: selectedOrder.warehouse_id,
      store_account_id: selectedOrder.store_account_id,
      revenue: selectedOrder.revenue ?? null,
      source_order_id: selectedOrder.id,
      category,
      reason: reason.trim() || null,
      proof_url: null,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setSelectedOrder(null); setCategory("tukar_unit"); setReason(""); setReturnDate(todayISO());
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

  const updateEditItemName = (i: number, v: string) => setEditItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, name: v } : it)));
  const updateEditItemQty = (i: number, v: number) => setEditItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, qty: v } : it)));
  const addEditItemRow = () => setEditItems((arr) => [...arr, { name: "", qty: 1 }]);
  const removeEditItemRow = (i: number) => setEditItems((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  function startEdit(r: StockReturn) {
    const list = returnItems(r);
    setEditDate(r.return_date);
    setEditSo(r.so_number ?? "");
    setEditOrderNo(r.order_number ?? "");
    setEditItems(list.length ? list.map((it) => ({ name: it.name, qty: it.qty })) : [{ name: "", qty: 1 }]);
    setEditWarehouseId(r.warehouse_id ?? "");
    setEditCategory(r.category);
    setEditReason(r.reason ?? "");
    setEditingId(r.id);
  }
  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    const cleanItems = editItems.map((it) => ({ name: it.name.trim(), qty: Math.max(1, Math.round(it.qty) || 1) })).filter((it) => it.name);
    if (cleanItems.length === 0) { setError("Isi minimal 1 nama barang dulu."); return; }
    if (editSo.trim() && !SO_RE.test(editSo.trim())) { setError("Format Nomor SO harus lengkap: SO/12345/123456 (5 digit lalu 6 digit)."); return; }
    setEditBusy(true);
    setError(null);
    const patch = {
      return_date: editDate || todayISO(),
      so_number: editSo.trim() || null,
      order_number: editOrderNo.trim() || null,
      items: cleanItems.map((it) => it.name),
      item_qtys: cleanItems.map((it) => it.qty),
      item_name: cleanItems[0].name,
      qty: cleanItems[0].qty,
      warehouse_id: editWarehouseId || null,
      category: editCategory,
      reason: editReason.trim() || null,
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
              {!selectedOrder ? (
                <div>
                  <label className="text-[11px] text-slate-500">Cari orderan (by Nomor Pesanan)</label>
                  <div className="relative mt-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={orderQuery}
                      onChange={(e) => setOrderQuery(e.target.value)}
                      placeholder="Ketik Nomor Pesanan yang mau diretur…"
                      className={`${INPUT} pl-9`}
                    />
                  </div>
                  {orderQuery.trim() && (
                    <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                      {searchingOrders ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                          <Loader2 size={14} className="animate-spin" /> Mencari…
                        </div>
                      ) : orderResults.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">Nomor pesanan gak ketemu.</p>
                      ) : (
                        orderResults.map((o) => {
                          const list = orderItems(o);
                          const wh = whMap.get(o.warehouse_id);
                          const store = o.store_account_id ? storeMap.get(o.store_account_id) : undefined;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => pickOrder(o)}
                              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
                            >
                              <p className="text-sm font-semibold text-slate-800">{o.order_number || "-"} <span className="text-slate-400 font-normal">· SO {o.so_number || "-"}</span></p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {list.length ? list.map((it) => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(", ") : "-"}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{o.order_date} · {wh?.name ?? "Cabang tidak dikenal"}{store ? ` · ${storeDisplayName(store)}` : ""}</p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <div className="md:col-span-2 flex items-start justify-between gap-3 bg-slate-50 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500 flex items-center gap-1"><PackageSearch size={12} /> Orderan dipilih</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">{selectedOrder.order_number || "-"} · SO {selectedOrder.so_number || "-"}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {orderItems(selectedOrder).map((it) => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(", ") || "-"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {whMap.get(selectedOrder.warehouse_id)?.name ?? "Cabang tidak dikenal"}
                        {selectedOrder.store_account_id && storeMap.get(selectedOrder.store_account_id) ? ` · ${storeDisplayName(storeMap.get(selectedOrder.store_account_id)!)}` : ""}
                        {selectedOrder.revenue ? ` · ${formatIDR(selectedOrder.revenue)}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={clearPickedOrder} className="shrink-0 text-xs font-medium text-slate-500 hover:text-danger flex items-center gap-1">
                      <X size={13} /> Ganti
                    </button>
                  </div>
                  <Labeled label="Tanggal input">
                    <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={INPUT} />
                  </Labeled>
                  <div />
                  <Labeled label="Kategori retur">
                    <select value={category} onChange={(e) => setCategory(e.target.value as ReturnCategory)} className={INPUT}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                    </select>
                  </Labeled>
                  <div />
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
              )}
              {selectedOrder && (
                <button type="submit" disabled={busy} className="btn-bounce mt-3 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah Retur
                </button>
              )}
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
            {stores.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <button onClick={() => setStoreFilter("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${storeFilter === "all" ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                  Semua toko
                </button>
                {stores.map((s) => (
                  <button key={s.id} onClick={() => setStoreFilter(s.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${storeFilter === s.id ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            )}
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
                          <div className="md:col-span-2">
                            <label className="text-[11px] text-slate-500">Barang &amp; jumlah</label>
                            <div className="mt-1 space-y-1.5">
                              {editItems.map((it, i) => (
                                <div key={i} className="flex gap-1.5">
                                  <input value={it.name} onChange={(e) => updateEditItemName(i, e.target.value)} placeholder={`Nama barang ${i + 1}`} className={INPUT} />
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.qty}
                                    onChange={(e) => updateEditItemQty(i, Number(e.target.value))}
                                    title="Jumlah (qty)"
                                    className="shrink-0 w-16 px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-center focus:outline-none focus:border-brand"
                                  />
                                  {editItems.length > 1 && (
                                    <button type="button" onClick={() => removeEditItemRow(i)} className="shrink-0 w-9 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-danger flex items-center justify-center">
                                      <X size={15} />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button type="button" onClick={addEditItemRow} className="inline-flex items-center gap-1 text-xs font-medium text-brand-hover hover:underline">
                                <Plus size={13} /> Tambah item
                              </button>
                            </div>
                          </div>
                          <Labeled label="Kategori retur">
                            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as ReturnCategory)} className={INPUT}>
                              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                            </select>
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

                  const list = returnItems(r);
                  const store = r.store_account_id ? storeMap.get(r.store_account_id) : undefined;
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 truncate">{list.length === 0 ? "-" : list.length > 1 ? `${list[0].name} +${list.length - 1}` : `${list[0].name}${list[0].qty > 1 ? ` ×${list[0].qty}` : ""}`}</p>
                            {list.length > 1 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-kla-purpleLight text-kla-purple">{list.length} barang</span>}
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-kla-purpleLight text-kla-purple border-kla-purple/30">{CATEGORY_LABEL[r.category]}</span>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                          </div>
                          {list.length > 1 && <p className="text-sm text-slate-600 mt-1">Barang: {list.map((it) => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(", ")}</p>}
                          <p className="text-sm text-slate-500 mt-1">
                            {r.return_date} · {wh?.name ?? "Cabang tidak dikenal"}{store ? ` · ${storeDisplayName(store)}` : ""} · SO {r.so_number || "-"} · Pesanan {r.order_number || "-"}{r.revenue ? ` · ${formatIDR(r.revenue)}` : ""}
                          </p>
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
