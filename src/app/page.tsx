"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, LogOut } from "lucide-react";
import WorkspaceSidebar from "@/components/layout/WorkspaceSidebar";
import UserManagementPanel from "@/components/layout/UserManagementPanel";
import TemplatePanel from "@/components/layout/TemplatePanel";
import GeneratePanel from "@/components/layout/GeneratePanel";
import ImportExcelPanel from "@/components/layout/ImportExcelPanel";
import ShopeeTemplatePanel from "@/components/layout/ShopeeTemplatePanel";
import ZipToShopeePanel from "@/components/layout/ZipToShopeePanel";
import LoginScreen from "@/components/auth/LoginScreen";
import PendingScreen from "@/components/auth/PendingScreen";
import OverviewPanel from "@/components/dashboard/OverviewPanel";
import RevenuePanel from "@/components/dashboard/RevenuePanel";
import NewProductPanel from "@/components/products/NewProductPanel";
import PriceUpdatePanel from "@/components/products/PriceUpdatePanel";
import FeeDatabasePanel from "@/components/products/FeeDatabasePanel";
import TalPanel from "@/components/dashboard/TalPanel";
import WarehouseOrdersPanel from "@/components/warehouse/WarehouseOrdersPanel";
import WarehouseDbPanel from "@/components/warehouse/WarehouseDbPanel";
import { getActiveTemplate } from "@/lib/imageProcessor";
import { ProductImage } from "@/types";
import { NAV, ADMIN_SECTION, ViewId, findSection, type NavSection } from "@/components/layout/workspaceNav";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { session, profile, loading, signOut } = useAuth();
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

  // Sections this user is allowed to see.
  const visibleSections = useMemo<NavSection[]>(() => {
    if (!profile) return [];
    if (profile.role === "super_admin") return [...NAV, ADMIN_SECTION];
    return NAV.filter((s) => profile.access.includes(s.id));
  }, [profile]);

  // If the current view isn't allowed, jump to the first allowed item.
  useEffect(() => {
    if (visibleSections.length === 0) return;
    const allowed = visibleSections.some((s) => s.items.some((i) => i.id === view));
    if (!allowed) {
      const first = visibleSections[0].items[0].id;
      prevView.current = first;
      setView(first);
    }
  }, [visibleSections, view]);

  // ── Auth gates ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-main-bg">
        <Loader2 size={22} className="animate-spin text-slate-400" />
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  if (!profile || !profile.is_active) return <PendingScreen reason="pending" />;
  if (visibleSections.length === 0) return <PendingScreen reason="no-access" />;

  const activeSection = findSection(view, visibleSections);

  function renderContent() {
    switch (view) {
      // ── Tools → PixelSeller ──
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

      // ── Admin ──
      case "admin-users":
        return <UserManagementPanel />;

      // ── Dashboard ──
      case "dash-overview":
        return <OverviewPanel onNavigate={handleViewChange} />;
      case "dash-revenue":
        return <RevenuePanel />;
      case "dash-tal":
        return <TalPanel />;

      // ── Product Listing ──
      case "prod-new":
        return <NewProductPanel />;
      case "prod-price":
        return <PriceUpdatePanel />;
      case "prod-fee":
        return <FeeDatabasePanel />;

      // ── Multiwarehouse ──
      case "wh-orders":
        return <WarehouseOrdersPanel />;
      case "wh-list":
        return <WarehouseDbPanel />;
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-main-bg overflow-hidden">
      <WorkspaceSidebar sections={visibleSections} activeView={view} onViewChange={handleViewChange} templateUploaded={templateUploaded} />
      <main className="flex-1 flex flex-col overflow-hidden pb-[60px] md:pb-0">
        {/* Mobile sub-nav: items of the active section + logout */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 bg-white shrink-0">
          <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-thin">
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
          <button onClick={signOut} title="Keluar" className="shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
            <LogOut size={15} />
          </button>
        </div>

        <div key={panelKey} className="panel-enter flex-1 min-h-0">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
