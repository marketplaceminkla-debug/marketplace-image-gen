"use client";

import { Settings2 } from "lucide-react";
import { ProcessingSettings, MARKETPLACE_PRESETS } from "@/types";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  settings: ProcessingSettings;
  onSettingsChange: (settings: ProcessingSettings) => void;
  disabled?: boolean;
}

export default function SettingsPanel({ settings, onSettingsChange, disabled }: SettingsPanelProps) {
  const update = (key: keyof ProcessingSettings, value: string | number) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const applyPreset = (presetKey: string) => {
    const preset = MARKETPLACE_PRESETS[presetKey];
    if (preset) {
      onSettingsChange({ ...settings, outputWidth: preset.width, outputHeight: preset.height });
    }
  };

  return (
    <aside
      className={cn(
        "w-full md:w-64 border-t md:border-t-0 md:border-l border-main-border bg-white overflow-auto shrink-0 scrollbar-thin",
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      <div className="px-5 py-4 border-b border-main-border">
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-700">Pengaturan Output</p>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Marketplace presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Preset Marketplace
          </label>
          <div className="space-y-1.5">
            {Object.entries(MARKETPLACE_PRESETS).map(([key, preset]) => {
              const isActive =
                settings.outputWidth === preset.width && settings.outputHeight === preset.height;
              return (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                    isActive
                      ? "bg-brand text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <p className="font-medium">{preset.label}</p>
                  <p className={cn("text-[10px]", isActive ? "text-blue-100" : "text-slate-400")}>
                    {preset.width} × {preset.height} px
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom dimensions */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Ukuran Custom
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Lebar (px)</label>
              <input
                type="number"
                value={settings.outputWidth}
                onChange={(e) => update("outputWidth", parseInt(e.target.value) || 720)}
                className="w-full border border-main-border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Tinggi (px)</label>
              <input
                type="number"
                value={settings.outputHeight}
                onChange={(e) => update("outputHeight", parseInt(e.target.value) || 1108)}
                className="w-full border border-main-border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>

        {/* Quality */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kualitas JPG
            </label>
            <span className="text-xs font-bold text-brand">{settings.outputQuality}%</span>
          </div>
          <input
            type="range"
            min={60}
            max={100}
            step={5}
            value={settings.outputQuality}
            onChange={(e) => update("outputQuality", parseInt(e.target.value))}
            className="w-full accent-brand"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>60% (kecil)</span>
            <span>100% (max)</span>
          </div>
        </div>

        {/* Output prefix */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Nama File Output
          </label>
          <input
            type="text"
            value={settings.outputPrefix}
            onChange={(e) => update("outputPrefix", e.target.value)}
            placeholder="cover_laptop"
            className="w-full border border-main-border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-brand"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Contoh: {settings.outputPrefix}_001.jpg
          </p>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-lg p-3 border border-main-border">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Ringkasan
          </p>
          <div className="space-y-1">
            {[
              ["Ukuran", `${settings.outputWidth}×${settings.outputHeight}px`],
              ["Format", "JPEG"],
              ["Kualitas", `${settings.outputQuality}%`],
              ["Nama", `${settings.outputPrefix}_NNN.jpg`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-[10px]">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-600 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
