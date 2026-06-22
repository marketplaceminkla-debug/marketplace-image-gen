"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardList, Plus, Loader2, Trash2, Send, Paperclip, Download, CheckSquare, Square } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Warehouse, WarehouseOrder, Ekspedisi, Shipment, OrderStatus,
  STATUS_LABEL, EKSPEDISI_LABEL, SHIPMENT_LABEL,
  listWarehouses, listOrders, addOrder, updateOrder, deleteOrder, waLink, uploadResi,
} from "@/lib/warehouse";

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
};
const STATUSES: OrderStatus[] = ["new", "process", "approved", "denied"];

export default function WarehouseOrdersPanel() {
  const { profile } = useAuth();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orders, setOrders] = useState<WarehouseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // form
  const [warehouseId, setWarehouseId] = useState("");
  const [itemName, setItemName] = useState("");
  const [so, setSo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [ket, setKet] = useState("");
  const [ekspedisi, setEkspedisi] = useState<Ekspedisi>("reguler");
  const [shipment, setShipment] = useState<Shipment>("pickup");
  const [resiFile, setResiFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [w, o] = await Promise.all([listWarehouses(), listOrders()]);
    setWarehouses(w);
    setOrders(o);
    setWarehouseId((cur) => cur || (w[0]?.id ?? ""));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);
  const shown = useMemo(() => (filter === "all" ? orders : orders.filter((o) => o.status === filter)), [orders, filter]);

  // Group filtered orders by warehouse so each branch gets its own combined send.
  const groups = useMemo(() => {
    const m = new Map<string, WarehouseOrder[]>();
    for (const o of shown) {
      if (!m.has(o.warehouse_id)) m.set(o.warehouse_id, []);
      m.get(o.warehouse_id)!.push(o);
    }
    return Array.from(m.entries()).map(([wid, ords]) => ({ wh: whMap.get(wid), orders: ords }));
  }, [shown, whMap]);

  function toggleSelect(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleGroupAll(ords: WarehouseOrder[]) {
    const allSel = ords.every((o) => selected.has(o.id));
    setSelected((p) => { const n = new Set(p); ords.forEach((o) => (allSel ? n.delete(o.id) : n.add(o.id))); return n; });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) { setError("Pilih gudang tujuan dulu."); return; }
    if (!itemName.trim()) { setError("Isi nama barang dulu."); return; }
    if (so.trim() && !SO_RE.test(so.trim())) { setError("Format Nomor SO harus lengkap: SO/12345/123456 (5 digit lalu 6 digit)."); return; }
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
      item_name: itemName.trim(),
      so_number: so.trim() || null,
      order_number: orderNo.trim() || null,
      keterangan: ket.trim() || null,
      ekspedisi, shipment, resi_url,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setItemName(""); setSo(""); setOrderNo(""); setKet(""); setResiFile(null);
    load();
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
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Nama Barang">
                  <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Nama barang" className={INPUT} />
                </Labeled>
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

            {/* Grouped list */}
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat…
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center">Belum ada order di kategori ini.</p>
            ) : (
              <div className="space-y-5">
                {groups.map(({ wh, orders: ords }) => {
                  const selCount = ords.filter((o) => selected.has(o.id)).length;
                  const allSel = ords.length > 0 && ords.every((o) => selected.has(o.id));
                  return (
                    <div key={wh?.id ?? "unknown"}>
                      {/* Group header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <button onClick={() => toggleGroupAll(ords)} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          {allSel ? <CheckSquare size={16} className="text-brand-hover" /> : <Square size={16} className="text-slate-400" />}
                          {wh?.name ?? "Gudang tidak dikenal"}
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
                          return (
                            <div key={o.id} className={`bg-white rounded-xl border shadow-sm p-3 ${checked ? "border-brand" : "border-slate-200"}`}>
                              <div className="flex items-start gap-3">
                                <button onClick={() => toggleSelect(o.id)} className="mt-0.5 shrink-0">
                                  {checked ? <CheckSquare size={18} className="text-brand-hover" /> : <Square size={18} className="text-slate-300" />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-slate-900 truncate">{o.item_name}</p>
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                                    {o.resi_url && (
                                      <button onClick={() => downloadResi(o)} className="text-[11px] inline-flex items-center gap-1 text-brand-hover hover:underline">
                                        <Download size={11} /> Download resi
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">SO {o.so_number || "-"} · Pesanan {o.order_number || "-"}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">{EKSPEDISI_LABEL[o.ekspedisi]} · {SHIPMENT_LABEL[o.shipment]}{o.keterangan ? ` · ${o.keterangan}` : ""}</p>

                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <button onClick={() => send(wh, [o])} className="inline-flex items-center gap-1 text-[11px] font-medium text-success hover:underline">
                                      <Send size={12} /> Kirim 1 ini
                                    </button>
                                    <label className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-brand-hover cursor-pointer">
                                      {uploadingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                                      {o.resi_url ? "Ganti resi" : "Upload resi"}
                                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResiUpload(o, f); }} />
                                    </label>
                                    <select value={o.status} onChange={(e) => setStatus(o, e.target.value as OrderStatus)} className="text-[11px] rounded-lg border border-slate-200 bg-white text-slate-700 px-2 py-1">
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
