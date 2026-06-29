"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, Trash2, Loader2, Send, Copy, Check,
  CheckCircle2, Circle, RefreshCw, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  StoreAccount, DailySalesReport, ReportDeal, PendingItem,
  listStoreAccounts, getDailyReport, upsertDailyReport,
  listReportDeals, addReportDeal, deleteReportDeal,
  listPendingItems, addPendingItem, updatePendingStatus, deletePendingItem,
  getMonthlyTarget, setMonthlyTarget,
  storeDisplayName, formatIDR, buildReportWaMessage,
} from "@/lib/reporting";
import { listOrdersByStore } from "@/lib/warehouse";

const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand";
const NUM_INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-right focus:outline-none focus:border-brand";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseNum(v: string): number {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export default function ReportHarianPanel() {
  const { profile } = useAuth();

  // Store + date selection
  const [stores, setStores] = useState<StoreAccount[]>([]);
  const [storeId, setStoreId] = useState("");
  const [date, setDate] = useState(todayISO());

  // Loaded data
  const [report, setReport] = useState<DailySalesReport | null>(null);
  const [deals, setDeals] = useState<ReportDeal[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [target, setTarget] = useState(0);

  // Form fields (stored as strings for easy input)
  const [revToday, setRevToday] = useState("");
  const [revTotal, setRevTotal] = useState("");
  const [revEstimate, setRevEstimate] = useState("");
  const [chatCount, setChatCount] = useState("");
  const [uploadCount, setUploadCount] = useState("");
  const [komboNon, setKomboNon] = useState("");
  const [komboGar, setKomboGar] = useState("");
  const [lossNotes, setLossNotes] = useState("");
  const [targetInput, setTargetInput] = useState("");

  // Deal form
  const [newDealName, setNewDealName] = useState("");
  const [newDealQty, setNewDealQty] = useState("1");

  // Pending form
  const [newPendingName, setNewPendingName] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // WA modal
  const [showWa, setShowWa] = useState(false);
  const [waText, setWaText] = useState("");
  const [copied, setCopied] = useState(false);

  // Load stores on mount
  useEffect(() => {
    listStoreAccounts().then((s) => {
      setStores(s);
      if (s.length > 0) setStoreId(s[0].id);
    });
  }, []);

  const selectedStore = stores.find((s) => s.id === storeId) ?? null;

  // Load report data when store or date changes
  const loadData = useCallback(async () => {
    if (!storeId || !date) return;
    setLoading(true);
    setError(null);
    const [rep, t] = await Promise.all([
      getDailyReport(storeId, date),
      selectedStore ? getMonthlyTarget(
        selectedStore.pic_name,
        parseInt(date.split("-")[1]),
        parseInt(date.split("-")[0])
      ) : Promise.resolve(0),
    ]);
    setTarget(t);
    setTargetInput(t > 0 ? String(t) : "");
    if (rep) {
      setReport(rep);
      setRevToday(rep.revenue_today > 0 ? String(rep.revenue_today) : "");
      setRevTotal(rep.revenue_total > 0 ? String(rep.revenue_total) : "");
      setRevEstimate(rep.revenue_estimate > 0 ? String(rep.revenue_estimate) : "");
      setChatCount(rep.chat_count > 0 ? String(rep.chat_count) : "");
      setUploadCount(rep.upload_count > 0 ? String(rep.upload_count) : "");
      setKomboNon(rep.kombo_non_garansi > 0 ? String(rep.kombo_non_garansi) : "");
      setKomboGar(rep.kombo_garansi > 0 ? String(rep.kombo_garansi) : "");
      setLossNotes(rep.loss_notes ?? "");
      const [d, p] = await Promise.all([listReportDeals(rep.id), listPendingItems(storeId)]);
      setDeals(d);
      setPendingItems(p);
    } else {
      setReport(null);
      setRevToday(""); setRevTotal(""); setRevEstimate("");
      setChatCount(""); setUploadCount(""); setKomboNon(""); setKomboGar(""); setLossNotes("");
      setDeals([]);
      const p = await listPendingItems(storeId);
      setPendingItems(p);
    }
    setLoading(false);
  }, [storeId, date, selectedStore]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save main report fields
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { id, error: err } = await upsertDailyReport(
      storeId, date,
      {
        revenue_today: parseNum(revToday),
        revenue_total: parseNum(revTotal),
        revenue_estimate: parseNum(revEstimate),
        chat_count: parseNum(chatCount),
        upload_count: parseNum(uploadCount),
        kombo_non_garansi: parseNum(komboNon),
        kombo_garansi: parseNum(komboGar),
        loss_notes: lossNotes.trim() || null,
      },
      profile?.id ?? null
    );
    setSaving(false);
    if (err) { setError(err); return; }
    // Reload to get report ID for deals
    const rep = await getDailyReport(storeId, date);
    setReport(rep);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // Save or update target
  async function handleSaveTarget() {
    if (!selectedStore) return;
    setSavingTarget(true);
    const t = parseNum(targetInput);
    const { error: err } = await setMonthlyTarget(
      selectedStore.pic_name,
      parseInt(date.split("-")[1]),
      parseInt(date.split("-")[0]),
      t
    );
    setSavingTarget(false);
    if (!err) setTarget(t);
  }

  // Auto-sync deals from Multiwarehouse orders
  async function handleSyncFromOrders() {
    if (!report) { setError("Simpan report dulu sebelum sinkron dari orderan."); return; }
    setSyncing(true);
    setError(null);
    const orders = await listOrdersByStore(storeId, date);
    for (const o of orders) {
      const names = o.items?.length ? o.items : o.item_name ? [o.item_name] : [];
      const qtys = o.item_qtys ?? [];
      for (let i = 0; i < names.length; i++) {
        if (!names[i]) continue;
        await addReportDeal(report.id, names[i], qtys[i] ?? 1);
      }
    }
    const updated = await listReportDeals(report.id);
    setDeals(updated);
    setSyncing(false);
  }

  // Add deal manually
  async function handleAddDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!newDealName.trim()) return;
    if (!report) { setError("Simpan report dulu sebelum menambah deal."); return; }
    setError(null);
    const { error: err } = await addReportDeal(report.id, newDealName.trim(), parseNum(newDealQty) || 1);
    if (err) { setError(err); return; }
    const updated = await listReportDeals(report.id);
    setDeals(updated);
    setNewDealName(""); setNewDealQty("1");
  }

  async function handleRemoveDeal(id: string) {
    setDeals((d) => d.filter((x) => x.id !== id));
    await deleteReportDeal(id);
  }

  // Pending items
  async function handleAddPending(e: React.FormEvent) {
    e.preventDefault();
    if (!newPendingName.trim() || !storeId) return;
    setError(null);
    const { error: err } = await addPendingItem(storeId, date, newPendingName.trim());
    if (err) { setError(err); return; }
    const updated = await listPendingItems(storeId);
    setPendingItems(updated);
    setNewPendingName("");
  }

  async function handleTogglePending(item: PendingItem) {
    const next = item.status === "pending" ? "done" : "pending";
    setPendingItems((arr) => arr.map((x) => x.id === item.id ? { ...x, status: next } : x));
    await updatePendingStatus(item.id, next);
  }

  async function handleRemovePending(id: string) {
    setPendingItems((arr) => arr.filter((x) => x.id !== id));
    await deletePendingItem(id);
  }

  // Generate WA report
  function handleGenerateWA() {
    if (!report || !selectedStore) { setError("Simpan report dulu sebelum generate WA."); return; }
    const text = buildReportWaMessage(selectedStore, report, deals, pendingItems, target);
    setWaText(text);
    setShowWa(true);
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(waText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totalDealQty = deals.reduce((s, d) => s + d.qty, 0);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-3xl">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <FileText size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Report Harian</h1>
            <p className="text-sm text-slate-500 mt-1">Input data harian per toko — tersimpan otomatis sebagai histori.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Store + Date selector */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Labeled label="Toko / PIC">
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={INPUT}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{storeDisplayName(s)}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Tanggal">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </Labeled>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-16">
            <Loader2 size={18} className="animate-spin" /> Memuat data…
          </div>
        ) : (
          <>
            {/* Target Bulanan */}
            <SectionCard title="Target Bulanan">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Labeled label={`Target ${selectedStore?.pic_name ?? ""} bulan ini`}>
                    <input
                      type="number"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      placeholder="Contoh: 2500000000"
                      className={NUM_INPUT}
                    />
                    {parseNum(targetInput) > 0 && (
                      <p className="text-[11px] text-slate-400 mt-1 text-right">{formatIDR(parseNum(targetInput))}</p>
                    )}
                  </Labeled>
                </div>
                <button
                  onClick={handleSaveTarget}
                  disabled={savingTarget}
                  className="shrink-0 mb-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-brand text-slate-700 text-xs font-semibold"
                >
                  {savingTarget ? <Loader2 size={13} className="animate-spin" /> : "Simpan"}
                </button>
              </div>
              {target > 0 && (
                <p className="text-xs text-slate-500 mt-1">Target aktif: <span className="font-semibold text-slate-700">{formatIDR(target)}</span></p>
              )}
            </SectionCard>

            {/* Main Report Form */}
            <form onSubmit={handleSave}>
              <SectionCard title="Revenue">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <NumField label="Total Revenue (kumulatif bulan ini)" value={revTotal} onChange={setRevTotal} />
                  <NumField label="Revenue Hari Ini" value={revToday} onChange={setRevToday} />
                  <NumField label="Estimasi Revenue" value={revEstimate} onChange={setRevEstimate} />
                </div>
              </SectionCard>

              <SectionCard title="Aktivitas">
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Chat Masuk">
                    <input type="number" min={0} value={chatCount} onChange={(e) => setChatCount(e.target.value)} placeholder="0" className={NUM_INPUT} />
                  </Labeled>
                  <Labeled label="Upload Produk">
                    <input type="number" min={0} value={uploadCount} onChange={(e) => setUploadCount(e.target.value)} placeholder="0" className={NUM_INPUT} />
                  </Labeled>
                </div>
              </SectionCard>

              <SectionCard title="Kombo Hemat">
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Non Garansi">
                    <input type="number" min={0} value={komboNon} onChange={(e) => setKomboNon(e.target.value)} placeholder="0" className={NUM_INPUT} />
                  </Labeled>
                  <Labeled label="Garansi">
                    <input type="number" min={0} value={komboGar} onChange={(e) => setKomboGar(e.target.value)} placeholder="0" className={NUM_INPUT} />
                  </Labeled>
                </div>
              </SectionCard>

              <SectionCard title="Loss">
                <input
                  type="text"
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  placeholder="Kosongkan jika tidak ada loss"
                  className={INPUT}
                />
              </SectionCard>

              <button
                type="submit"
                disabled={saving}
                className="btn-bounce w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 mb-4"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
                {saved ? "Tersimpan!" : "Simpan Report"}
              </button>
            </form>

            {/* Deal List */}
            <SectionCard title={`Deal (${totalDealQty} unit)`}>
              {report && (
                <button
                  onClick={handleSyncFromOrders}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-hover hover:underline mb-3"
                >
                  {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Sinkron dari Multiwarehouse
                </button>
              )}

              {/* Deal list */}
              {deals.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {deals.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="shrink-0 text-xs font-bold text-brand-hover w-12">{d.qty} unit</span>
                      <span className="flex-1 text-sm text-slate-800">{d.product_name}</span>
                      <button onClick={() => handleRemoveDeal(d.id)} className="shrink-0 text-slate-300 hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add deal form */}
              <form onSubmit={handleAddDeal} className="flex gap-2">
                <input
                  value={newDealName}
                  onChange={(e) => setNewDealName(e.target.value)}
                  placeholder="Nama produk (misal: Macbook Neo MHFA4ID)"
                  className={INPUT + " flex-1"}
                />
                <input
                  type="number"
                  min={1}
                  value={newDealQty}
                  onChange={(e) => setNewDealQty(e.target.value)}
                  className="shrink-0 w-16 px-2 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-center focus:outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={!report}
                  title={!report ? "Simpan report dulu" : "Tambah deal"}
                  className="shrink-0 px-3 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 text-xs font-semibold disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>
              </form>
              {!report && (
                <p className="text-[11px] text-slate-400 mt-1">Simpan report dulu untuk bisa menambah deal.</p>
              )}
            </SectionCard>

            {/* Pending Items */}
            <SectionCard title={`Pending (${pendingItems.filter(p => p.status === "pending").length} open)`}>
              {pendingItems.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {pendingItems.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${p.status === "done" ? "bg-success-light" : "bg-warning-light"}`}>
                      <button onClick={() => handleTogglePending(p)} className="shrink-0">
                        {p.status === "done"
                          ? <CheckCircle2 size={16} className="text-success" />
                          : <Circle size={16} className="text-warning" />
                        }
                      </button>
                      <span className={`flex-1 text-sm ${p.status === "done" ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {p.product_name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{p.report_date}</span>
                      <button onClick={() => handleRemovePending(p.id)} className="shrink-0 text-slate-300 hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddPending} className="flex gap-2">
                <input
                  value={newPendingName}
                  onChange={(e) => setNewPendingName(e.target.value)}
                  placeholder="Produk yang masih pending (misal: Asus V16)"
                  className={INPUT + " flex-1"}
                />
                <button
                  type="submit"
                  className="shrink-0 px-3 py-2 rounded-lg bg-warning-light hover:bg-warning text-warning font-semibold text-xs border border-warning/30"
                >
                  <Plus size={15} />
                </button>
              </form>
            </SectionCard>

            {/* Generate WA */}
            {report && (
              <button
                onClick={handleGenerateWA}
                className="btn-bounce w-full py-3 rounded-xl bg-success text-white font-semibold text-sm flex items-center justify-center gap-2 mt-2"
              >
                <Send size={16} /> Generate Report WA
              </button>
            )}
          </>
        )}
      </div>

      {/* WA Modal */}
      {showWa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">Report WA</h2>
              <button onClick={() => setShowWa(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                readOnly
                value={waText}
                className="w-full h-80 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-800 resize-none focus:outline-none"
              />
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Tersalin!" : "Salin Teks"}
              </button>
              {selectedStore?.pic_wa && (
                <a
                  href={`https://wa.me/${selectedStore.pic_wa.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-success text-white font-semibold text-sm flex items-center gap-2"
                >
                  <Send size={15} /> Kirim WA
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
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

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const n = parseInt(value.replace(/\D/g, ""), 10);
  return (
    <Labeled label={label}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-right focus:outline-none focus:border-brand"
      />
      {!isNaN(n) && n > 0 && (
        <p className="text-[11px] text-slate-400 mt-1 text-right">{formatIDR(n)}</p>
      )}
    </Labeled>
  );
}
