"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TemplatePanel from "@/components/layout/TemplatePanel";
import GeneratePanel from "@/components/layout/GeneratePanel";
import ImportExcelPanel from "@/components/layout/ImportExcelPanel";
import { getActiveTemplate } from "@/lib/imageProcessor";
import { ProductImage } from "@/types";

export type ActiveView = "template" | "import" | "generate";

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("generate");
  const [templateUploaded, setTemplateUploaded] = useState(false);
  const [pendingImport, setPendingImport] = useState<ProductImage[] | undefined>(undefined);
  const [panelKey, setPanelKey] = useState(0);
  const prevView = useRef<ActiveView>("generate");

  useEffect(() => {
    getActiveTemplate().then((t) => setTemplateUploaded(!!t)).catch(() => {});
  }, []);

  const handleViewChange = useCallback((view: ActiveView) => {
    if (view === prevView.current) return;
    prevView.current = view;
    setPanelKey(k => k + 1);
    setActiveView(view);
  }, []);

  const handleImport = useCallback((images: ProductImage[]) => {
    setPendingImport(images);
    handleViewChange("generate");
  }, [handleViewChange]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-main-bg overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        templateUploaded={templateUploaded}
      />
      <main className="flex-1 overflow-hidden pb-[60px] md:pb-0">
        <div key={panelKey} className="panel-enter h-full">
          {activeView === "template" && (
            <TemplatePanel onTemplateChange={setTemplateUploaded} />
          )}
          {activeView === "import" && (
            <ImportExcelPanel
              onImport={handleImport}
              templateUploaded={templateUploaded}
            />
          )}
          {activeView === "generate" && (
            <GeneratePanel
              templateUploaded={templateUploaded}
              importedImages={pendingImport}
              onImportConsumed={() => setPendingImport(undefined)}
            />
          )}
        </div>
      </main>
    </div>
  );
}
