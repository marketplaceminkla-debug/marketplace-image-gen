"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardList, Plus, Loader2, Trash2, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  Warehouse, WarehouseOrder, Ekspedisi, Shipment, OrderStatus,
  STATUS_LABEL, EKSPEDISI_LABEL, SHIPMENT_LABEL,
  listWarehouses, listOrders, addOrder, updateOrder, deleteOrder, waLink,
} from "@/lib/warehouse";

const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand";

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

  // form
  const [warehouseId, setWarehouseId] = useState("");
  const [itemName, setItemName] = useState("");
  const [so, setSo] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [ket, setKet] = useState("");
  const [ekspedisi, setEkspedisi] = useState<Ekspedisi>("reguler");
  const [shipment, setShipment] = useState<Shipment>("pickup");
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) { setError("Pilih gudang tujuan dulu."); return; }
    if (!itemName.trim()) { setError("Isi nama barang dulu."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addOrder({
      warehouse_id: warehouseId,
      item_name: itemName.trim(),
      so_number: so.trim() || null,
      order_number: orderNo.trim() || null,
      keterangan: ket.trim() || null,
      ekspedisi, shipment,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setItemName(""); setSo(""); setOrderNo(""); setKet("");
    load();
  }

  async function setStatus(o: WarehouseOrder, status: OrderStatus) {
    setOrders((rs) => rs.map((r) => (r.id === o.id ? { ...r, status } : r)));
    const { error } = await updateOrder(o.id, { status });
    if (error) { setError(error); load(); }
  }

  function sendWa(o: WarehouseOrder) {
    const wh = whMap.get(o.warehouse_id);
    if (!wh) { setError("Gudang tujuan tidak ditemukan."); return; }
    window.open(waLink(o, wh), "_blank");
    if (o.status === "new") setStatus(o, "process");
  }

  async function handleDelete(id: string) {
    setOrders((rs) => rs.filter((r) => r.id !== id));
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
            <p className="text-sm text-slate-500 mt-1">Input order, klik Kirim WA ke gudang, lalu pantau statusnya.</p>
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
                  <input value={so} onChange={(e) => setSo(e.target.value)} placeholder="No SO" className={INPUT} />
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
                <div className="md:col-span-2">
                  <Labeled label="Keterangan">
                    <input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Keterangan (opsional)" className={INPUT} />
                  </Labeled>
                </div>
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

            {/* List */}
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat…
              </div>
            ) : shown.length === 0 ? (
              <p className="text-sm text-slate-400 py-10 text-center">Belum ada order di kategori ini.</p>
            ) : (
              <div className="space-y-2.5">
                {shown.map((o) => {
                  const wh = whMap.get(o.warehouse_id);
                  return (
                    <div key={o.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 truncate">{o.item_name}</p>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Gudang: <span className="font-medium text-slate-700">{wh?.name ?? "?"}</span> · SO {o.so_number || "-"} · Pesanan {o.order_number || "-"}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {EKSPEDISI_LABEL[o.ekspedisi]} · {SHIPMENT_LABEL[o.shipment]}{o.keterangan ? ` · ${o.keterangan}` : ""}
                          </p>
                        </div>
                        <button onClick={() => handleDelete(o.id)} className="text-slate-300 hover:text-danger shrink-0"><Trash2 size={15} /></button>
                      </div>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button onClick={() => sendWa(o)} className="btn-bounce inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success text-white text-xs font-semibold hover:opacity-90">
                          <Send size={13} /> Kirim WA
                        </button>
                        <span className="text-[11px] text-slate-400">Ubah status:</span>
                        <select value={o.status} onChange={(e) => setStatus(o, e.target.value as OrderStatus)} className="text-xs rounded-lg border border-slate-200 bg-white text-slate-700 px-2 py-1.5">
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
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
