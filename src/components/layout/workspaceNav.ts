import {
  LayoutDashboard, Gauge, TrendingUp, ListChecks,
  Boxes, PackagePlus, Tag, Percent,
  Wrench, LayoutTemplate, FileSpreadsheet, Zap, PackageOpen,
  type LucideIcon,
} from "lucide-react";

export type ViewId =
  | "dash-overview" | "dash-revenue" | "dash-tal"
  | "prod-new" | "prod-price" | "prod-fee"
  | "ps-template" | "ps-import" | "ps-generate" | "ps-shopee" | "ps-ziptoshopee";

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
      { id: "dash-tal", label: "TAL", shortLabel: "TAL", description: "Total Active Listing", icon: ListChecks },
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

export function findSection(view: ViewId): NavSection {
  return NAV.find((s) => s.items.some((i) => i.id === view)) ?? NAV[0];
}

export function findItem(view: ViewId): NavItem {
  for (const s of NAV) {
    const item = s.items.find((i) => i.id === view);
    if (item) return item;
  }
  return NAV[0].items[0];
}
