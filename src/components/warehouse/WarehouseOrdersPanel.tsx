"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardList, Plus, Loader2, Trash2, Send, Paperclip, Download, CheckSquare, Square, X, Pencil, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Warehouse, WarehouseOrder, Ekspedisi, Shipment, OrderStatus,
  STATUS_LABEL, EKSPEDISI_LABEL, SHIPMENT_LABEL, orderItems,
  listWarehouses, listOrders, addOrder, updateOrder, deleteOrder, waLink, uploadResi,
} from "@/lib/warehouse";
import { StoreAccount, listStoreAccounts, storeDisplayName } from "@/lib/reporting";

const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand";

// Nomor SO mask: SO/#####/###### (5 digits then 6 digits)
const SO_RE = /^SO\/\d{5}\/\d{6}$/;
function formatSo(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  let out = "SO/" + d.slice(0, 5);
  if (d.length > 5) out += "/" + d.slice(5, 11);
  return out;
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-slate-100 text-slate-500 border-slate-200",
  process: "bg-warning-light text-warning border-warning/30",
  approved: "bg-success-light text-success border-success/30",
  denied: "bg-danger-light text-danger border-danger/30",
  done: "bg-success text-white border-success",
};
const STATUSES: OrderStatus[] = ["new", "process", "approved", "denied", "done"];

const EKSP_STYLE: Record<Ekspedisi, string> = {
  instan: "bg-warning-light text-warning border-warning/40",
  reguler: "bg-slate-100 text-slate-500 border-slate-200",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function WarehouseOrdersPanel() {
  const { profile } = useAuth();

  const [storeAccounts, setStoreAccounts] = useState<StoreAccount[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [ekspFilter, setEkspFilter] = useState<"all" | Ekspedisi>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Inline edit (fix human error after an order is already listed)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editItems, setEditItems] = useState<{ name: string; qty: number }[]>([{ name: "", qty: 1 }]);
  const [editSo, setEditSo] = useState("");
  const [editOrderNo, setEditOrderNo] = useState("");
  const [editKet, setEditKet] = useState("");
  const [editEkspedisi, setEditEkspedisi] = useState<Ekspedisi>("reguler");
  const [editShipment, setEditShipment] = useState<Shipment>("pickup");
  const [editStoreAccountId, setEditStoreAccountId] = useState<string>("");
  const [editRevenue, setEditRevenue] = useState<string>("");
  const [editKomboHemat, setEditKomboHemat] = useState<string>("");
  const [editBusy, setEditBusy] = useState(false);

  // "Satpam": block duplicate SO / Nomor Pesanan to cut down double-input human error.
  const [dupWarning, setDupWarning] = useState<string | null>(null);
  const checkDuplicate = useCallback((soVal: string, orderNoVal: string, excludeId?: string): string | null => {
    const soClean = soVal.trim();
    const noClean = orderNoVal.trim();
    const soDupe = !!soClean && orders.some((o) => o.id !== excludeId && (o.so_number ?? "").trim() === soClean);
    const noDupe = !!noClean && orders.some((o) => o.id !== excludeId && (o.order_number ?? "").trim() === noClean);
    if (soDupe && noDupe) return "NOMOR SO DAN NOMOR PESANAN SUDAH ADA! NGANTUK CUCI MUKA!";
    if (soDupe) return "NOMOR SO SUDAH ADA! NGANTUK CUCI MUKA!";
    if (noDupe) return "NOMOR PESANAN SUDAH ADA! NGANTUK CUCI MUKA!";
    return null;
  }, [orders]);

  // form
  const [warehouseId, setWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(todayISO());
  const [items, setItems] = useState<{ name: string; qty: number }[]>([{ name: "", qty: 1 }]);
  const [so, setSo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [ket, setKet] = useState("");
  const [ekspedisi, setEkspedisi] = useState<Ekspedisi>("reguler");
  const [shipment, setShipment] = useState<Shipment>("pickup");
  const [resiFile, setResiFile] = useState<File | null>(null);
  const [storeAccountId, setStoreAccountId] = useState<string>("");
  const [revenue, setRevenue] = useState<string>("");
  const [komboHemat, setKomboHemat] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Silent fetch (no loading spinner) — used for background refreshes.
  const fetchData = useCallback(async () => {
    const [w, o] = await Promise.all([listWarehouses(), listOrders()]);
    setWarehouses(w);
    setOrders(o);
    setWarehouseId((cur) => cur || (w[0]?.id ?? ""));
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    await fetchData();
    setLoading(false);
  }, [fetchData]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { listStoreAccounts().then(setStoreAccounts); }, []);

  // Keep the list fresh without manual refresh. The workspace broadcasts
  // "wh-orders-changed" on realtime/poll; also refetch when the tab regains focus.
  useEffect(() => {
    const refresh = () => fetchData();
    const onVisible = () => { if (document.visibilityState === "visible") fetchData(); };
    window.addEventListener("wh-orders-changed", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("wh-orders-changed", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  // Restricted accounts (e.g. intern handling one branch) only get that
  // branch in the "Gudang tujuan" picker — RLS enforces this server-side too.
  const scope = profile?.warehouse_scope ?? [];
  const scopedWarehouses = useMemo(
    () => (scope.length ? warehouses.filter((w) => scope.includes(w.id)) : warehouses),
    [warehouses, scope]
  );
  // Keep the "Gudang tujuan" default valid for restricted accounts (the
  // initial default picks the first warehouse overall, which a scoped
  // account may not be allowed to use).
  useEffect(() => {
    if (scopedWarehouses.length && !scopedWarehouses.some((w) => w.id === warehouseId)) {
      setWarehouseId(scopedWarehouses[0].id);
    }
  }, [scopedWarehouses, warehouseId]);
  const shown = useMemo(() => orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (ekspFilter !== "all" && o.ekspedisi !== ekspFilter) return false;
    if (fromDate && (o.order_date ?? "") < fromDate) return false;
    if (toDate && (o.order_date ?? "") > toDate) return false;
    return true;
  }), [orders, filter, ekspFilter, fromDate, toDate]);

  // Group by warehouse, then split by ekspedisi (Instan first as priority) so
  // each branch+priority gets its own combined send.
  const groups = useMemo(() => {
    const m = new Map<string, { instan: WarehouseOrder[]; reguler: WarehouseOrder[] }>();
    const order: string[] = [];
    for (const o of shown) {
      if (!m.has(o.warehouse_id)) { m.set(o.warehouse_id, { instan: [], reguler: [] }); order.push(o.warehouse_id); }
      m.get(o.warehouse_id)![o.ekspedisi].push(o);
    }
    const out: Array<{ wh?: Warehouse; ekspedisi: Ekspedisi; orders: WarehouseOrder[] }> = [];
    for (const wid of order) {
      const g = m.get(wid)!;
      const wh = whMap.get(wid);
      if (g.instan.length) out.push({ wh, ekspedisi: "instan", orders: g.instan });
      if (g.reguler.length) out.push({ wh, ekspedisi: "reguler", orders: g.reguler });
    }
    return out;
  }, [shown, whMap]);

  function toggleSelect(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleGroupAll(ords: WarehouseOrder[]) {
    const allSel = ords.every((o) => selected.has(o.id));
    setSelected((p) => { const n = new Set(p); ords.forEach((o) => (allSel ? n.delete(o.id) : n.add(o.id))); return n; });
  }

  const updateItemName = (i: number, v: string) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, name: v } : it)));
  const updateItemQty = (i: number, v: number) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, qty: v } : it)));
  const addItemRow = () => setItems((arr) => [...arr, { name: "", qty: 1 }]);
  const removeItemRow = (i: number) => setItems((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) { setError("Pilih gudang tujuan dulu."); return; }
    const cleanItems = items.map((it) => ({ name: it.name.trim(), qty: Math.max(1, Math.round(it.qty) || 1) })).filter((it) => it.name);
    if (cleanItems.length === 0) { setError("Isi minimal 1 nama barang dulu."); return; }
    if (so.trim() && !SO_RE.test(so.trim())) { setError("Format Nomor SO harus lengkap: SO/12345/123456 (5 digit lalu 6 digit)."); return; }
    const dup = checkDuplicate(so, orderNo);
    if (dup) { setDupWarning(dup); return; }
    setBusy(true);
    setError(null);
    let resi_url: string | null = null;
    if (resiFile) {
      const up = await uploadResi(resiFile);
      if (up.error) { setError("Upload resi gagal: " + up.error); setBusy(false); return; }
      resi_url = up.url;
    }
    const { error } = await addOrder({
      warehouse_id: warehouseId,
      order_date: orderDate || todayISO(),
      item_name: cleanItems[0].name,
      items: cleanItems.map((it) => it.name),
      item_qtys: cleanItems.map((it) => it.qty),
      so_number: so.trim() || null,
      order_number: orderNo.trim() || null,
      keterangan: ket.trim() || null,
      ekspedisi, shipment, resi_url,
      store_account_id: storeAccountId || null,
      revenue: parseInt(revenue.replace(/\D/g, ""), 10) || 0,
      kombo_hemat: (komboHemat as "garansi" | "non_garansi") || null,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setItems([{ name: "", qty: 1 }]); setSo(""); setOrderNo(""); setKet(""); setResiFile(null); setOrderDate(todayISO()); setStoreAccountId(""); setRevenue(""); setKomboHemat("");
    fetchData();
  }

  async function setStatus(o: WarehouseOrder, status: OrderStatus) {
    setOrders((rs) => rs.map((r) => (r.id === o.id ? { ...r, status } : r)));
    const { error } = await updateOrder(o.id, { status });
    if (error) { setError(error); load(); }
  }

  // Send one or many orders (same warehouse) as a single WA message.
  async function send(wh: Warehouse | undefined, ords: WarehouseOrder[]) {
    if (!wh) { setError("Gudang tujuan tidak ditemukan."); return; }
    if (!ords.length) { setError("Centang dulu order yang mau dikirim."); return; }
    window.open(waLink(ords, wh), "_blank");
    const toProcess = ords.filter((o) => o.status === "new");
    if (toProcess.length) {
      const ids = new Set(toProcess.map((o) => o.id));
      setOrders((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, status: "process" } : r)));
      await Promise.all(toProcess.map((o) => updateOrder(o.id, { status: "process" })));
    }
    setSelected((p) => { const n = new Set(p); ords.forEach((o) => n.delete(o.id)); return n; });
  }

  async function handleResiUpload(o: WarehouseOrder, file: File) {
    setUploadingId(o.id);
    setError(null);
    const up = await uploadResi(file);
    if (up.error) { setError("Upload resi gagal: " + up.error); setUploadingId(null); return; }
    setOrders((rs) => rs.map((r) => (r.id === o.id ? { ...r, resi_url: up.url } : r)));
    await updateOrder(o.id, { resi_url: up.url });
    setUploadingId(null);
  }

  async function downloadResi(o: WarehouseOrder) {
    if (!o.resi_url) return;
    try {
      const res = await fetch(o.resi_url);
      const blob = await res.blob();
      const ext = (o.resi_url.split("?")[0].split(".").pop() || "file").slice(0, 5);
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `resi-${(o.item_name || "order").replace(/[^\w-]+/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(o.resi_url, "_blank"); // fallback if direct download is blocked
    }
  }

  async function handleDelete(id: string) {
    setOrders((rs) => rs.filter((r) => r.id !== id));
    setSelected((p) => { const n = new Set(p); n.delete(id); return n; });
    const { error } = await deleteOrder(id);
    if (error) { setError(error); load(); }
  }

  function startEdit(o: WarehouseOrder) {
    const list = orderItems(o);
    setEditDate(o.order_date ?? todayISO());
    setEditItems(list.length ? list.map((it) => ({ name: it.name, qty: it.qty })) : [{ name: "", qty: 1 }]);
    setEditSo(o.so_number ?? "");
    setEditOrderNo(o.order_number ?? "");
    setEditKet(o.keterangan ?? "");
    setEditEkspedisi(o.ekspedisi);
    setEditShipment(o.shipment);
    setEditStoreAccountId(o.store_account_id ?? "");
    setEditRevenue(o.revenue ? String(o.revenue) : "");
    setEditKomboHemat(o.kombo_hemat ?? "");
    setEditingId(o.id);
  }
  function cancelEdit() { setEditingId(null); }

  const updateEditItemName = (i: number, v: string) => setEditItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, name: v } : it)));
  const updateEditItemQty = (i: number, v: number) => setEditItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, qty: v } : it)));
  const addEditItemRow = () => setEditItems((arr) => [...arr, { name: "", qty: 1 }]);
  const removeEditItemRow = (i: number) => setEditItems((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  async function saveEdit(id: string) {
    const cleanItems = editItems.map((it) => ({ name: it.name.trim(), qty: Math.max(1, Math.round(it.qty) || 1) })).filter((it) => it.name);
    if (cleanItems.length === 0) { setError("Isi minimal 1 nama barang dulu."); return; }
    if (editSo.trim() && !SO_RE.test(editSo.trim())) { setError("Format Nomor SO harus lengkap: SO/12345/123456 (5 digit lalu 6 digit)."); return; }
    const dup = checkDuplicate(editSo, editOrderNo, id);
    if (dup) { setDupWarning(dup); return; }
    setEditBusy(true);
    setError(null);
    const patch = {
      order_date: editDate || todayISO(),
      item_name: cleanItems[0].name,
      items: cleanItems.map((it) => it.name),
      item_qtys: cleanItems.map((it) => it.qty),
      so_number: editSo.trim() || null,
      order_number: editOrderNo.trim() || null,
      keterangan: editKet.trim() || null,
      ekspedisi: editEkspedisi,
      shipment: editShipment,
      store_account_id: editStoreAccountId || null,
      revenue: parseInt(editRevenue.replace(/\D/g, ""), 10) || 0,
      kombo_hemat: (editKomboHemat as "garansi" | "non_garansi") || null,
    };
    setOrders((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await updateOrder(id, patch);
    setEditBusy(false);
    if (error) { setError(error); load(); return; }
    setEditingId(null);
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-4xl">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <ClipboardList size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Orderan Gudang</h1>
            <p className="text-sm text-slate-500 mt-1">Input order, centang yang mau dikirim, lalu kirim WA gabungan per gudang.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {warehouses.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500">Belum ada gudang. Tambah dulu di <span className="font-semibold text-slate-700">Multiwarehouse → Database Gudang</span> biar tombol Kirim WA bisa jalan.</p>
          </div>
        ) : (
          <>
            {/* Add form */}
            <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <Labeled label="Gudang tujuan">
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={INPUT}>
                    {scopedWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Tanggal">
                  <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={INPUT} />
                </Labeled>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-slate-500">Barang &amp; jumlah (bisa lebih dari satu)</label>
                  <div className="mt-1 space-y-1.5">
                    {items.map((it, i) => (
                      <div key={i} className="flex gap-1.5">
                        <input value={it.name} onChange={(e) => updateItemName(i, e.target.value)} placeholder={`Nama barang ${i + 1}`} className={INPUT} />
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => updateItemQty(i, Number(e.target.value))}
                          title="Jumlah (qty)"
                          className="shrink-0 w-16 px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-center focus:outline-none focus:border-brand"
                        />
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItemRow(i)} className="shrink-0 w-9 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-danger flex items-center justify-center">
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addItemRow} className="inline-flex items-center gap-1 text-xs font-medium text-brand-hover hover:underline">
                      <Plus size={13} /> Tambah item
                    </button>
                  </div>
                </div>
                <Labeled label="Nomor SO">
                  <input value={so} onChange={(e) => setSo(formatSo(e.target.value))} placeholder="SO/12345/123456" inputMode="numeric" maxLength={15} className={INPUT} />
                </Labeled>
                <Labeled label="Nomor Pesanan">
                  <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="No Pesanan" className={INPUT} />
                </Labeled>
                <Labeled label="Ekspedisi">
                  <select value={ekspedisi} onChange={(e) => setEkspedisi(e.target.value as Ekspedisi)} className={INPUT}>
                    <option value="instan">Instan</option>
                    <option value="reguler">Reguler</option>
                  </select>
                </Labeled>
                <Labeled label="Shipment">
                  <select value={shipment} onChange={(e) => setShipment(e.target.value as Shipment)} className={INPUT}>
                    <option value="dropoff">Drop off</option>
                    <option value="pickup">Pickup</option>
                  </select>
                </Labeled>
                <Labeled label="Keterangan">
                  <input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Keterangan (opsional)" className={INPUT} />
                </Labeled>
                <Labeled label="Platform / Toko">
                  <select value={storeAccountId} onChange={(e) => setStoreAccountId(e.target.value)} className={INPUT}>
                    <option value="">— Pilih toko —</option>
                    {storeAccounts.map((s) => (
                      <option key={s.id} value={s.id}>{storeDisplayName(s)}</option>
                    ))}
                  </select>
                </Labeled>
                <Labeled label="Revenue Order (Rp)">
                  <input
                    type="number"
                    min={0}
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                    placeholder="Harga jual order ini"
                    className={INPUT}
                  />
                </Labeled>
                <Labeled label="Kombo Hemat">
                  <select value={komboHemat} onChange={(e) => setKomboHemat(e.target.value)} className={INPUT}>
                    <option value="">— Tidak ada —</option>
                    <option value="garansi">Garansi</option>
                    <option value="non_garansi">Non Garansi</option>
                  </select>
                </Labeled>
                <Labeled label="Resi (opsional)">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-500 cursor-pointer hover:border-brand">
                    <Paperclip size={15} className="text-slate-400 shrink-0" />
                    <span className="truncate">{resiFile ? resiFile.name : "Pilih file resi…"}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setResiFile(e.target.files?.[0] ?? null)} />
                  </label>
                </Labeled>
              </div>
              <button type="submit" disabled={busy} className="btn-bounce mt-3 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah Order
              </button>
            </form>

            {/* Filter */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {(["all", ...STATUSES] as const).map((f) => {
                const count = f === "all" ? orders.length : orders.filter((o) => o.status === f).length;
                return (
                  <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === f ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                    {f === "all" ? "Semua" : STATUS_LABEL[f]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Ekspedisi filter */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {(["all", "instan", "reguler"] as const).map((f) => {
                const count = f === "all" ? orders.length : orders.filter((o) => o.ekspedisi === f).length;
                const label = f === "all" ? "Semua ekspedisi" : f === "instan" ? "⚡ Instan" : "Reguler";
                return (
                  <button key={f} onClick={() => setEkspFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${ekspFilter === f ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"}`}>
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-2 flex-wrap mb-3 text-xs">
              <span className="text-slate-500 font-medium">Tanggal:</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-brand" />
              <span className="text-slate-400">s/d</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-brand" />
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(""); setToDate(""); }} className="text-slate-400 hover:text-danger font-medium">Reset</button>
              )}
            </div>

            {/* Grouped list */}
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat…
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center">Belum ada order di kategori ini.</p>
            ) : (
              <div className="space-y-5">
                {groups.map(({ wh, ekspedisi: grpEksp, orders: ords }) => {
                  const selCount = ords.filter((o) => selected.has(o.id)).length;
                  const allSel = ords.length > 0 && ords.every((o) => selected.has(o.id));
                  return (
                    <div key={`${wh?.id ?? "unknown"}-${grpEksp}`}>
                      {/* Group header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <button onClick={() => toggleGroupAll(ords)} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          {allSel ? <CheckSquare size={16} className="text-brand-hover" /> : <Square size={16} className="text-slate-400" />}
                          {wh?.name ?? "Gudang tidak dikenal"}
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${EKSP_STYLE[grpEksp]}`}>
                            {grpEksp === "instan" ? "⚡ Instan" : "Reguler"}
                          </span>
                          <span className="text-xs font-normal text-slate-400">({ords.length})</span>
                        </button>
                        <button
                          onClick={() => send(wh, ords.filter((o) => selected.has(o.id)))}
                          disabled={selCount === 0}
                          className="btn-bounce inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
                        >
                          <Send size={13} /> Kirim WA{selCount > 0 ? ` (${selCount})` : ""}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {ords.map((o) => {
                          const checked = selected.has(o.id);
                          const list = orderItems(o);
                          const isEditing = editingId === o.id;

                          if (isEditing) {
                            return (
                              <div key={o.id} className="bg-white rounded-xl border-2 border-brand shadow-sm p-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <Labeled label="Tanggal">
                                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={INPUT} />
                                  </Labeled>
                                  <div />
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
                                  <Labeled label="Nomor SO">
                                    <input value={editSo} onChange={(e) => setEditSo(formatSo(e.target.value))} placeholder="SO/12345/123456" inputMode="numeric" maxLength={15} className={INPUT} />
                                  </Labeled>
                                  <Labeled label="Nomor Pesanan">
                                    <input value={editOrderNo} onChange={(e) => setEditOrderNo(e.target.value)} placeholder="No Pesanan" className={INPUT} />
                                  </Labeled>
                                  <Labeled label="Ekspedisi">
                                    <select value={editEkspedisi} onChange={(e) => setEditEkspedisi(e.target.value as Ekspedisi)} className={INPUT}>
                                      <option value="instan">Instan</option>
                                      <option value="reguler">Reguler</option>
                                    </select>
                                  </Labeled>
                                  <Labeled label="Shipment">
                                    <select value={editShipment} onChange={(e) => setEditShipment(e.target.value as Shipment)} className={INPUT}>
                                      <option value="dropoff">Drop off</option>
                                      <option value="pickup">Pickup</option>
                                    </select>
                                  </Labeled>
                                  <Labeled label="Keterangan">
                                    <input value={editKet} onChange={(e) => setEditKet(e.target.value)} placeholder="Keterangan (opsional)" className={INPUT} />
                                  </Labeled>
                                  <Labeled label="Platform / Toko">
                                    <select value={editStoreAccountId} onChange={(e) => setEditStoreAccountId(e.target.value)} className={INPUT}>
                                      <option value="">— Pilih toko —</option>
                                      {storeAccounts.map((s) => (
                                        <option key={s.id} value={s.id}>{storeDisplayName(s)}</option>
                                      ))}
                                    </select>
                                  </Labeled>
                                  <Labeled label="Revenue Order (Rp)">
                                    <input
                                      type="number"
                                      min={0}
                                      value={editRevenue}
                                      onChange={(e) => setEditRevenue(e.target.value)}
                                      placeholder="Harga jual order ini"
                                      className={INPUT}
                                    />
                                  </Labeled>
                                  <Labeled label="Kombo Hemat">
                                    <select value={editKomboHemat} onChange={(e) => setEditKomboHemat(e.target.value)} className={INPUT}>
                                      <option value="">— Tidak ada —</option>
                                      <option value="garansi">Garansi</option>
                                      <option value="non_garansi">Non Garansi</option>
                                    </select>
                                  </Labeled>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <button onClick={() => saveEdit(o.id)} disabled={editBusy} className="btn-bounce inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 text-xs font-semibold disabled:opacity-60">
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
                            <div key={o.id} className={`bg-white rounded-xl border shadow-sm p-3 ${checked ? "border-brand" : "border-slate-200"}`}>
                              <div className="flex items-start gap-3">
                                <button onClick={() => toggleSelect(o.id)} className="mt-0.5 shrink-0">
                                  {checked ? <CheckSquare size={18} className="text-brand-hover" /> : <Square size={18} className="text-slate-300" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-900 truncate">{list.length === 0 ? "-" : list.length > 1 ? `${list[0].name} +${list.length - 1}` : `${list[0].name}${list[0].qty > 1 ? ` ×${list[0].qty}` : ""}`}</p>
                                    {list.length > 1 && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-kla-purpleLight text-kla-purple">{list.length} barang</span>}
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                                    {o.resi_url && (
                                      <button onClick={() => downloadResi(o)} className="text-[11px] inline-flex items-center gap-1 text-brand-hover hover:underline">
                                        <Download size={11} /> Download resi
                                      </button>
                                    )}
                                  </div>
                                  {list.length > 1 && <p className="text-sm text-slate-600 mt-1">Barang: {list.map((it) => `${it.name}${it.qty > 1 ? ` ×${it.qty}` : ""}`).join(", ")}</p>}
                                  <p className="text-sm text-slate-500 mt-1">{o.order_date ? `${o.order_date} · ` : ""}SO {o.so_number || "-"} · Pesanan {o.order_number || "-"}</p>
                                  <p className="text-sm text-slate-500 mt-0.5">{EKSPEDISI_LABEL[o.ekspedisi]} · {SHIPMENT_LABEL[o.shipment]}{o.keterangan ? ` · ${o.keterangan}` : ""}</p>

                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <button onClick={() => send(wh, [o])} className="inline-flex items-center gap-1 text-xs font-medium text-success hover:underline">
                                      <Send size={13} /> Kirim 1 ini
                                    </button>
                                    <button onClick={() => startEdit(o)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-hover">
                                      <Pencil size={13} /> Edit
                                    </button>
                                    <label className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-hover cursor-pointer">
                                      {uploadingId === o.id ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                                      {o.resi_url ? "Ganti resi" : "Upload resi"}
                                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResiUpload(o, f); }} />
                                    </label>
                                    <select value={o.status} onChange={(e) => setStatus(o, e.target.value as OrderStatus)} className="text-xs rounded-lg border border-slate-200 bg-white text-slate-700 px-2 py-1.5">
                                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <button onClick={() => handleDelete(o.id)} className="text-slate-300 hover:text-danger shrink-0"><Trash2 size={15} /></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Satpam: duplicate SO / Nomor Pesanan popup */}
      {dupWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-danger-light flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🛑</span>
            </div>
            <p className="font-bold text-slate-900 text-lg leading-snug">{dupWarning}</p>
            <button
              onClick={() => setDupWarning(null)}
              className="btn-bounce mt-5 w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm"
            >
              Oke, gua cek lagi
            </button>
          </div>
        </div>
      )}
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
