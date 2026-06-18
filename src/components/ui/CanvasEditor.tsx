"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, ZoomIn, ZoomOut, RotateCcw, Check, Crop, Upload,
  Trash2, RotateCw, Move, ChevronUp, ChevronDown
} from "lucide-react";
import { ProductImage, DEFAULT_TEXT_LAYER, FONT_OPTIONS, OverlayElement } from "@/types";
import {
  ImageTransform, TextLayer, TextLayerItem,
  loadImage, drawTextItem, loadGoogleFonts, drawOverlayElement,
} from "@/lib/imageProcessor";
import { generateId } from "@/lib/utils";

interface CanvasEditorProps {
  image: ProductImage;
  templateDataUrl: string;
  outputWidth: number;
  outputHeight: number;
  onSave: (id: string, transform: ImageTransform, textLayer: TextLayer, elements: OverlayElement[]) => void;
  onClose: () => void;
}

type ActiveLayer = "photo" | "title" | "subtitle" | "elements";

const DISPLAY = 400;

export default function CanvasEditor({
  image, templateDataUrl, outputWidth, outputHeight, onSave, onClose,
}: CanvasEditorProps) {
  const aspect = outputWidth / outputHeight;
  const dispW = aspect >= 1 ? DISPLAY : DISPLAY * aspect;
  const dispH = aspect >= 1 ? DISPLAY / aspect : DISPLAY;
  const scaleD = dispW / outputWidth;

  const [activeLayer, setActiveLayer] = useState<ActiveLayer>("photo");
  const [transform, setTransform] = useState<ImageTransform>(
    image.transform ?? { scale: 1, x: 0, y: 0 }
  );
  const [textLayer, setTextLayer] = useState<TextLayer>(
    image.textLayer ?? {
      ...DEFAULT_TEXT_LAYER,
      title: { ...DEFAULT_TEXT_LAYER.title },
      subtitle: { ...DEFAULT_TEXT_LAYER.subtitle },
    }
  );
  const [elements, setElements] = useState<OverlayElement[]>(image.elements ?? []);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState({
    x: transform.cropX ?? 0,
    y: transform.cropY ?? 0,
    w: transform.cropW ?? 1,
    h: transform.cropH ?? 1,
  });
  const [cropDragStart, setCropDragStart] = useState<{ mx: number; my: number; handle: string } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);
  const productImgRef = useRef<HTMLImageElement | null>(null);
  const elementImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    loadImage(templateDataUrl).then(img => { templateImgRef.current = img; scheduleRender(); });
    loadImage(image.previewUrl).then(img => { productImgRef.current = img; scheduleRender(); });
    loadGoogleFonts(textLayer);
  }, []);

  // Preload element images
  useEffect(() => {
    elements.forEach(el => {
      if (!elementImgsRef.current.has(el.id)) {
        loadImage(el.dataUrl).then(img => {
          elementImgsRef.current.set(el.id, img);
          scheduleRender();
        });
      }
    });
  }, [elements]);

  useEffect(() => { scheduleRender(); }, [transform, textLayer, activeLayer, elements, selectedElementId, isCropping, cropRect]);

  const scheduleRender = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderCanvas);
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, dispW, dispH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, dispW, dispH);

    const prod = productImgRef.current;
    if (prod) {
      // Use crop values (or full image if no crop)
      const cx0 = (isCropping ? cropRect.x : (transform.cropX ?? 0));
      const cy0 = (isCropping ? cropRect.y : (transform.cropY ?? 0));
      const cw0 = (isCropping ? cropRect.w : (transform.cropW ?? 1));
      const ch0 = (isCropping ? cropRect.h : (transform.cropH ?? 1));

      const srcX = cx0 * prod.naturalWidth;
      const srcY = cy0 * prod.naturalHeight;
      const srcW = cw0 * prod.naturalWidth;
      const srcH = ch0 * prod.naturalHeight;

      if (transform.scale !== 1 || transform.x !== 0 || transform.y !== 0) {
        const fitScale = Math.min((dispW * 0.9) / srcW, (dispH * 0.9) / srcH);
        ctx.save();
        ctx.translate(dispW / 2 + transform.x * scaleD, dispH / 2 + transform.y * scaleD);
        ctx.scale(transform.scale, transform.scale);
        ctx.drawImage(prod, srcX, srcY, srcW, srcH,
          -srcW * fitScale / 2, -srcH * fitScale / 2,
          srcW * fitScale, srcH * fitScale);
        ctx.restore();
      } else {
        const pad = dispW * 0.05;
        const s = Math.min((dispW - pad * 2) / srcW, (dispH - pad * 2) / srcH);
        ctx.drawImage(prod, srcX, srcY, srcW, srcH,
          (dispW - s * srcW) / 2, (dispH - s * srcH) / 2,
          s * srcW, s * srcH);
      }

      // Draw crop overlay
      if (isCropping) {
        // Darken outside crop region
        const rx = cropRect.x * dispW;
        const ry = cropRect.y * dispH;
        const rw = cropRect.w * dispW;
        const rh = cropRect.h * dispH;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, dispW, ry);
        ctx.fillRect(0, ry + rh, dispW, dispH - ry - rh);
        ctx.fillRect(0, ry, rx, rh);
        ctx.fillRect(rx + rw, ry, dispW - rx - rw, rh);
        // Crop border
        ctx.strokeStyle = "#F5C200";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.strokeRect(rx, ry, rw, rh);
        // Rule-of-thirds grid
        ctx.strokeStyle = "rgba(245,194,0,0.35)";
        ctx.lineWidth = 0.75;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(rx + rw * i / 3, ry); ctx.lineTo(rx + rw * i / 3, ry + rh); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(rx, ry + rh * i / 3); ctx.lineTo(rx + rw, ry + rh * i / 3); ctx.stroke();
        }
        // Corner handles
        const hs = 8;
        ctx.fillStyle = "#F5C200";
        const corners = [
          [rx, ry], [rx + rw - hs, ry],
          [rx, ry + rh - hs], [rx + rw - hs, ry + rh - hs],
        ];
        corners.forEach(([hx, hy]) => ctx.fillRect(hx, hy, hs, hs));
        ctx.restore();
      }
    }

    const tmpl = templateImgRef.current;
    if (tmpl && !isCropping) ctx.drawImage(tmpl, 0, 0, dispW, dispH);

    // Draw elements
    if (!isCropping) {
      elements.forEach(el => {
        const img = elementImgsRef.current.get(el.id);
        if (!img) return;
        const ecx = el.x * dispW;
        const ecy = el.y * dispH;
        const baseSize = Math.min(dispW, dispH) * 0.2;
        const elAspect = img.naturalWidth / img.naturalHeight;
        const ew = baseSize * el.scale * (elAspect >= 1 ? 1 : elAspect);
        const eh = baseSize * el.scale * (elAspect >= 1 ? 1 / elAspect : 1);
        ctx.save();
        ctx.translate(ecx, ecy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.drawImage(img, -ew / 2, -eh / 2, ew, eh);
        // Selection border
        if (selectedElementId === el.id) {
          ctx.strokeStyle = "#6366F1";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(-ew / 2 - 3, -eh / 2 - 3, ew + 6, eh + 6);
          ctx.setLineDash([]);
        }
        ctx.restore();
      });

      drawTextItem(ctx, textLayer.title, dispW, dispH, scaleD);
      drawTextItem(ctx, textLayer.subtitle, dispW, dispH, scaleD);
    }

    // Active layer border
    if (!isCropping) {
      const colors: Record<ActiveLayer, string> = {
        photo: "rgba(245,194,0,0.7)",
        title: "rgba(99,102,241,0.7)",
        subtitle: "rgba(16,185,129,0.7)",
        elements: "rgba(239,68,68,0.7)",
      };
      ctx.strokeStyle = colors[activeLayer];
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(1, 1, dispW - 2, dispH - 2);
      ctx.setLineDash([]);

      if (activeLayer === "title" && textLayer.title.text) {
        const tcx = textLayer.title.x * dispW, tcy = textLayer.title.y * dispH;
        ctx.strokeStyle = "rgba(99,102,241,0.9)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(tcx, tcy, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (activeLayer === "subtitle" && textLayer.subtitle.text) {
        const scx = textLayer.subtitle.x * dispW, scy = textLayer.subtitle.y * dispH;
        ctx.strokeStyle = "rgba(16,185,129,0.9)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(scx, scy, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [transform, textLayer, activeLayer, elements, selectedElementId, isCropping, cropRect, dispW, dispH, scaleD]);

  // ─── Crop drag logic ───────────────────────────────────────────────────────
  const getCropHandle = (mx: number, my: number): string => {
    const hs = 12;
    const rx = cropRect.x * dispW, ry = cropRect.y * dispH;
    const rw = cropRect.w * dispW, rh = cropRect.h * dispH;
    if (mx >= rx - hs && mx <= rx + hs && my >= ry - hs && my <= ry + hs) return "nw";
    if (mx >= rx + rw - hs && mx <= rx + rw + hs && my >= ry - hs && my <= ry + hs) return "ne";
    if (mx >= rx - hs && mx <= rx + hs && my >= ry + rh - hs && my <= ry + rh + hs) return "sw";
    if (mx >= rx + rw - hs && mx <= rx + rw + hs && my >= ry + rh - hs && my <= ry + rh + hs) return "se";
    if (mx >= rx && mx <= rx + rw && my >= ry && my <= ry + rh) return "move";
    return "none";
  };

  // ─── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isCropping) {
      const handle = getCropHandle(mx, my);
      if (handle !== "none") {
        setCropDragStart({ mx, my, handle });
      }
      return;
    }

    setIsDragging(true);

    // Check if clicking on an element first
    if (activeLayer === "elements") {
      // Find topmost element under cursor
      const hit = [...elements].reverse().find(el => {
        const img = elementImgsRef.current.get(el.id);
        if (!img) return false;
        const ecx = el.x * dispW, ecy = el.y * dispH;
        const baseSize = Math.min(dispW, dispH) * 0.2;
        const elAspect = img.naturalWidth / img.naturalHeight;
        const ew = baseSize * el.scale * (elAspect >= 1 ? 1 : elAspect);
        const eh = baseSize * el.scale * (elAspect >= 1 ? 1 / elAspect : 1);
        return mx >= ecx - ew / 2 && mx <= ecx + ew / 2 && my >= ecy - eh / 2 && my <= ecy + eh / 2;
      });
      if (hit) {
        setSelectedElementId(hit.id);
        dragRef.current = { mx, my, ox: hit.x * dispW, oy: hit.y * dispH };
      } else {
        setSelectedElementId(null);
        dragRef.current = null;
      }
      return;
    }

    if (activeLayer === "photo") {
      dragRef.current = { mx, my, ox: transform.x, oy: transform.y };
    } else if (activeLayer === "title") {
      dragRef.current = { mx, my, ox: textLayer.title.x * dispW, oy: textLayer.title.y * dispH };
    } else if (activeLayer === "subtitle") {
      dragRef.current = { mx, my, ox: textLayer.subtitle.x * dispW, oy: textLayer.subtitle.y * dispH };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isCropping && cropDragStart) {
      const dx = (mx - cropDragStart.mx) / dispW;
      const dy = (my - cropDragStart.my) / dispH;
      const MIN = 0.05;
      setCropRect(cr => {
        let { x, y, w, h } = cr;
        const h0 = getCropHandle(cropDragStart.mx, cropDragStart.my);
        if (h0 === "move") {
          x = Math.max(0, Math.min(1 - w, (cropDragStart.mx / dispW - w / 2) + dx + w / 2 - (cropDragStart.mx / dispW - cr.x)));
          y = Math.max(0, Math.min(1 - h, (cropDragStart.my / dispH - h / 2) + dy + h / 2 - (cropDragStart.my / dispH - cr.y)));
          // simpler: just offset
          x = Math.max(0, Math.min(1 - cr.w, cr.x + dx));
          y = Math.max(0, Math.min(1 - cr.h, cr.y + dy));
          return { x, y, w: cr.w, h: cr.h };
        }
        if (h0 === "nw") {
          const nx = Math.max(0, Math.min(x + w - MIN, x + dx));
          const ny = Math.max(0, Math.min(y + h - MIN, y + dy));
          return { x: nx, y: ny, w: x + w - nx, h: y + h - ny };
        }
        if (h0 === "ne") {
          const ny = Math.max(0, Math.min(y + h - MIN, y + dy));
          const nw = Math.max(MIN, Math.min(1 - x, w + dx));
          return { x, y: ny, w: nw, h: y + h - ny };
        }
        if (h0 === "sw") {
          const nx = Math.max(0, Math.min(x + w - MIN, x + dx));
          const nh = Math.max(MIN, Math.min(1 - y, h + dy));
          return { x: nx, y, w: x + w - nx, h: nh };
        }
        if (h0 === "se") {
          const nw = Math.max(MIN, Math.min(1 - x, w + dx));
          const nh = Math.max(MIN, Math.min(1 - y, h + dy));
          return { x, y, w: nw, h: nh };
        }
        return cr;
      });
      setCropDragStart({ mx, my, handle: cropDragStart.handle });
      return;
    }

    if (!isDragging || !dragRef.current) return;
    const dx = mx - dragRef.current.mx;
    const dy = my - dragRef.current.my;

    if (activeLayer === "elements" && selectedElementId) {
      setElements(prev => prev.map(el =>
        el.id === selectedElementId
          ? { ...el, x: Math.max(0, Math.min(1, (dragRef.current!.ox + dx) / dispW)), y: Math.max(0, Math.min(1, (dragRef.current!.oy + dy) / dispH)) }
          : el
      ));
    } else if (activeLayer === "photo") {
      setTransform(t => ({ ...t, x: (dragRef.current!.ox + dx) / scaleD, y: (dragRef.current!.oy + dy) / scaleD }));
    } else if (activeLayer === "title") {
      const nx = Math.max(0.02, Math.min(0.98, (dragRef.current!.ox + dx) / dispW));
      const ny = Math.max(0.02, Math.min(0.98, (dragRef.current!.oy + dy) / dispH));
      setTextLayer(t => ({ ...t, title: { ...t.title, x: nx, y: ny } }));
    } else if (activeLayer === "subtitle") {
      const nx = Math.max(0.02, Math.min(0.98, (dragRef.current!.ox + dx) / dispW));
      const ny = Math.max(0.02, Math.min(0.98, (dragRef.current!.oy + dy) / dispH));
      setTextLayer(t => ({ ...t, subtitle: { ...t.subtitle, x: nx, y: ny } }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setCropDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isCropping) return;
    if (activeLayer === "photo") {
      e.preventDefault();
      setTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(5, t.scale + (e.deltaY > 0 ? -0.05 : 0.05))) }));
    } else if (activeLayer === "elements" && selectedElementId) {
      e.preventDefault();
      setElements(prev => prev.map(el =>
        el.id === selectedElementId
          ? { ...el, scale: Math.max(0.1, Math.min(5, el.scale + (e.deltaY > 0 ? -0.05 : 0.05))) }
          : el
      ));
    }
  };

  const applyCrop = () => {
    setTransform(t => ({ ...t, cropX: cropRect.x, cropY: cropRect.y, cropW: cropRect.w, cropH: cropRect.h, x: 0, y: 0, scale: 1 }));
    setIsCropping(false);
  };

  const resetCrop = () => {
    const reset = { x: 0, y: 0, w: 1, h: 1 };
    setCropRect(reset);
    setTransform(t => ({ ...t, cropX: 0, cropY: 0, cropW: 1, cropH: 1 }));
    setIsCropping(false);
  };

  // Text layer helpers
  const updateTitle = (patch: Partial<TextLayerItem>) => {
    setTextLayer(t => ({ ...t, title: { ...t.title, ...patch } }));
    if (patch.fontFamily) loadGoogleFonts({ title: { ...textLayer.title, ...patch }, subtitle: textLayer.subtitle });
  };
  const updateSubtitle = (patch: Partial<TextLayerItem>) => {
    setTextLayer(t => ({ ...t, subtitle: { ...t.subtitle, ...patch } }));
    if (patch.fontFamily) loadGoogleFonts({ title: textLayer.title, subtitle: { ...textLayer.subtitle, ...patch } });
  };

  // Elements helpers
  const handleElementUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const el: OverlayElement = {
          id: generateId(),
          dataUrl: reader.result as string,
          name: file.name.replace(/\.[^.]+$/, ""),
          x: 0.5, y: 0.5,
          scale: 1,
          rotation: 0,
        };
        setElements(prev => [...prev, el]);
        setSelectedElementId(el.id);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const updateElement = (id: string, patch: Partial<OverlayElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const selectedEl = elements.find(el => el.id === selectedElementId) ?? null;

  const layerTabs: { id: ActiveLayer; label: string; color: string }[] = [
    { id: "photo", label: "📷 Foto", color: "#F5C200" },
    { id: "title", label: "T Judul", color: "#6366F1" },
    { id: "subtitle", label: "t Spek", color: "#10B981" },
    { id: "elements", label: "＋ Elemen", color: "#EF4444" },
  ];

  const getCursor = () => {
    if (isCropping) return "crosshair";
    if (isDragging) return "grabbing";
    return "grab";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex max-w-5xl w-full mx-4 max-h-[96vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Canvas side */}
        <div className="flex flex-col bg-slate-100 shrink-0" style={{ width: dispW + 32 }}>
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700 truncate max-w-[200px]">{image.name}</p>
            <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
              <X size={14} />
            </button>
          </div>

          {isCropping && (
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-700">Mode Crop — drag sudut untuk resize</p>
              <div className="flex gap-1.5">
                <button onClick={resetCrop} className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Reset</button>
                <button onClick={applyCrop} className="px-2.5 py-1 text-xs rounded-lg text-white font-semibold" style={{ background: "#4B2D9F" }}>Terapkan</button>
              </div>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center p-4">
            <canvas
              ref={canvasRef}
              width={dispW}
              height={dispH}
              style={{
                width: dispW,
                height: dispH,
                cursor: getCursor(),
                borderRadius: 8,
                boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />
          </div>

          {/* Layer tabs */}
          <div className="px-4 pb-3 flex gap-1.5">
            {layerTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveLayer(tab.id); setIsCropping(false); }}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all"
                style={
                  activeLayer === tab.id
                    ? { background: tab.color, color: tab.id === "photo" ? "#1e1b4b" : "#fff" }
                    : { background: "#F1F5F9", color: "#64748B" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Controls side */}
        <div className="flex-1 overflow-auto min-w-0" style={{ maxWidth: 340 }}>
          <div className="p-5 space-y-4">

            {/* ── PHOTO LAYER ─────────────────────────────────── */}
            {activeLayer === "photo" && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">📷 Layer Foto</p>
                <p className="text-xs text-slate-400">Drag canvas untuk geser · Scroll untuk zoom</p>

                {/* Zoom */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">Zoom</span>
                    <span className="text-xs font-bold text-indigo-600">{Math.round(transform.scale * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.1, t.scale - 0.1) }))}
                      className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50">
                      <ZoomOut size={12} />
                    </button>
                    <input type="range" min={10} max={500} value={Math.round(transform.scale * 100)}
                      onChange={e => setTransform(t => ({ ...t, scale: +e.target.value / 100 }))}
                      className="flex-1" style={{ accentColor: "#4B2D9F" }} />
                    <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(5, t.scale + 0.1) }))}
                      className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50">
                      <ZoomIn size={12} />
                    </button>
                  </div>
                </div>

                {/* Crop */}
                <div className="border border-slate-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">✂️ Crop Foto</p>
                    {(transform.cropW && transform.cropW < 1) || (transform.cropH && transform.cropH < 1) ? (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Aktif</span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-400">Drag sudut/sisi kotak kuning di canvas untuk memotong foto.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsCropping(!isCropping);
                        if (!isCropping) {
                          setCropRect({
                            x: transform.cropX ?? 0,
                            y: transform.cropY ?? 0,
                            w: transform.cropW ?? 1,
                            h: transform.cropH ?? 1,
                          });
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors"
                      style={isCropping
                        ? { background: "#FEF3C7", color: "#92400E", border: "1px solid #F5C200" }
                        : { background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" }}
                    >
                      <Crop size={12} /> {isCropping ? "Batal Crop" : "Mulai Crop"}
                    </button>
                    <button
                      onClick={resetCrop}
                      className="px-3 py-2 text-xs border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Reset
                    </button>
                  </div>
                  {isCropping && (
                    <button
                      onClick={applyCrop}
                      className="w-full py-2 text-xs font-bold text-white rounded-lg"
                      style={{ background: "#4B2D9F" }}
                    >
                      ✓ Terapkan Crop
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setTransform({ scale: 1, x: 0, y: 0 })}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw size={12} /> Reset Posisi & Zoom
                </button>
              </div>
            )}

            {/* ── TEXT LAYERS ─────────────────────────────────── */}
            {(activeLayer === "title" || activeLayer === "subtitle") && (() => {
              const isTitle = activeLayer === "title";
              const activeItem = isTitle ? textLayer.title : textLayer.subtitle;
              const updateActive = isTitle ? updateTitle : updateSubtitle;
              const color = isTitle ? "#6366F1" : "#10B981";
              const label = isTitle ? "T Judul Produk" : "t Spek Singkat";
              const placeholder = isTitle ? "cth: ASUS VivoBook 14" : "cth: i5 · 8GB · 512GB SSD\nWindows 11 Original";

              return (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>{label}</p>
                  <p className="text-xs text-slate-400">Drag canvas untuk pindah posisi teks</p>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {isTitle ? "Teks Judul" : "Teks Spek"}
                      {!isTitle && <span className="text-slate-400 font-normal ml-1">(Enter = baris baru)</span>}
                    </label>
                    {isTitle ? (
                      <input
                        value={activeItem.text}
                        onChange={e => updateActive({ text: e.target.value })}
                        placeholder={placeholder}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400"
                      />
                    ) : (
                      <textarea
                        value={activeItem.text}
                        onChange={e => updateActive({ text: e.target.value })}
                        placeholder={placeholder}
                        rows={3}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 resize-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Font</label>
                    <select
                      value={activeItem.fontFamily}
                      onChange={e => updateActive({ fontFamily: e.target.value })}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                    >
                      {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Ukuran Font</label>
                      <input
                        type="number" min={10} max={200} value={activeItem.fontSize}
                        onChange={e => updateActive({ fontSize: +e.target.value })}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Warna Teks</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color" value={activeItem.color}
                          onChange={e => updateActive({ color: e.target.value })}
                          className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-400">{activeItem.color}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── ELEMENTS LAYER ──────────────────────────────── */}
            {activeLayer === "elements" && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">＋ Tambah Elemen</p>
                <p className="text-xs text-slate-400">Upload gambar kecil (logo, badge bonus, stiker, dll). Drag di canvas untuk pindah · Scroll untuk resize.</p>

                {/* Upload button */}
                <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-red-400 hover:bg-red-50/30 cursor-pointer transition-colors">
                  <Upload size={14} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Upload Elemen (PNG/JPG)</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleElementUpload} />
                </label>

                {/* Element list */}
                {elements.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-300">
                    Belum ada elemen.<br />Upload gambar PNG (transparan) untuk stiker/logo.
                  </div>
                )}
                <div className="space-y-2">
                  {elements.map(el => (
                    <div
                      key={el.id}
                      onClick={() => setSelectedElementId(el.id === selectedElementId ? null : el.id)}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all"
                      style={{
                        borderColor: selectedElementId === el.id ? "#6366F1" : "#E2E8F0",
                        background: selectedElementId === el.id ? "#EEF2FF" : "#fff",
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center overflow-hidden border border-slate-200">
                        <img src={el.dataUrl} alt={el.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{el.name}</p>
                        <p className="text-[10px] text-slate-400">Scale {Math.round(el.scale * 100)}% · Rotasi {el.rotation}°</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteElement(el.id); }}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Selected element controls */}
                {selectedEl && (
                  <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-3 space-y-3">
                    <p className="text-xs font-bold text-indigo-700">Edit: {selectedEl.name}</p>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">Ukuran</span>
                        <span className="text-xs font-bold text-indigo-600">{Math.round(selectedEl.scale * 100)}%</span>
                      </div>
                      <input
                        type="range" min={10} max={500} value={Math.round(selectedEl.scale * 100)}
                        onChange={e => updateElement(selectedEl.id, { scale: +e.target.value / 100 })}
                        className="w-full" style={{ accentColor: "#4B2D9F" }}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">Rotasi</span>
                        <span className="text-xs font-bold text-indigo-600">{selectedEl.rotation}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateElement(selectedEl.id, { rotation: ((selectedEl.rotation - 15) + 360) % 360 })}
                          className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50"
                        >
                          <RotateCcw size={12} />
                        </button>
                        <input
                          type="range" min={0} max={359} value={selectedEl.rotation}
                          onChange={e => updateElement(selectedEl.id, { rotation: +e.target.value })}
                          className="flex-1" style={{ accentColor: "#4B2D9F" }}
                        />
                        <button
                          onClick={() => updateElement(selectedEl.id, { rotation: (selectedEl.rotation + 15) % 360 })}
                          className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50"
                        >
                          <RotateCw size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>Posisi X: {Math.round(selectedEl.x * 100)}%</div>
                      <div>Posisi Y: {Math.round(selectedEl.y * 100)}%</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => { onSave(image.id, transform, textLayer, elements); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#2D1B69" }}
            >
              <Check size={15} /> Simpan & Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
