"use client";

import { LayoutTemplate, Zap, CheckCircle, FileSpreadsheet } from "lucide-react";
import { ActiveView } from "@/app/page";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRef } from "react";

interface SidebarProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  templateUploaded: boolean;
}

const navItems = [
  { id: "template" as ActiveView, label: "Upload Template", shortLabel: "Template", icon: LayoutTemplate, description: "Frame & branding" },
  { id: "import"   as ActiveView, label: "Import Excel",    shortLabel: "Import",   icon: FileSpreadsheet, description: "Foto + judul dari Excel" },
  { id: "generate" as ActiveView, label: "Generate Images", shortLabel: "Generate", icon: Zap,             description: "Bulk processing" },
];

function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.5;
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top  - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

export default function Sidebar({ activeView, onViewChange, templateUploaded }: SidebarProps) {
  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex w-60 flex-col h-full shrink-0"
        style={{ background: "#2D1B69", borderRight: "1px solid #3D2A7A", position: "relative", overflow: "hidden" }}
      >
        {/* Animated background orbs */}
        <div className="sidebar-bg-canvas">
          <div className="sidebar-orb sidebar-orb-1" />
          <div className="sidebar-orb sidebar-orb-2" />
          <div className="sidebar-orb sidebar-orb-3" />
        </div>

        {/* Logo */}
        <div className="px-4 py-5 flex flex-col items-center gap-3" style={{ borderBottom: "1px solid #3D2A7A", position: "relative" }}>
          <div className="sidebar-logo-wrap w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: "#1E1040" }}>
            <Image src="/pixelseller-logo.svg" alt="PixelSeller" width={80} height={80} className="object-contain" />
          </div>
          <div className="text-center">
            <p className="font-bold text-base leading-tight tracking-tight" style={{ color: "#F5C200" }}>PixelSeller</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>MARKETPLACE TOOLS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5" style={{ position: "relative" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Workflow
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={(e) => { addRipple(e); onViewChange(item.id); }}
                className={cn("nav-item-btn btn-bounce w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-left transition-all", isActive && "active")}
                style={{
                  background: isActive ? "rgba(245,194,0,0.15)" : "transparent",
                  border: isActive ? "1px solid rgba(245,194,0,0.3)" : "1px solid transparent",
                  transition: "background 0.2s ease, border-color 0.2s ease",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon
                  size={16}
                  className="shrink-0"
                  style={{
                    color: isActive ? "#F5C200" : "rgba(255,255,255,0.4)",
                    transition: "color 0.2s ease, transform 0.2s ease",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="text-sm font-medium truncate"
                      style={{
                        color: isActive ? "#F5C200" : "rgba(255,255,255,0.75)",
                        transition: "color 0.2s ease",
                      }}
                    >
                      {item.label}
                    </p>
                    {item.id === "template" && templateUploaded && (
                      <CheckCircle size={11} className="text-green-400 shrink-0 status-done" />
                    )}
                  </div>
                  <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{item.description}</p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3" style={{ borderTop: "1px solid #3D2A7A", position: "relative" }}>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>PixelSeller · v6.0</p>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{ background: "#2D1B69", borderTop: "1px solid #3D2A7A", height: "60px" }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={(e) => { addRipple(e); onViewChange(item.id); }}
              className="nav-item-btn btn-bounce flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-all"
              style={{ background: "transparent" }}
            >
              <div className="flex items-center justify-center w-8 h-5 rounded-full relative">
                <Icon
                  size={18}
                  style={{
                    color: isActive ? "#F5C200" : "rgba(255,255,255,0.4)",
                    transition: "color 0.2s ease, transform 0.15s ease",
                    transform: isActive ? "scale(1.2)" : "scale(1)",
                  }}
                />
                {item.id === "template" && templateUploaded && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 status-done" />
                )}
              </div>
              <span className="text-[10px] font-medium" style={{ color: isActive ? "#F5C200" : "rgba(255,255,255,0.4)", transition: "color 0.2s ease" }}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
