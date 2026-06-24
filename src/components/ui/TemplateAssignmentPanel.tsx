"use client";

import { useState, useEffect, useRef } from "react";
import { Layers, Plus, Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllTemplates } from "@/lib/imageProcessor";
import type { TemplateData, TemplateRule } from "@/types";

interface TemplateAssignmentPanelProps {
  totalImages: number;
  rules: TemplateRule[];
  onChange: (rules: TemplateRule[]) => void;
  disabled?: boolean;
}

function parsePhotoInput(input: string, max: number): number[] {
  const nums = new Set<number>();
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
          if (i >= 1 && i <= max) nums.add(i);
        }
      }
    } else {
      const n = Number(part);
      if (!isNaN(n) && n >= 1 && n <= max) nums.add(n);
    }
  }
  return Array.from(nums).sort((a, b) => a - b);
}

function numbersToDisplay(nums: number[]): string {
  if (nums.length === 0) return "";
  const sorted = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] !== prev + 1) {
      parts.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
      rangeStart = sorted[i];
    }
    prev = sorted[i];
  }
  return parts.join(",");
}

/** Cover photos = the 1st photo of each 5-photo product group: 1,6,11,… */
function coverNumbers(total: number): number[] {
  const a: number[] = [];
  for (let i = 1; i <= total; i += 5) a.push(i);
  return a;
}

export default function TemplateAssignmentPanel({
  totalImages,
  rules,
  onChange,
  disabled,
}: TemplateAssignmentPanelProps) {
  const [templates, setTemplates] = useState<TemplateData[]>([]);
  const [expanded, setExpanded] = useState(true);

  // inputMap is purely local — NEVER synced back from rules
  // This prevents overriding what user is typing (e.g. mid-comma entry)
  const [inputMap, setInputMap] = useState<Record<string, string>>({});
  const initializedRules = useRef<Set<string>>(new Set());

  useEffect(() => {
    getAllTemplates().then(setTemplates).catch(() => {});
  }, []);

  // Only initialize inputMap for NEW rules (not yet seen)
  useEffect(() => {
    const newEntries: Record<string, string> = {};
    for (const r of rules) {
      if (!initializedRules.current.has(r.id)) {
        initializedRules.current.add(r.id);
        newEntries[r.id] = numbersToDisplay(r.photoNumbers);
      }
    }
    if (Object.keys(newEntries).length > 0) {
      setInputMap((prev) => ({ ...prev, ...newEntries }));
    }
  }, [rules]);

  const addRule = () => {
    if (templates.length === 0) return;
    const first = templates[0];
    const newRule: TemplateRule = {
      id: Date.now().toString(),
      templateId: first.id,
      templateName: first.name,
      photoNumbers: [],
    };
    onChange([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    initializedRules.current.delete(id);
    setInputMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
    onChange(rules.filter((r) => r.id !== id));
  };

  const updateRuleTemplate = (id: string, templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    onChange(rules.map((r) => r.id === id ? { ...r, templateId, templateName: tmpl.name } : r));
  };

  const updateRulePhotos = (id: string, rawInput: string) => {
    // Update local input immediately — don't touch it again from useEffect
    setInputMap((prev) => ({ ...prev, [id]: rawInput }));
    // Only parse & propagate valid numbers
    const nums = parsePhotoInput(rawInput, totalImages);
    onChange(rules.map((r) => r.id === id ? { ...r, photoNumbers: nums } : r));
  };

  const assigned = new Set(rules.flatMap((r) => r.photoNumbers));
  const unassigned = Array.from({ length: totalImages }, (_, i) => i + 1).filter((n) => !assigned.has(n));

  if (totalImages === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
        disabled={disabled}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#EDE9FF" }}>
          <Layers size={14} style={{ color: "#4B2D9F" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Assign Template per Foto</p>
          <p className="text-xs text-slate-400">
            {rules.length === 0
              ? "Semua foto pakai template aktif"
              : `${rules.length} rule · ${unassigned.length > 0 ? `foto ${unassigned.join(",")} → template aktif` : "semua foto ter-assign"}`}
          </p>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
          <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2.5 text-xs text-blue-700">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              Foto yang tidak di-assign akan pakai <strong>template aktif</strong>.
              Input: <code className="bg-blue-100 px-1 rounded font-mono">1,6,11</code> atau range <code className="bg-blue-100 px-1 rounded font-mono">2-5</code> atau gabungan <code className="bg-blue-100 px-1 rounded font-mono">2-5,7-10</code>
            </span>
          </div>

          {rules.map((rule) => (
            <div key={rule.id} className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Template</label>
                <select
                  value={rule.templateId}
                  onChange={(e) => updateRuleTemplate(rule.id, e.target.value)}
                  disabled={disabled}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                  Foto ke- (1–{totalImages})
                </label>
                <input
                  value={inputMap[rule.id] ?? ""}
                  onChange={(e) => updateRulePhotos(rule.id, e.target.value)}
                  placeholder="cth: 1,6,11 atau 2-5"
                  disabled={disabled}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-purple-400"
                />
                <button
                  type="button"
                  onClick={() => updateRulePhotos(rule.id, coverNumbers(totalImages).join(","))}
                  disabled={disabled}
                  className="text-[10px] font-medium text-purple-600 hover:underline mt-1 inline-flex items-center gap-1 disabled:text-slate-300 disabled:no-underline"
                  title="Isi otomatis dengan urutan foto sampul tiap produk"
                >
                  ✨ Rekomendasi foto sampul (1,6,11,… · {coverNumbers(totalImages).length} foto)
                </button>
                {rule.photoNumbers.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">{rule.photoNumbers.length} foto ter-assign</p>
                )}
              </div>
              <button
                onClick={() => removeRule(rule.id)}
                disabled={disabled}
                className="mt-5 w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <button
            onClick={addRule}
            disabled={disabled || templates.length === 0}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm border border-dashed transition-colors",
              disabled || templates.length === 0
                ? "border-slate-200 text-slate-300 cursor-not-allowed"
                : "border-purple-300 text-purple-600 hover:bg-purple-50"
            )}
          >
            <Plus size={14} /> Tambah Rule
          </button>

          {unassigned.length > 0 && rules.length > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              ⚠ Foto {unassigned.join(", ")} belum di-assign → akan pakai template aktif
            </p>
          )}
        </div>
      )}
    </div>
  );
}
