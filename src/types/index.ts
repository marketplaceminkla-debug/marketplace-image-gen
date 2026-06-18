export interface ProcessingSettings {
  outputWidth: number;
  outputHeight: number;
  outputQuality: number;
  outputPrefix: string;
}

export interface TemplateData {
  id: string;
  name: string;        // e.g. "KLA Computer", "Gadget Klik"
  filename: string;
  uploadedAt: string;
  size: number;
  dataUrl: string;
}

export interface ShopeeTemplateData {
  id: string;
  name: string;
  filename: string;
  uploadedAt: string;
  size: number;
  publicUrl: string; // public URL of the raw .xlsx file in Supabase Storage
}

export interface TextLayerItem {
  text: string;
  x: number;   // 0-1 relative
  y: number;   // 0-1 relative
  fontSize: number;
  color: string;
  fontFamily: string;
}

export interface TextLayer {
  title: TextLayerItem;
  subtitle: TextLayerItem;
}

export interface ImageTransform {
  scale: number;
  x: number;
  y: number;
  cropX?: number;   // 0-1 relative crop start x
  cropY?: number;   // 0-1 relative crop start y
  cropW?: number;   // 0-1 relative crop width
  cropH?: number;   // 0-1 relative crop height
}

// Element overlay (stickers, logos, bonus images, etc.)
export interface OverlayElement {
  id: string;
  dataUrl: string;
  name: string;
  x: number;      // 0-1 relative center x
  y: number;      // 0-1 relative center y
  scale: number;  // 0.1 - 3.0
  rotation: number; // degrees
}

export interface ProductImage {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  status: "pending" | "processing" | "done" | "error";
  errorMessage?: string;
  transform?: ImageTransform;
  textLayer?: TextLayer;
  elements?: OverlayElement[];
  resultUrl?: string;
  spekLengkap?: string; // from Excel col D — used for TXT description output
  judul?: string;       // from Excel col B — used for TXT filename & cover text
  namaProduk?: string;  // from Excel col E — used as Shopee "Nama Produk"
}

export const FONT_OPTIONS = [
  { label: "Inter (Default)", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Oswald (Bold)", value: "Oswald, sans-serif" },
  { label: "Playfair Display", value: "Playfair Display, serif" },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Raleway", value: "Raleway, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Source Sans Pro", value: "Source Sans Pro, sans-serif" },
  { label: "Open Sans", value: "Open Sans, sans-serif" },
  { label: "DM Sans", value: "DM Sans, sans-serif" },
  { label: "Space Grotesk", value: "Space Grotesk, sans-serif" },
  { label: "Bebas Neue (Display)", value: "Bebas Neue, cursive" },
  { label: "Anton (Impact)", value: "Anton, sans-serif" },
];

export const DEFAULT_TEXT_LAYER: TextLayer = {
  title: {
    text: "",
    x: 0.5, y: 0.67,
    fontSize: 45,
    color: "#000000",
    fontFamily: "Poppins, sans-serif",
  },
  subtitle: {
    text: "",
    x: 0.5, y: 0.79,
    fontSize: 30,
    color: "#000000",
    fontFamily: "Inter, sans-serif",
  },
};

export const DEFAULT_SETTINGS: ProcessingSettings = {
  outputWidth: 720,
  outputHeight: 1108,
  outputQuality: 90,
  outputPrefix: "cover_produk",
};

export const MARKETPLACE_PRESETS: Record<string, { width: number; height: number; label: string }> = {
  shopee_portrait: { width: 720, height: 1108, label: "Shopee Portrait (2:3)" },
  shopee_square: { width: 1000, height: 1000, label: "Shopee Square (1:1)" },
  tokopedia: { width: 1000, height: 1000, label: "Tokopedia (1:1)" },
  tiktok_shop: { width: 800, height: 800, label: "TikTok Shop (1:1)" },
  custom: { width: 720, height: 1108, label: "Custom Size" },
};

// ─── Description template (stored in localStorage) ───────────────────────────
export interface DescriptionTemplate {
  id: string;
  name: string;         // e.g. "KLA Computer"
  templateText: string; // full template with {{SPEK_LENGKAP}} placeholder
  createdAt: string;
}

// ─── Template assignment rule ─────────────────────────────────────────────────
export interface TemplateRule {
  id: string;
  templateId: string;   // TemplateData.id
  templateName: string;
  photoNumbers: number[]; // 1-based indices into the images array
}
