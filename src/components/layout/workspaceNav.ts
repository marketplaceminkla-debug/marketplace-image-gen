import {
  LayoutDashboard, Gauge, TrendingUp, ListChecks,
  Boxes, PackagePlus, Tag, Percent, ArrowLeftRight,
  Warehouse, ClipboardList, Building2, PackageX,
  Wrench, LayoutTemplate, FileSpreadsheet, Zap, PackageOpen,
  ShieldCheck, Users, FileText, BarChart2, Award,
  type LucideIcon,
} from "lucide-react";

export type ViewId =
  | "dash-overview" | "dash-revenue" | "dash-tal" | "dash-kpi" | "dash-report" | "dash-monitoring"
  | "prod-new" | "prod-price" | "prod-fee" | "prod-sku"
  | "wh-orders" | "wh-list"
  | "stock-returns"
  | "ps-template" | "ps-import" | "ps-generate" | "ps-shopee" | "ps-ziptoshopee"
  | "admin-users";

export interface NavItem {
  id: ViewId;
  label: string;
  shortLabel?: string;
  description?: string;
  icon: LucideIcon;
  /** Optional sub-group label shown above the item (e.g. a tool name). */
  group?: string;
}

export interface NavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "dash-overview", label: "Overview / KPI", shortLabel: "Overview", description: "Ringkasan performa tim", icon: Gauge },
      { id: "dash-revenue", label: "Revenue", shortLabel: "Revenue", description: "Target & progress harian", icon: TrendingUp },
      { id: "dash-tal", label: "TAL", shortLabel: "TAL", description: "To Achieve List", icon: ListChecks },
      { id: "dash-kpi", label: "KPI Tim", shortLabel: "KPI", description: "Capaian KPI per anggota", icon: Award },
      { id: "dash-report", label: "Report Harian", shortLabel: "Report", description: "Input laporan harian per toko", icon: FileText },
      { id: "dash-monitoring", label: "Monitoring Tren", shortLabel: "Tren", description: "Analitik MoM & YoY", icon: BarChart2 },
    ],
  },
  {
    id: "product",
    label: "Product Listing",
    icon: Boxes,
    items: [
      { id: "prod-new", label: "New Product", shortLabel: "New", description: "Input produk + status upload", icon: PackagePlus },
      { id: "prod-price", label: "Update Harga", shortLabel: "Harga", description: "Riwayat perubahan harga", icon: Tag },
      { id: "prod-fee", label: "Database Fee", shortLabel: "Fee", description: "Fee tiap marketplace", icon: Percent },
      { id: "prod-sku", label: "SKU Pengganti", shortLabel: "SKU", description: "SKU lama → pengganti / EOL", icon: ArrowLeftRight },
    ],
  },
  {
    id: "warehouse",
    label: "Multiwarehouse",
    icon: Warehouse,
    items: [
      { id: "wh-orders", label: "Orderan", shortLabel: "Order", description: "List order + kirim WA", icon: ClipboardList },
      { id: "wh-list", label: "Database Gudang", shortLabel: "Gudang", description: "Nomor WA cabang", icon: Building2 },
    ],
  },
  {
    id: "stock",
    label: "Stock Management",
    icon: PackageX,
    items: [
      { id: "stock-returns", label: "Retur & Gagal Kirim", shortLabel: "Retur", description: "Retur & pengiriman gagal", icon: PackageX },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    items: [
      { id: "ps-template", label: "Upload Template", shortLabel: "Template", description: "Frame & branding", icon: LayoutTemplate, group: "PixelSeller" },
      { id: "ps-import", label: "Import Excel", shortLabel: "Import", description: "Foto + judul dari Excel", icon: FileSpreadsheet, group: "PixelSeller" },
      { id: "ps-generate", label: "Generate Images", shortLabel: "Generate", description: "Bulk processing", icon: Zap, group: "PixelSeller" },
      { id: "ps-shopee", label: "Template Shopee", shortLabel: "Shopee", description: "Excel Mass Upload", icon: FileSpreadsheet, group: "PixelSeller" },
      { id: "ps-ziptoshopee", label: "Import ZIP → Shopee", shortLabel: "ZIP", description: "ZIP lama → Excel Shopee", icon: PackageOpen, group: "PixelSeller" },
    ],
  },
];

/** Super-admin-only section for managing user accounts and access. */
export const ADMIN_SECTION: NavSection = {
  id: "admin",
  label: "Admin",
  icon: ShieldCheck,
  items: [
    { id: "admin-users", label: "Kelola Akun", shortLabel: "Akun", description: "User & hak akses", icon: Users },
  ],
};

export function findSection(view: ViewId, sections: NavSection[] = NAV): NavSection {
  return sections.find((s) => s.items.some((i) => i.id === view)) ?? sections[0];
}
