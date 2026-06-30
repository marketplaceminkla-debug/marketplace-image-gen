"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, Plus, Trash2, Loader2, Send, Copy, Check,
  CheckCircle2, Circle, RefreshCw, X, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  StoreAccount, DailySalesReport, PendingItem,
  listStoreAccounts, getDailyReport, upsertDailyReport,
  listPendingItems, addPendingItem, updatePendingStatus, deletePendingItem,
  getMonthlyTarget, setMonthlyTarget,
  storeDisplayName, formatIDR, buildReportWaMessage,
} from "@/lib/reporting";
import { getAutoReportData, AutoReportData } from "@/lib/warehouse";

const INPUT = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportHarianPanel() {
  const { profile } = useAuth();

  // Selection
  const [stores, setStores] = useState<StoreAccount[]>([]);
  const [storeId, setStoreId] = useState("");
  const [date, setDate] = useState(todayISO());

  // Auto data dari warehouse orders
  const [autoData, setAutoData] = useState<AutoReportData | null>(null);
  const [loadingAuto, setLoadingAuto] = useState(false);

  // Loaded report
  const [report, setReport] = useState<DailySalesReport | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [target, setTarget] = useState(0);
  const [targetInput, setTargetInput] = useState("");

  // Manual fields only
  const [chatCount, setChatCount] = useState("");
  const [uploadCount, setUploadCount] = useState("");
  const [lossNotes, setLossNotes] = useState("");

  // Pending form
  const [newPendingName, setNewPendingName] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showWa, setShowWa] = useState(false);
  const [waText, setWaText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listStoreAccounts().then((s) => {
      setStores(s);
      if (s.length > 0) setStoreId(s[0].id);
    });
  }, []);

  const selectedStore = stores.find((s) => s.id === storeId) ?? null;

  const loadData = useCallback(async () => {
    if (!storeId || !date || !selectedStore) return;
    setLoadingAuto(true);
    setError(null);

    const [rep, t, auto, pending] = await Promise.all([
      getDailyReport(storeId, date),
      getMonthlyTarget(
        selectedStore.pic_name,
        parseInt(date.split("-")[1]),
        parseInt(date.split("-")[0])
      ),
      getAutoReportData(storeId, date),
      listPendingItems(storeId),
    ]);

    setTarget(t);
    setTargetInput(t > 0 ? String(t) : "");
    setAutoData(auto);
    setPendingItems(pending);

    if (rep) {
      setReport(rep);
      setChatCount(rep.chat_count > 0 ? String(rep.chat_count) : "");
      setUploadCount(rep.upload_count > 0 ? String(rep.upload_count) : "");
      setLossNotes(rep.loss_notes ?? "");
    } else {
      setReport(null);
      setChatCount(""); setUploadCount(""); setLossNotes("");
    }
    setLoadingAuto(false);
  }, [storeId, date, selectedStore]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRefreshAuto() {
    if (!storeId || !date) return;
    setLoadingAuto(true);
    const auto = await getAutoReportData(storeId, date);
    setAutoData(auto);
    setLoadingAuto(false);
  }

  async function handleSaveTarget() {
    if (!selectedStore) return;
    setSavingTarget(true);
    const t = parseInt(targetInput.replace(/\D/g, ""), 10) || 0;
    const { error: err } = await setMonthlyTarget(
      selectedStore.pic_name,
      parseInt(date.split("-")[1]),
      parseInt(date.split("-")[0]),
      t
    );
    setSavingTarget(false);
    if (!err) setTarget(t);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!autoData) return;
    setSaving(true);
    setError(null);

    const { error: err } = await upsertDailyReport(
      storeId, date,
      {
        revenue_today: autoData.revenue_today,
        revenue_total: autoData.revenue_total,
        revenue_estimate: autoData.revenue_estimate,
        chat_count: parseInt(chatCount) || 0,
        upload_count: parseInt(uploadCount) || 0,
        kombo_non_garansi: autoData.kombo_non_garansi,
        kombo_garansi: autoData.kombo_garansi,
        loss_notes: lossNotes.trim() || null,
      },
      profile?.id ?? null
    );
    setSaving(false);
    if (err) { setError(err); return; }
    const rep = await getDailyReport(storeId, date);
    setReport(rep);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

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

  function handleGenerateWA() {
    if (!report || !selectedStore || !autoData) {
      setError("Simpan report dulu sebelum generate WA.");
      return;
    }
    // Build fake report from auto data + manual
    const liveReport: DailySalesReport = {
      ...report,
      revenue_today: autoData.revenue_today,
      revenue_total: autoData.revenue_total,
      revenue_estimate: autoData.revenue_estimate,
      kombo_garansi: autoData.kombo_garansi,
      kombo_non_garansi: autoData.kombo_non_garansi,
      chat_count: parseInt(chatCount) || 0,
    };
    // Build deals from autoData
    const deals = autoData.deals.map((d, i) => ({
      id: String(i),
      report_id: report.id,
      product_name: d.name,
      qty: d.qty,
      created_at: "",
    }));
    const text = buildReportWaMessage(selectedStore, liveReport, deals, pendingItems, target);
    setWaText(text);
    setShowWa(true);
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(waText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
            <p className="text-sm text-slate-500 mt-1">Revenue, deal & kombo hemat otomatis dari Multiwarehouse. Isi manual: chat & pending.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Store + Date */}
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

        {/* Target Bulanan */}
        <SectionCard title="Target Bulanan">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Labeled label={`Target ${selectedStore?.pic_name ?? ""} bulan ini`}>
                <input
                  type="number" min={0}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  placeholder="Contoh: 2500000000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 text-right focus:outline-none focus:border-brand"
                />
                {parseInt(targetInput) > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1 text-right">{formatIDR(parseInt(targetInput))}</p>
                )}
              </Labeled>
            </div>
            <button onClick={handleSaveTarget} disabled={savingTarget}
              className="shrink-0 mb-1 px-3 py-2 rounded-lg bg-slate-100 hover:bg-brand text-slate-700 text-xs font-semibold">
              {savingTarget ? <Loader2 size={13} className="animate-spin" /> : "Simpan"}
            </button>
          </div>
          {target > 0 && (
            <p className="text-xs text-slate-500 mt-1">Target aktif: <span className="font-semibold text-slate-700">{formatIDR(target)}</span></p>
          )}
        </SectionCard>

        {/* AUTO DATA dari Multiwarehouse */}
        <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-brand" />
              <h3 className="text-xs font-semibold text-brand uppercase tracking-wide">Auto dari Multiwarehouse</h3>
            </div>
            <button onClick={handleRefreshAuto} disabled={loadingAuto}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-white">
              {loadingAuto ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Refresh
            </button>
          </div>

          {loadingAuto || !autoData ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
              <Loader2 size={14} className="animate-spin" /> Menghitung dari orderan…
            </div>
          ) : (
            <>
              {/* Revenue cards */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <AutoCard label="Revenue Hari Ini" value={formatIDR(autoData.revenue_today)} />
                <AutoCard label="Total Bulan Ini" value={formatIDR(autoData.revenue_total)} />
                <AutoCard label="Estimasi Bulan Ini" value={formatIDR(autoData.revenue_estimate)} />
              </div>

              {target > 0 && autoData.revenue_total > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                    <span>Progress ke target</span>
                    <span className="font-semibold">{Math.min(100, (autoData.revenue_total / target * 100)).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, autoData.revenue_total / target * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Deal + Kombo */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <AutoCard label="Total Deal" value={`${autoData.deal_qty} unit`} />
                <AutoCard label="Kombo Garansi" value={String(autoData.kombo_garansi)} />
                <AutoCard label="Kombo Non Garansi" value={String(autoData.kombo_non_garansi)} />
              </div>

              {/* Deal list */}
              {autoData.deals.length > 0 && (
                <div className="space-y-1 mt-2">
                  <p className="text-[11px] text-slate-400 font-medium">Detail deal hari ini:</p>
                  {autoData.deals.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-1.5">
                      <span className="shrink-0 text-xs font-bold text-brand w-12">{d.qty} unit</span>
                      <span className="text-sm text-slate-200">{d.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {autoData.deal_qty === 0 && (
                <p className="text-xs text-slate-500 text-center py-2">
                  Belum ada orderan untuk toko ini hari ini. Input di menu Multiwarehouse → Orderan.
                </p>
              )}
            </>
          )}
        </div>

        {/* MANUAL: Chat + Upload */}
        <form onSubmit={handleSave}>
          <SectionCard title="Aktivitas (isi manual)">
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Chat Masuk">
                <input type="number" min={0} value={chatCount}
                  onChange={(e) => setChatCount(e.target.value)} placeholder="0" className={INPUT} />
              </Labeled>
              <Labeled label="Upload Produk">
                <input type="number" min={0} value={uploadCount}
                  onChange={(e) => setUploadCount(e.target.value)} placeholder="0" className={INPUT} />
              </Labeled>
            </div>
          </SectionCard>

          <SectionCard title="Loss (isi manual)">
            <input type="text" value={lossNotes}
              onChange={(e) => setLossNotes(e.target.value)}
              placeholder="Kosongkan jika tidak ada loss"
              className={INPUT} />
          </SectionCard>

          <button type="submit" disabled={saving || !autoData}
            className="btn-bounce w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 mb-4">
            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
            {saved ? "Tersimpan!" : "Simpan Report"}
          </button>
        </form>

        {/* Pending Items */}
        <SectionCard title={`Pending (${pendingItems.filter(p => p.status === "pending").length} open)`}>
          {pendingItems.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {pendingItems.map((p) => (
                <div key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${p.status === "done" ? "bg-success-light" : "bg-warning-light"}`}>
                  <button onClick={() => handleTogglePending(p)} className="shrink-0">
                    {p.status === "done"
                      ? <CheckCircle2 size={16} className="text-success" />
                      : <Circle size={16} className="text-warning" />}
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
            <input value={newPendingName} onChange={(e) => setNewPendingName(e.target.value)}
              placeholder="Produk yang masih pending (misal: Asus V16)"
              className={INPUT + " flex-1"} />
            <button type="submit"
              className="shrink-0 px-3 py-2 rounded-lg bg-warning-light hover:bg-warning text-warning font-semibold text-xs border border-warning/30">
              <Plus size={15} />
            </button>
          </form>
        </SectionCard>

        {/* Generate WA */}
        <button onClick={handleGenerateWA}
          className="btn-bounce w-full py-3 rounded-xl bg-success text-white font-semibold text-sm flex items-center justify-center gap-2 mt-2">
          <Send size={16} /> Generate Report WA
        </button>
      </div>

      {/* WA Modal */}
      {showWa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-900">Report WA</h2>
              <button onClick={() => setShowWa(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <textarea readOnly value={waText}
                className="w-full h-80 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-800 resize-none focus:outline-none" />
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={handleCopy}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2">
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? "Tersalin!" : "Salin Teks"}
              </button>
              {selectedStore?.pic_wa && (
                <a href={`https://wa.me/${selectedStore.pic_wa.replace(/\D/g, "")}?text=${encodeURIComponent(waText)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-success text-white font-semibold text-sm flex items-center gap-2">
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

function AutoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-white leading-tight">{value}</p>
    </div>
  );
}
