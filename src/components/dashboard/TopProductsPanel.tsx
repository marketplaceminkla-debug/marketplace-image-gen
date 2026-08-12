"use client";

import { useEffect, useState } from "react";
import { Trophy, Loader2, Medal } from "lucide-react";
import { StoreAccount, listStoreAccounts, storeDisplayName } from "@/lib/reporting";
import { TopProduct, getTopProducts } from "@/lib/warehouse";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RANK_STYLE = [
  "bg-warning text-white",           // #1 gold-ish
  "bg-slate-300 text-white",         // #2 silver-ish
  "bg-brand-muted text-brand-hover", // #3 bronze-ish
];

export default function TopProductsPanel() {
  const [stores, setStores] = useState<StoreAccount[]>([]);
  const [month, setMonth] = useState(currentMonthValue());
  const [dataByStore, setDataByStore] = useState<Record<string, TopProduct[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listStoreAccounts().then(setStores);
  }, []);

  useEffect(() => {
    if (!stores.length) return;
    const [y, m] = month.split("-").map(Number);
    setLoading(true);
    Promise.all(stores.map((s) => getTopProducts(s.id, y, m, 10))).then((results) => {
      const map: Record<string, TopProduct[]> = {};
      stores.forEach((s, i) => { map[s.id] = results[i]; });
      setDataByStore(map);
      setLoading(false);
    });
  }, [stores, month]);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-6xl">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Trophy size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Top Produk</h1>
            <p className="text-sm text-slate-500 mt-1">Top 10 produk terlaris per platform, per bulan (berdasarkan orderan yang diproses).</p>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <label className="text-[11px] text-slate-500 block mb-1">Bulan</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 justify-center py-16">
            <Loader2 size={18} className="animate-spin" /> Memuat data…
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">Belum ada platform/toko terdaftar.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stores.map((s) => (
              <StoreTopCard key={s.id} store={s} products={dataByStore[s.id] ?? []} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoreTopCard({ store, products }: { store: StoreAccount; products: TopProduct[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 truncate">{storeDisplayName(store)}</h3>
      </div>
      {products.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-8">Belum ada orderan bulan ini.</p>
      ) : (
        <ul className="divide-y divide-slate-50">
          {products.map((p, i) => (
            <li key={p.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${RANK_STYLE[i] ?? "bg-slate-100 text-slate-500"}`}>
                {i < 3 ? <Medal size={12} /> : i + 1}
              </span>
              <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{p.name}</span>
              <span className="text-xs font-mono text-slate-500 shrink-0">{p.qty} pcs</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
