"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import WorkspaceSidebar from "@/components/layout/WorkspaceSidebar";
import PlaceholderPage from "@/components/ui/PlaceholderPage";
import TemplatePanel from "@/components/layout/TemplatePanel";
import GeneratePanel from "@/components/layout/GeneratePanel";
import ImportExcelPanel from "@/components/layout/ImportExcelPanel";
import ShopeeTemplatePanel from "@/components/layout/ShopeeTemplatePanel";
import ZipToShopeePanel from "@/components/layout/ZipToShopeePanel";
import { getActiveTemplate } from "@/lib/imageProcessor";
import { ProductImage } from "@/types";
import { NAV, ViewId, findSection } from "@/components/layout/workspaceNav";
import { Gauge, TrendingUp, ListChecks, PackagePlus, Tag, Percent } from "lucide-react";

export default function Home() {
  const [view, setView] = useState<ViewId>("dash-overview");
  const [templateUploaded, setTemplateUploaded] = useState(false);
  const [pendingImport, setPendingImport] = useState<ProductImage[] | undefined>(undefined);
  const [panelKey, setPanelKey] = useState(0);
  const prevView = useRef<ViewId>("dash-overview");

  useEffect(() => {
    getActiveTemplate().then((t) => setTemplateUploaded(!!t)).catch(() => {});
  }, []);

  const handleViewChange = useCallback((v: ViewId) => {
    if (v === prevView.current) return;
    prevView.current = v;
    setPanelKey((k) => k + 1);
    setView(v);
  }, []);

  const handleImport = useCallback((images: ProductImage[]) => {
    setPendingImport(images);
    handleViewChange("ps-generate");
  }, [handleViewChange]);

  const activeSection = findSection(view);

  function renderContent() {
    switch (view) {
      // ── Tools → PixelSeller (existing app, reused) ──
      case "ps-template":
        return <TemplatePanel onTemplateChange={setTemplateUploaded} />;
      case "ps-import":
        return <ImportExcelPanel onImport={handleImport} templateUploaded={templateUploaded} />;
      case "ps-generate":
        return (
          <GeneratePanel
            templateUploaded={templateUploaded}
            importedImages={pendingImport}
            onImportConsumed={() => setPendingImport(undefined)}
          />
        );
      case "ps-shopee":
        return <ShopeeTemplatePanel />;
      case "ps-ziptoshopee":
        return <ZipToShopeePanel />;

      // ── Dashboard (placeholders) ──
      case "dash-overview":
        return (
          <PlaceholderPage
            icon={Gauge}
            title="Overview / KPI"
            subtitle="Ringkasan performa tim marketplace dalam satu layar."
            features={[
              "Kartu KPI: % target revenue tercapai, jumlah produk baru, listing yang belum keupload",
              "Ringkasan cepat aktivitas tim hari ini",
              "Shortcut ke modul yang paling sering dipakai",
            ]}
          />
        );
      case "dash-revenue":
        return (
          <PlaceholderPage
            icon={TrendingUp}
            title="Revenue"
            subtitle="Pantau pencapaian revenue terhadap target."
            features={[
              "Total revenue & target revenue",
              "Input penambahan revenue tiap hari",
              "Progress bar otomatis: target udah tercapai berapa persen",
              "Grafik tren revenue harian/bulanan",
            ]}
          />
        );
      case "dash-tal":
        return (
          <PlaceholderPage
            icon={ListChecks}
            title="TAL — Total Active Listing"
            subtitle="Pantau jumlah listing yang aktif di tiap marketplace."
            features={[
              "Jumlah listing aktif per marketplace (Shopee, Tokopedia, TikTok Shop)",
              "Tren naik/turun listing aktif",
              "Catatan: konfirmasi dulu kepanjangan & rumus TAL yang kamu mau",
            ]}
          />
        );

      // ── Product Listing (placeholders) ──
      case "prod-new":
        return (
          <PlaceholderPage
            icon={PackagePlus}
            title="New Product"
            subtitle="Catat produk baru dan pantau status uploadnya."
            features={[
              "Input data produk baru (nama, info, foto)",
              "Status upload per marketplace: belum / proses / sudah live",
              "Papan pantau biar ketahuan mana yang masih nyangkut",
            ]}
          />
        );
      case "prod-price":
        return (
          <PlaceholderPage
            icon={Tag}
            title="Update Harga"
            subtitle="Catat perubahan harga produk lama biar tim selalu update."
            features={[
              "Input update harga saat restock / harga naik",
              "Riwayat perubahan: harga lama → harga baru + tanggal",
              "Tim internal bisa lihat harga terkini kapan saja",
            ]}
          />
        );
      case "prod-fee":
        return (
          <PlaceholderPage
            icon={Percent}
            title="Database Fee Marketplace"
            subtitle="Referensi fee tiap marketplace yang bisa di-update."
            features={[
              "Daftar fee per marketplace (admin, layanan, dll)",
              "Bisa diedit kalau kebijakan marketplace berubah",
              "Dipakai untuk hitung margin produk",
            ]}
          />
        );
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-main-bg overflow-hidden">
      <WorkspaceSidebar activeView={view} onViewChange={handleViewChange} templateUploaded={templateUploaded} />
      <main className="flex-1 flex flex-col overflow-hidden pb-[60px] md:pb-0">
        {/* Mobile sub-nav: items of the active section */}
        <div className="md:hidden flex gap-1.5 overflow-x-auto scrollbar-thin px-3 py-2 border-b border-slate-200 bg-white shrink-0">
          {activeSection.items.map((item) => {
            const isActive = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleViewChange(item.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive ? "bg-brand text-slate-900" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.shortLabel ?? item.label}
              </button>
            );
          })}
        </div>

        <div key={panelKey} className="panel-enter flex-1 min-h-0">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
