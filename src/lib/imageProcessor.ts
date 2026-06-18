/**
 * imageProcessor.ts
 *
 * Canvas compositing and image utilities.
 * Template storage has been moved to templateStorage.ts (Supabase-backed).
 * Re-exports from templateStorage so existing imports still work.
 */

// ─── Re-export template storage (keeps old import paths working) ──────────────
export {
  getAllTemplates,
  getActiveTemplate,
  setActiveTemplate,
  saveTemplate,
  deleteTemplate,
} from "./templateStorage";

// ─── Types (kept here — shared across the app) ───────────────────────────────
export interface ProcessingSettings {
  outputWidth: number;
  outputHeight: number;
  outputQuality: number;
  outputPrefix: string;
}

export interface ImageTransform {
  scale: number;
  x: number;
  y: number;
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

export interface TextLayerItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
}

export interface TextLayer {
  title: TextLayerItem;
  subtitle: TextLayerItem;
}

export interface OverlayElement {
  id: string;
  dataUrl: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

// ─── Image helpers ────────────────────────────────────────────────────────────
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar"));
    img.src = src;
    img.crossOrigin = "anonymous";
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Draw single text item (supports multiline with \n) ──────────────────────
export function drawTextItem(
  ctx: CanvasRenderingContext2D,
  item: TextLayerItem,
  canvasW: number,
  canvasH: number,
  scale: number = 1
) {
  if (!item.text) return;
  const cx = item.x * canvasW;
  const cy = item.y * canvasH;
  const fontSize = item.fontSize * scale;
  const font = `bold ${fontSize}px ${item.fontFamily}`;
  const lineHeight = fontSize * 1.3;

  ctx.font = font;
  ctx.fillStyle = item.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 1;

  const lines = item.text.split("\n");
  const totalH = lines.length * lineHeight;
  const startY = cy - totalH / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineHeight);
  });
}

// ─── Draw overlay element ─────────────────────────────────────────────────────
export async function drawOverlayElement(
  ctx: CanvasRenderingContext2D,
  el: OverlayElement,
  canvasW: number,
  canvasH: number
) {
  const img = await loadImage(el.dataUrl);
  const cx = el.x * canvasW;
  const cy = el.y * canvasH;
  const baseSize = Math.min(canvasW, canvasH) * 0.2;
  const aspect = img.naturalWidth / img.naturalHeight;
  const w = baseSize * el.scale * (aspect >= 1 ? 1 : aspect);
  const h = baseSize * el.scale * (aspect >= 1 ? 1 / aspect : 1);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// ─── Core composite (used for actual export) ─────────────────────────────────
export async function compositeImage(
  productDataUrl: string,
  templateDataUrl: string,
  settings: ProcessingSettings,
  transform?: ImageTransform,
  textLayer?: TextLayer,
  elements?: OverlayElement[]
): Promise<Blob> {
  const { outputWidth: W, outputHeight: H, outputQuality } = settings;

  await loadGoogleFonts(textLayer);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const productImg = await loadImage(productDataUrl);

  // Apply crop if set
  const cropX = transform?.cropX ?? 0;
  const cropY = transform?.cropY ?? 0;
  const cropW = transform?.cropW ?? 1;
  const cropH = transform?.cropH ?? 1;

  const srcX = cropX * productImg.naturalWidth;
  const srcY = cropY * productImg.naturalHeight;
  const srcW = cropW * productImg.naturalWidth;
  const srcH = cropH * productImg.naturalHeight;

  const croppedAspect = srcW / srcH;

  if (transform && (transform.scale !== 1 || transform.x !== 0 || transform.y !== 0)) {
    const fitScale = Math.min(
      (W * 0.9) / srcW,
      (H * 0.9) / srcH
    );
    ctx.save();
    ctx.translate(W / 2 + transform.x, H / 2 + transform.y);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(
      productImg,
      srcX, srcY, srcW, srcH,
      -srcW * fitScale / 2,
      -srcH * fitScale / 2,
      srcW * fitScale,
      srcH * fitScale
    );
    ctx.restore();
  } else {
    const pad = W * 0.05;
    const s = Math.min((W - pad * 2) / srcW, (H - pad * 2) / srcH);
    const fw = srcW * s, fh = srcH * s;
    ctx.drawImage(
      productImg,
      srcX, srcY, srcW, srcH,
      (W - fw) / 2, (H - fh) / 2, fw, fh
    );
  }

  const templateImg = await loadImage(templateDataUrl);
  ctx.drawImage(templateImg, 0, 0, W, H);

  // Draw overlay elements
  if (elements && elements.length > 0) {
    for (const el of elements) {
      await drawOverlayElement(ctx, el, W, H);
    }
  }

  if (textLayer) {
    drawTextItem(ctx, textLayer.title, W, H, 1);
    drawTextItem(ctx, textLayer.subtitle, W, H, 1);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error("Export gagal")); },
      "image/jpeg",
      outputQuality / 100
    );
  });
}

// ─── Preload Google Fonts ─────────────────────────────────────────────────────
const loadedFonts = new Set<string>();
export async function loadGoogleFonts(textLayer?: TextLayer) {
  const fonts: string[] = [];
  if (textLayer?.title.fontFamily) fonts.push(textLayer.title.fontFamily.split(",")[0].trim());
  if (textLayer?.subtitle.fontFamily) fonts.push(textLayer.subtitle.fontFamily.split(",")[0].trim());

  const toLoad = Array.from(new Set(fonts)).filter(f => !loadedFonts.has(f) && f !== "Inter");
  if (toLoad.length === 0) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${toLoad.map(f => `family=${f.replace(/ /g, "+")}`).join("&")}&display=swap`;
  document.head.appendChild(link);
  toLoad.forEach(f => loadedFonts.add(f));
  await new Promise(r => setTimeout(r, 600));
}

export function getOutputFilename(prefix: string, index: number, total: number): string {
  const padded = String(index + 1).padStart(Math.max(String(total).length, 2), "0");
  return `${prefix}_${padded}.jpg`;
}
