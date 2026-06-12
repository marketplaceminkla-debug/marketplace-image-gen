"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Zap, Download, Eye, AlertCircle, ImageIcon, RotateCcw, Loader2 } from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { ProductImage, ProcessingSettings, DEFAULT_SETTINGS, DEFAULT_TEXT_LAYER, TextLayer, OverlayElement } from "@/types";
import {
  compositeImage,
  getActiveTemplate,
  getAllTemplates,
  getOutputFilename,
  ImageTransform,
  fileToDataUrl,
} from "@/lib/imageProcessor";
import type { TemplateData } from "@/types";
import SettingsPanel from "@/components/ui/SettingsPanel";
import ImageGrid from "@/components/ui/ImageGrid";
import ProcessingProgress from "@/components/ui/ProcessingProgress";
import PreviewModal from "@/components/ui/PreviewModal";
import CanvasEditor from "@/components/ui/CanvasEditor";
import TemplateAssignmentPanel from "@/components/ui/TemplateAssignmentPanel";
import JSZip from "jszip";
import { getActiveDescTemplate, renderDescription } from "@/lib/descriptionTemplateStorage";
import type { TemplateRule } from "@/types";

interface GeneratePanelProps {
  templateUploaded: boolean;
  importedImages?: ProductImage[];
  onImportConsumed?: () => void;
}
type PanelState = "idle" | "processing" | "done";

export default function GeneratePanel({ templateUploaded, importedImages, onImportConsumed }: GeneratePanelProps) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [errorList, setErrorList] = useState<Array<{ filename: string; message: string }>>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingTemplateDataUrl, setEditingTemplateDataUrl] = useState<string | null>(null);
  // Active template cached in state — fetched async once
  const [activeTemplate, setActiveTemplate] = useState<TemplateData | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateRules, setTemplateRules] = useState<TemplateRule[]>([]);

  // Consume imported images from Excel panel
  useEffect(() => {
    if (importedImages && importedImages.length > 0) {
      setImages((prev) => [...prev, ...importedImages]);
      onImportConsumed?.();
      setPanelState("idle");
      setZipBlob(null);
    }
  }, [importedImages]);

  // Load active template whenever templateUploaded changes
  useEffect(() => {
    if (!templateUploaded) { setActiveTemplate(null); return; }
    setLoadingTemplate(true);
    getActiveTemplate()
      .then((t) => setActiveTemplate(t))
      .catch(() => setActiveTemplate(null))
      .finally(() => setLoadingTemplate(false));
  }, [templateUploaded]);

  const onDrop = useCallback((accepted: File[]) => {
    const newImages: ProductImage[] = accepted.map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "pending" as const,
    }));
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    disabled: panelState === "processing",
  });

  const removeImage = (id: string) => setImages((prev) => prev.filter((img) => img.id !== id));

  // Resolve the correct template URL for this image BEFORE opening the editor
  const handleOpenEdit = async (imageId: string) => {
    const imageIndex = images.findIndex((i) => i.id === imageId);
    let templateUrl = activeTemplate?.dataUrl ?? null;

    // Check if there's a rule that overrides the template for this photo
    const matchedRule = templateRules.find((r) =>
      r.photoNumbers.includes(imageIndex + 1)
    );

    if (matchedRule) {
      try {
        const allTmpl = await getAllTemplates();
        const found = allTmpl.find((t) => t.id === matchedRule.templateId);
        if (found) templateUrl = found.dataUrl;
      } catch {
        // Fallback to active template on error
      }
    }

    setEditingTemplateDataUrl(templateUrl);
    setEditingImageId(imageId);
  };

  const handleSaveEdit = (id: string, transform: ImageTransform, textLayer: TextLayer, elements: OverlayElement[]) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, transform, textLayer, elements, status: "pending" as const, resultUrl: undefined }
          : img
      )
    );
  };

  const clearAll = () => {
    setImages([]);
    setPanelState("idle");
    setProgress(0);
    setProcessedCount(0);
    setFailedCount(0);
    setErrorList([]);
    setPreviewUrl(null);
    setZipBlob(null);
    setGeneralError(null);
  };

  const generatePreviewForIndex = async (index: number) => {
    const img = images[index];
    if (!img) return;
    setLoadingPreview(true);
    setPreviewIndex(index);
    try {
      // Respect template rules — same logic as handleGenerate
      const defaultTemplate = activeTemplate ?? (await getActiveTemplate());
      if (!defaultTemplate) throw new Error("Upload template terlebih dahulu");

      let frameTemplate = defaultTemplate;
      for (const rule of templateRules) {
        if (rule.photoNumbers.includes(index + 1)) {
          const allTmpl = await getAllTemplates();
          const found = allTmpl.find((t) => t.id === rule.templateId);
          if (found) { frameTemplate = found; break; }
        }
      }

      const dataUrl = await fileToDataUrl(img.file);
      const blob = await compositeImage(dataUrl, frameTemplate.dataUrl, settings, img.transform, img.textLayer, img.elements);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Preview gagal");
      setPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePreview = async (id?: string) => {
    const idx = id ? images.findIndex((i) => i.id === id) : 0;
    setPreviewOpen(true);
    setPreviewUrl(null);
    await generatePreviewForIndex(idx >= 0 ? idx : 0);
  };

  const handlePrevPreview = () => {
    const newIdx = (previewIndex - 1 + images.length) % images.length;
    setPreviewUrl(null);
    generatePreviewForIndex(newIdx);
  };

  const handleNextPreview = () => {
    const newIdx = (previewIndex + 1) % images.length;
    setPreviewUrl(null);
    generatePreviewForIndex(newIdx);
  };

  const handleGenerate = async () => {
    if (images.length === 0 || !templateUploaded) return;
    setPanelState("processing");
    setProgress(0);
    setProcessedCount(0);
    setFailedCount(0);
    setErrorList([]);
    setGeneralError(null);
    setZipBlob(null);

    const defaultTemplate = activeTemplate ?? (await getActiveTemplate());
    if (!defaultTemplate) {
      setGeneralError("Template tidak ditemukan. Coba refresh halaman.");
      setPanelState("idle");
      return;
    }

    // Build a map: photoIndex (0-based) → TemplateData
    // Template rules use 1-based photo numbers
    const allTemplates = await getAllTemplates();
    const templateMap = new Map<string, TemplateData>(allTemplates.map((t) => [t.id, t]));

    const photoTemplateMap = new Map<number, TemplateData>(); // 0-based index
    for (const rule of templateRules) {
      const tmpl = templateMap.get(rule.templateId);
      if (!tmpl) continue;
      for (const photoNum of rule.photoNumbers) {
        photoTemplateMap.set(photoNum - 1, tmpl); // convert to 0-based
      }
    }

    // Load description template
    const descTemplate = getActiveDescTemplate();

    // Track TXT output: judul → spekLengkap (deduplicated per product title)
    const txtMap = new Map<string, string>(); // judul → spekLengkap

    const zip = new JSZip();
    let success = 0, failed = 0;
    const errors: Array<{ filename: string; message: string }> = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      setImages((prev) =>
        prev.map((p) => (p.id === img.id ? { ...p, status: "processing" as const } : p))
      );
      try {
        // Pick template: rule-based or default
        const frameTemplate = photoTemplateMap.get(i) ?? defaultTemplate;
        const dataUrl = await fileToDataUrl(img.file);
        const blob = await compositeImage(dataUrl, frameTemplate.dataUrl, settings, img.transform, img.textLayer, img.elements);
        const outputName = getOutputFilename(settings.outputPrefix, i, images.length);
        zip.file(outputName, blob);
        const resultUrl = URL.createObjectURL(blob);
        success++;
        setImages((prev) =>
          prev.map((p) => (p.id === img.id ? { ...p, status: "done" as const, resultUrl } : p))
        );

        // Collect TXT data — use img.judul (from Excel) or textLayer title as fallback
        const txtJudul = img.judul || img.textLayer?.title?.text || "";
        if (txtJudul && descTemplate) {
          if (!txtMap.has(txtJudul)) {
            txtMap.set(txtJudul, img.spekLengkap ?? "");
          }
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : "Gagal";
        errors.push({ filename: img.name, message: msg });
        setImages((prev) =>
          prev.map((p) => (p.id === img.id ? { ...p, status: "error" as const, errorMessage: msg } : p))
        );
      }
      setProcessedCount(success);
      setFailedCount(failed);
      setErrorList([...errors]);
      setProgress(Math.round(((i + 1) / images.length) * 100));
      if (i % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    // Generate TXT files
    if (descTemplate && txtMap.size > 0) {
      const txtFolder = zip.folder("deskripsi");
      Array.from(txtMap.entries()).forEach(([judul, spekLengkap]) => {
        const content = renderDescription(descTemplate.templateText, spekLengkap);
        // Sanitize filename
        const safeName = judul.replace(/[<>:"/\\|?*]/g, "").trim().slice(0, 80);
        txtFolder?.file(`${safeName}.txt`, content);
      });
    }

    const zipContent = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    setZipBlob(zipContent);
    setPanelState("done");
    setProgress(100);
  };

  const handleDownload = () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixelseller-covers_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate =
    images.length > 0 && templateUploaded && panelState !== "processing" && !loadingTemplate;
  const isDone = panelState === "done";
  const editingImage = editingImageId ? images.find((i) => i.id === editingImageId) : null;
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-main-border bg-white px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shrink-0 gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Generate Images</h1>
          <p className="text-xs text-slate-400">
            {loadingTemplate
              ? "Memuat template..."
              : images.length === 0
              ? "Upload foto produk untuk mulai"
              : `${images.length} foto · ${
                  images.filter((i) => i.transform || i.textLayer?.title.text || (i.elements && i.elements.length > 0)).length
                } diedit`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
          {loadingTemplate && (
            <Loader2 size={16} className="animate-spin text-slate-400" />
          )}
          {images.length > 0 && (
            <>
              <button
                onClick={() => handlePreview()}
                disabled={!templateUploaded || loadingPreview || loadingTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-main-border hover:border-slate-300 rounded-lg transition-colors disabled:opacity-40"
              >
                <Eye size={14} /> Preview
              </button>
              <button
                onClick={clearAll}
                disabled={panelState === "processing"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-700 rounded-lg transition-colors disabled:opacity-40"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </>
          )}
          {isDone && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white rounded-lg font-medium"
              style={{ background: "#10B981" }}
            >
              <Download size={14} /> Download ZIP
            </button>
          )}
          {!isDone && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                !canGenerate && "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
              style={canGenerate ? { background: "#4B2D9F", color: "#fff" } : {}}
            >
              <Zap size={14} />
              {panelState === "processing" ? "Memproses..." : "Generate Semua"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-6 scrollbar-thin">
          {!templateUploaded && (
            <div
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mb-5"
              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid rgba(245,194,0,0.4)" }}
            >
              <AlertCircle size={16} className="shrink-0" />
              Upload template frame terlebih dahulu di menu &quot;Upload Template&quot;
            </div>
          )}
          {generalError && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-5 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" /> {generalError}
            </div>
          )}
          {images.length > 0 && (
            <TemplateAssignmentPanel
              totalImages={images.length}
              rules={templateRules}
              onChange={setTemplateRules}
              disabled={panelState === "processing"}
            />
          )}
          {(panelState === "processing" || isDone) && (
            <ProcessingProgress
              progress={progress}
              success={processedCount}
              failed={failedCount}
              total={images.length}
              isDone={isDone}
              errors={errorList}
            />
          )}
          {images.length === 0 ? (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all",
                isDragActive
                  ? "border-purple-400 bg-purple-50"
                  : "border-slate-200 hover:border-purple-400 hover:bg-purple-50/30"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "#EDE9FF" }}
                >
                  <ImageIcon size={28} style={{ color: "#4B2D9F" }} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">
                    {isDragActive ? "Lepaskan foto di sini" : "Drag & drop foto produk"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    JPG, JPEG, PNG · Bisa ratusan foto sekaligus
                  </p>
                </div>
                <button
                  className="text-sm font-medium hover:underline"
                  style={{ color: "#4B2D9F" }}
                >
                  Pilih dari folder
                </button>
              </div>
            </div>
          ) : (
            <>
              {panelState === "idle" && (
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-4 mb-5 flex items-center justify-center gap-2 cursor-pointer transition-all",
                    isDragActive
                      ? "border-purple-400 bg-purple-50"
                      : "border-slate-200 hover:border-purple-400"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload size={15} className="text-slate-400" />
                  <p className="text-sm text-slate-400">Tambah foto lagi</p>
                </div>
              )}
              <ImageGrid
                images={images}
                onRemove={removeImage}
                onEdit={handleOpenEdit}
                onPreview={(id) => handlePreview(id)}
                disabled={panelState === "processing"}
              />
            </>
          )}
        </div>
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          disabled={panelState === "processing"}
        />
      </div>

      <PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewUrl={previewUrl}
        loading={loadingPreview}
        imageName={images[previewIndex]?.name}
        settings={settings}
        currentIndex={previewIndex}
        totalImages={images.length}
        onPrev={handlePrevPreview}
        onNext={handleNextPreview}
      />

      {editingImage && editingTemplateDataUrl && (
        <CanvasEditor
          image={editingImage}
          templateDataUrl={editingTemplateDataUrl}
          outputWidth={settings.outputWidth}
          outputHeight={settings.outputHeight}
          onSave={handleSaveEdit}
          onClose={() => { setEditingImageId(null); setEditingTemplateDataUrl(null); }}
        />
      )}
    </div>
  );
}
