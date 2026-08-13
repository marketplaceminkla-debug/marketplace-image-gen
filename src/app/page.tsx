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
import SkuReplacementPanel from "@/components/products/SkuReplacementPanel";
import TalPanel from "@/components/dashboard/TalPanel";
import KpiTimPanel from "@/components/dashboard/KpiTimPanel";
import ReportHarianPanel from "@/components/dashboard/ReportHarianPanel";
import MonitoringPanel from "@/components/dashboard/MonitoringPanel";
import TopProductsPanel from "@/components/dashboard/TopProductsPanel";
import WarehouseOrdersPanel from "@/components/warehouse/WarehouseOrdersPanel";
import WarehouseDbPanel from "@/components/warehouse/WarehouseDbPanel";
import StockReturnsPanel from "@/components/stock/StockReturnsPanel";
import { getActiveTemplate } from "@/lib/imageProcessor";
import { ProductImage } from "@/types";
import { NAV, ADMIN_SECTION, ViewId, findSection, viewHref, type NavSection } from "@/components/layout/workspaceNav";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { listOrders } from "@/lib/warehouse";
import { unlockAudio, playChirp } from "@/lib/notifSound";
import { AppNotification, listNotifications, getLastSeenAt, markSeenNow, relativeTime } from "@/lib/notifications";
import { Bell, X } from "lucide-react";

function viewFromLocation(): ViewId | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("v");
  return (v as ViewId) || null;
}

export default function Home() {
  const { session, profile, loading, signOut } = useAuth();
  const [view, setView] = useState<ViewId>(() => viewFromLocation() ?? "dash-overview");
  const [templateUploaded, setTemplateUploaded] = useState(false);
  const [pendingImport, setPendingImport] = useState<ProductImage[] | undefined>(undefined);
  const [panelKey, setPanelKey] = useState(0);
  const prevView = useRef<ViewId>(view);
  const [notifs, setNotifs] = useState<{ id: number; text: string }[]>([]);
  const notifSeq = useRef(0);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const pendingNewOrders = useRef<Array<{ id?: string; created_by?: string | null; item_name?: string | null; items?: string[] | null }>>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChirpAt = useRef(0);
  const pendingBellItems = useRef<AppNotification[]>([]);
  const bellFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifBaseline = useRef(false);

  // Notification center (bell icon): persistent history, separate from the
  // toast+sound above. Orderan & Product Listing events land here.
  const [bellItems, setBellItems] = useState<AppNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState("9999-12-31T00:00:00.000Z"); // nothing "unread" until real value loads post-mount
  const prevSeenRef = useRef("");
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getActiveTemplate().then((t) => setTemplateUploaded(!!t)).catch(() => {});
  }, []);

  // Unlock notification audio on the first user gesture (browser autoplay rules).
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const handleViewChange = useCallback((v: ViewId) => {
    if (v === prevView.current) return;
    prevView.current = v;
    setPanelKey((k) => k + 1);
    setView(v);
    window.history.pushState(null, "", viewHref(v));
  }, []);

  // Browser back/forward should move between views too, since each one now
  // has its own URL.
  useEffect(() => {
    function onPopState() {
      const v = viewFromLocation();
      if (!v || v === prevView.current) return;
      prevView.current = v;
      setPanelKey((k) => k + 1);
      setView(v);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
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

  // If the current view isn't allowed (e.g. a stale/foreign URL), jump to
  // the first allowed item and correct the URL to match.
  useEffect(() => {
    if (visibleSections.length === 0) return;
    const allowed = visibleSections.some((s) => s.items.some((i) => i.id === view));
    if (!allowed) {
      const first = visibleSections[0].items[0].id;
      prevView.current = first;
      setView(first);
      window.history.replaceState(null, "", viewHref(first));
    }
  }, [visibleSections, view]);

  // New-order notifications (toast + sound), for users with Multiwarehouse
  // access. Detected by diffing fetched rows against known ids, so it fires
  // whether the order arrives via realtime or via polling.
  const canWarehouse = !!profile && (profile.role === "super_admin" || profile.access.includes("warehouse"));
  const myId = profile?.id;

  // Batches bursts of new-order events (e.g. a bulk SQL restore firing
  // hundreds of realtime INSERTs at once) into a single toast + chirp every
  // ~400ms, instead of one setState + audio.play() per row — which was
  // enough to freeze the tab when ~1000 rows landed at once.
  const flushNewOrderNotifs = useCallback(() => {
    flushTimer.current = null;
    const rows = pendingNewOrders.current;
    pendingNewOrders.current = [];
    if (!rows.length) return;
    const now = Date.now();
    if (now - lastChirpAt.current > 1500) {
      playChirp();
      lastChirpAt.current = now;
    }
    const first = rows[0];
    const firstItems = first.items?.length ? first.items : first.item_name ? [first.item_name] : [];
    const label = rows.length === 1
      ? (firstItems.length ? `${firstItems[0]}${firstItems.length > 1 ? ` +${firstItems.length - 1}` : ""}` : "barang baru")
      : `${rows.length} orderan sekaligus`;
    const id = ++notifSeq.current;
    setNotifs((n) => [...n.slice(-4), { id, text: `Orderan baru: ${label}` }]);
    setTimeout(() => setNotifs((n) => n.filter((x) => x.id !== id)), 8000);
  }, []);

  const notifyNewOrders = useCallback((rows: Array<{ id?: string; created_by?: string | null; item_name?: string | null; items?: string[] | null }>) => {
    for (const row of rows) {
      if (!row.id || knownOrderIds.current.has(row.id)) continue;
      knownOrderIds.current.add(row.id);
      if (!notifBaseline.current) continue;      // skip pre-existing on first load
      if (row.created_by === myId) continue;      // don't notify yourself
      pendingNewOrders.current.push(row);
    }
    if (pendingNewOrders.current.length && !flushTimer.current) {
      flushTimer.current = setTimeout(flushNewOrderNotifs, 400);
    }
  }, [myId, flushNewOrderNotifs]);

  useEffect(() => {
    if (!canWarehouse) return;
    let active = true;

    // Baseline: record existing orders without notifying.
    listOrders().then((rows) => {
      if (!active) return;
      rows.forEach((r) => knownOrderIds.current.add(r.id));
      notifBaseline.current = true;
    });

    // Poll (works in foreground; background gets throttled but realtime covers it).
    const poll = setInterval(async () => {
      const rows = await listOrders();
      if (!active) return;
      notifyNewOrders(rows);
      window.dispatchEvent(new CustomEvent("wh-orders-changed"));
    }, 7000);

    // Realtime: instant updates (incl. background tabs).
    const channel = supabase
      .channel("wh-orders-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "warehouse_orders" }, (payload) => {
        window.dispatchEvent(new CustomEvent("wh-orders-changed"));
        notifyNewOrders([payload.new as { id?: string; created_by?: string | null; item_name?: string | null; items?: string[] | null }]);
      })
      .subscribe();

    return () => { active = false; clearInterval(poll); supabase.removeChannel(channel); };
  }, [canWarehouse, notifyNewOrders]);

  // Notification bell: fetch + poll + realtime for the persistent list.
  const canProduct = !!profile && (profile.role === "super_admin" || profile.access.includes("product"));
  const canSystem = profile?.role === "super_admin";
  useEffect(() => { setLastSeenAt(getLastSeenAt()); }, []);
  useEffect(() => {
    if (!canWarehouse && !canProduct && !canSystem) return;
    let active = true;

    listNotifications().then((rows) => { if (active) setBellItems(rows); });
    const poll = setInterval(async () => {
      const rows = await listNotifications();
      if (active) setBellItems(rows);
    }, 20000);

    const channel = supabase
      .channel("app-notif-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        // Batch bursts (e.g. a bulk restore) into one setState every ~400ms
        // instead of one per row.
        pendingBellItems.current.unshift(payload.new as AppNotification);
        if (!bellFlushTimer.current) {
          bellFlushTimer.current = setTimeout(() => {
            bellFlushTimer.current = null;
            const batch = pendingBellItems.current;
            pendingBellItems.current = [];
            setBellItems((rows) => [...batch, ...rows].slice(0, 50));
          }, 400);
        }
      })
      .subscribe();

    return () => { active = false; clearInterval(poll); supabase.removeChannel(channel); };
  }, [canWarehouse, canProduct, canSystem]);

  // Close the bell dropdown on outside click.
  useEffect(() => {
    if (!bellOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [bellOpen]);

  const unreadCount = bellItems.filter((n) => n.created_at > lastSeenAt).length;
  function toggleBell() {
    setBellOpen((open) => {
      const next = !open;
      if (next) {
        prevSeenRef.current = lastSeenAt;
        setLastSeenAt(markSeenNow());
      }
      return next;
    });
  }
  function handleNotifClick(n: AppNotification) {
    handleViewChange(n.target_view as ViewId);
    setBellOpen(false);
  }

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
      case "dash-kpi":
        return <KpiTimPanel />;
      case "dash-report":
        return <ReportHarianPanel />;
      case "dash-monitoring":
        return <MonitoringPanel />;
      case "dash-top-products":
        return <TopProductsPanel />;

      // ── Product Listing ──
      case "prod-new":
        return <NewProductPanel />;
      case "prod-price":
        return <PriceUpdatePanel />;
      case "prod-fee":
        return <FeeDatabasePanel />;
      case "prod-sku":
        return <SkuReplacementPanel />;

      // ── Multiwarehouse ──
      case "wh-orders":
        return <WarehouseOrdersPanel />;
      case "wh-list":
        return <WarehouseDbPanel />;

      // ── Stock Management ──
      case "stock-returns":
        return <StockReturnsPanel />;
    }
  }

  const warehouseNotifs = bellItems.filter((n) => n.category === "warehouse");
  const productNotifs = bellItems.filter((n) => n.category === "product");
  const systemNotifs = bellItems.filter((n) => n.category === "system");

  return (
    <div className="flex flex-col md:flex-row h-screen bg-main-bg overflow-hidden">
      {/* Notification bell: persistent history, separated by section */}
      {(canWarehouse || canProduct || canSystem) && (
        <div ref={bellRef} className="fixed top-3 right-3 md:top-4 md:right-4 z-[280]">
          <button
            onClick={toggleBell}
            title="Notifikasi"
            className="relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg border border-white/20 hover:border-brand/60 transition-colors"
            style={{ background: "#2D1B69" }}
          >
            <Bell size={17} style={{ color: "#F5C200" }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-main-bg">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 mt-2 w-[92vw] max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl shadow-xl bg-white border border-slate-200 animate-fade-in">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                <p className="text-sm font-bold text-slate-900">Notifikasi</p>
                <button onClick={() => setBellOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
              </div>

              {bellItems.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Belum ada notifikasi.</p>
              ) : (
                <>
                  {warehouseNotifs.length > 0 && (
                    <div className="pb-1">
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Orderan Gudang</p>
                      {warehouseNotifs.map((n) => (
                        <NotifRow key={n.id} n={n} unread={n.created_at > prevSeenRef.current} onClick={() => handleNotifClick(n)} />
                      ))}
                    </div>
                  )}
                  {productNotifs.length > 0 && (
                    <div className="pb-1">
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Product Listing</p>
                      {productNotifs.map((n) => (
                        <NotifRow key={n.id} n={n} unread={n.created_at > prevSeenRef.current} onClick={() => handleNotifClick(n)} />
                      ))}
                    </div>
                  )}
                  {systemNotifs.length > 0 && (
                    <div className="pb-1">
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-amber-500 uppercase tracking-wide">⚠ Sistem</p>
                      {systemNotifs.map((n) => (
                        <NotifRow key={n.id} n={n} unread={n.created_at > prevSeenRef.current} onClick={() => handleNotifClick(n)} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Realtime notifications */}
      {notifs.length > 0 && (
        <div className="fixed top-16 right-3 md:top-20 md:right-4 z-[300] space-y-2 w-[min(88vw,320px)]">
          {notifs.map((n) => (
            <button
              key={n.id}
              onClick={() => { handleViewChange("wh-orders"); setNotifs((x) => x.filter((y) => y.id !== n.id)); }}
              className="animate-slide-up w-full flex items-center gap-2.5 text-left px-3.5 py-3 rounded-xl shadow-lg text-white"
              style={{ background: "#2D1B69", border: "1px solid #4A2D99" }}
            >
              <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F5C200" }}>
                <Bell size={15} className="text-slate-900" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate">{n.text}</span>
                <span className="block text-[11px] opacity-70">Multiwarehouse · ketuk untuk lihat</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <WorkspaceSidebar sections={visibleSections} activeView={view} onViewChange={handleViewChange} templateUploaded={templateUploaded} />
      <main className="flex-1 flex flex-col overflow-hidden pb-[60px] md:pb-0">
        {/* Mobile sub-nav: items of the active section + logout (pr-12 clears the fixed bell) */}
        <div className="md:hidden flex items-center gap-1.5 pl-3 pr-12 py-2 border-b border-slate-200 bg-white shrink-0">
          <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-thin">
            {activeSection.items.map((item) => {
              const isActive = view === item.id;
              return (
                <a
                  key={item.id}
                  href={viewHref(item.id)}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                    e.preventDefault();
                    handleViewChange(item.id);
                  }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive ? "bg-brand text-slate-900" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.shortLabel ?? item.label}
                </a>
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

function NotifRow({ n, unread, onClick }: { n: AppNotification; unread: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-start gap-2 text-left px-4 py-2.5 hover:bg-slate-50 transition-colors">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${unread ? "bg-brand" : "bg-transparent"}`} />
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-900 truncate">{n.title}</span>
          <span className="text-[10px] text-slate-400 shrink-0">{relativeTime(n.created_at)}</span>
        </span>
        {n.body && <span className="block text-xs text-slate-500 mt-0.5 truncate">{n.body}</span>}
        {n.actor_name && <span className="block text-[10px] text-slate-400 mt-0.5">oleh {n.actor_name}</span>}
      </span>
    </button>
  );
}
