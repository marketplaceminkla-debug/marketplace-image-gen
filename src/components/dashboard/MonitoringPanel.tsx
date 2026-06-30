"use client";

import { useEffect, useState } from "react";
import { BarChart2, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  StoreAccount, MonthlyStats,
  listStoreAccounts, listMonthlyStats,
  formatIDR, monthName,
} from "@/lib/reporting";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function MonitoringPanel() {
  const [stores, setStores] = useState<StoreAccount[]>([]);
  const [pics, setPics] = useState<string[]>([]);
  const [selectedPic, setSelectedPic] = useState<string>("all");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listStoreAccounts().then((s) => {
      setStores(s);
      const uniquePics = Array.from(new Set(s.map((x) => x.pic_name))).sort();
      setPics(uniquePics);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    listMonthlyStats(selectedPic === "all" ? null : selectedPic, year).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, [selectedPic, year]);

  const maxChat = Math.max(...stats.map((s) => s.chat_count), 1);
  const maxDeal = Math.max(...stats.map((s) => s.deal_qty), 1);
  const maxRev = Math.max(...stats.map((s) => s.revenue_total), 1);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-5xl">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <BarChart2 size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Monitoring Tren</h1>
            <p className="text-sm text-slate-500 mt-1">Perbandingan chat, deal, dan revenue per bulan (MoM / YoY).</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap mb-6">
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">PIC</label>
            <select
              value={selectedPic}
              onChange={(e) => setSelectedPic(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand"
            >
              <option value="all">Semua PIC</option>
              {pics.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Tahun</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 justify-center py-16">
            <Loader2 size={18} className="animate-spin" /> Memuat data…
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Belum ada data untuk filter ini. Mulai input Report Harian dulu.
          </div>
        ) : (
          <>
            {/* Chart: Chat Masuk */}
            <ChartSection title="Chat Masuk per Bulan" accent="bg-blue-400">
              {stats.map((s, i) => {
                const prev = stats[i - 1];
                const delta = prev ? s.chat_count - prev.chat_count : null;
                return (
                  <BarRow
                    key={s.month}
                    label={monthName(s.month)}
                    value={s.chat_count}
                    max={maxChat}
                    valueLabel={String(s.chat_count)}
                    delta={delta}
                    accent="bg-blue-400"
                  />
                );
              })}
            </ChartSection>

            {/* Chart: Deal */}
            <ChartSection title="Total Deal (unit) per Bulan" accent="bg-brand">
              {stats.map((s, i) => {
                const prev = stats[i - 1];
                const delta = prev ? s.deal_qty - prev.deal_qty : null;
                return (
                  <BarRow
                    key={s.month}
                    label={monthName(s.month)}
                    value={s.deal_qty}
                    max={maxDeal}
                    valueLabel={String(s.deal_qty)}
                    delta={delta}
                    accent="bg-brand"
                  />
                );
              })}
            </ChartSection>

            {/* Chart: Revenue */}
            <ChartSection title="Revenue Harian Kumulatif per Bulan" accent="bg-success">
              {stats.map((s, i) => {
                const prev = stats[i - 1];
                const delta = prev ? s.revenue_total - prev.revenue_total : null;
                const pct = s.target > 0 ? Math.min(100, (s.revenue_total / s.target) * 100) : 0;
                return (
                  <div key={s.month}>
                    <BarRow
                      label={monthName(s.month)}
                      value={s.revenue_total}
                      max={maxRev}
                      valueLabel={formatIDR(s.revenue_total)}
                      delta={delta}
                      accent="bg-success"
                    />
                    {s.target > 0 && (
                      <p className="text-[10px] text-slate-400 pl-14 -mt-1 mb-2">
                        Target: {formatIDR(s.target)} — Pencapaian: <span className={pct >= 100 ? "text-success font-semibold" : ""}>{pct.toFixed(1)}%</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </ChartSection>

            {/* Summary Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Tabel Ringkasan</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Bulan</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Chat</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">CR Chat→Deal</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Deal (unit)</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Revenue</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">vs Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s, i) => {
                      const prev = stats[i - 1];
                      const chatDelta = prev ? s.chat_count - prev.chat_count : null;
                      const cr = s.chat_count > 0 ? ((s.deal_qty / s.chat_count) * 100).toFixed(1) : "-";
                      const pct = s.target > 0 ? (s.revenue_total / s.target * 100).toFixed(1) : "-";
                      return (
                        <tr key={s.month} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-medium text-slate-700">{monthName(s.month)} {s.year}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {s.chat_count}
                            {chatDelta !== null && (
                              <DeltaBadge delta={chatDelta} />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{cr}{cr !== "-" ? "%" : ""}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{s.deal_qty}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600 font-mono text-xs">{formatIDR(s.revenue_total)}</td>
                          <td className="px-4 py-2.5 text-right">
                            {pct === "-" ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <span className={`text-xs font-semibold ${Number(pct) >= 100 ? "text-success" : Number(pct) >= 80 ? "text-warning" : "text-danger"}`}>
                                {pct}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChartSection({ title, children, accent }: { title: string; children: React.ReactNode; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BarRow({
  label, value, max, valueLabel, delta, accent,
}: {
  label: string; value: number; max: number; valueLabel: string; delta: number | null; accent: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 shrink-0 text-xs text-slate-500 text-right">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${accent}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      <span className="w-28 shrink-0 text-xs text-slate-700 font-mono text-right">{valueLabel}</span>
      {delta !== null && <DeltaBadge delta={delta} />}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="shrink-0"><Minus size={12} className="text-slate-300" /></span>;
  if (delta > 0) return (
    <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-success">
      <TrendingUp size={11} />+{delta > 999 ? formatIDR(delta).replace("Rp ", "") : delta}
    </span>
  );
  return (
    <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-danger">
      <TrendingDown size={11} />{delta > -1000 ? delta : formatIDR(delta).replace("Rp ", "")}
    </span>
  );
}
