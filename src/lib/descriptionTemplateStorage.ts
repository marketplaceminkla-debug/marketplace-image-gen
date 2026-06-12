/**
 * descriptionTemplateStorage.ts
 *
 * Stores description templates in localStorage.
 * Templates contain {{SPEK_LENGKAP}} placeholder which gets replaced with
 * the product's spekLengkap field from Excel column D during ZIP generation.
 */

import type { DescriptionTemplate } from "@/types";

const STORAGE_KEY = "pixelseller_desc_templates";
const ACTIVE_KEY  = "pixelseller_active_desc_template";

export function getAllDescTemplates(): DescriptionTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DescriptionTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveDescTemplate(name: string, templateText: string): DescriptionTemplate {
  const all = getAllDescTemplates();
  const tmpl: DescriptionTemplate = {
    id: Date.now().toString(),
    name,
    templateText,
    createdAt: new Date().toISOString(),
  };
  all.unshift(tmpl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  setActiveDescTemplate(tmpl.id);
  return tmpl;
}

export function updateDescTemplate(id: string, name: string, templateText: string): void {
  const all = getAllDescTemplates().map((t) =>
    t.id === id ? { ...t, name, templateText } : t
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteDescTemplate(id: string): void {
  const remaining = getAllDescTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  if (getActiveDescTemplateId() === id) {
    setActiveDescTemplate(remaining[0]?.id ?? "");
  }
}

export function getActiveDescTemplateId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_KEY) ?? "";
}

export function setActiveDescTemplate(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveDescTemplate(): DescriptionTemplate | null {
  const all = getAllDescTemplates();
  if (all.length === 0) return null;
  const activeId = getActiveDescTemplateId();
  return all.find((t) => t.id === activeId) ?? all[0];
}

/**
 * Render a description template by replacing {{SPEK_LENGKAP}} with actual spec text.
 */
export function renderDescription(templateText: string, spekLengkap: string): string {
  return templateText.replace(/\{\{SPEK_LENGKAP\}\}/g, spekLengkap);
}
