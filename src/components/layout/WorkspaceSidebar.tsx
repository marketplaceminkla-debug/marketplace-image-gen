"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, ChevronDown, CheckCircle, LogOut, Volume2, VolumeX } from "lucide-react";
import { ViewId, findSection, type NavSection } from "@/components/layout/workspaceNav";
import { useAuth } from "@/lib/auth";
import { isMuted, setMuted, playChirp, unlockAudio } from "@/lib/notifSound";
import { cn } from "@/lib/utils";

interface WorkspaceSidebarProps {
  sections: NavSection[];
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
  templateUploaded: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
};

function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.5;
  const x = e.clientX - rect.left - size / 2;
  const y = e.clientY - rect.top - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

export default function WorkspaceSidebar({ sections, activeView, onViewChange, templateUploaded }: WorkspaceSidebarProps) {
  const { profile, signOut } = useAuth();
  const activeSection = findSection(activeView, sections);
  const [openSection, setOpenSection] = useState<string>(activeSection.id);
  const [muted, setMutedState] = useState(false);
  useEffect(() => { setMutedState(isMuted()); }, []);

  useEffect(() => {
    setOpenSection(activeSection.id);
  }, [activeSection.id]);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex w-64 flex-col h-full shrink-0"
        style={{ background: "#2D1B69", borderRight: "1px solid #3D2A7A", position: "relative", overflow: "hidden" }}
      >
        <div className="sidebar-bg-canvas">
          <div className="sidebar-orb sidebar-orb-1" />
          <div className="sidebar-orb sidebar-orb-2" />
          <div className="sidebar-orb sidebar-orb-3" />
        </div>

        {/* Workspace brand */}
        <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: "1px solid #3D2A7A", position: "relative" }}>
          <div className="sidebar-logo-wrap w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#1E1040" }}>
            <LayoutGrid size={22} style={{ color: "#F5C200" }} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight tracking-tight truncate" style={{ color: "#F5C200" }}>Marketplace</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.15em" }}>INTERNAL WORKSPACE</p>
          </div>
        </div>

        {/* Accordion nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-1" style={{ position: "relative" }}>
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const isOpen = openSection === section.id;
            const hasActive = section.id === activeSection.id;
            return (
              <div key={section.id}>
                <button
                  onClick={() => setOpenSection(isOpen ? "" : section.id)}
                  className="btn-bounce w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors"
                  style={{ background: "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <SectionIcon size={17} className="shrink-0" style={{ color: hasActive ? "#F5C200" : "rgba(255,255,255,0.55)" }} />
                  <span className="flex-1 text-[13px] font-semibold tracking-wide" style={{ color: hasActive ? "#F5C200" : "rgba(255,255,255,0.85)" }}>
                    {section.label}
                  </span>
                  <ChevronDown
                    size={15}
                    style={{ color: "rgba(255,255,255,0.4)", transition: "transform 0.25s ease", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>

                {isOpen && (
                  <div className="mt-0.5 mb-1 space-y-0.5 animate-fade-in">
                    {section.items.map((item, idx) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      const showGroup = item.group && item.group !== section.items[idx - 1]?.group;
                      return (
                        <div key={item.id}>
                          {showGroup && (
                            <p className="text-[9px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1" style={{ color: "rgba(245,194,0,0.5)" }}>
                              {item.group}
                            </p>
                          )}
                          <button
                            onClick={(e) => { addRipple(e); onViewChange(item.id); }}
                            className={cn("nav-item-btn btn-bounce w-full flex items-center gap-2.5 pl-4 pr-2.5 py-2 rounded-md text-left transition-all", isActive && "active")}
                            style={{
                              background: isActive ? "rgba(245,194,0,0.15)" : "transparent",
                              border: isActive ? "1px solid rgba(245,194,0,0.3)" : "1px solid transparent",
                            }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                          >
                            <Icon
                              size={15}
                              className="shrink-0"
                              style={{ color: isActive ? "#F5C200" : "rgba(255,255,255,0.4)", transform: isActive ? "scale(1.15)" : "scale(1)", transition: "transform 0.2s ease" }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[13px] font-medium truncate" style={{ color: isActive ? "#F5C200" : "rgba(255,255,255,0.75)" }}>
                                  {item.label}
                                </p>
                                {item.id === "ps-template" && templateUploaded && (
                                  <CheckCircle size={11} className="text-green-400 shrink-0 status-done" />
                                )}
                              </div>
                              {item.description && (
                                <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{item.description}</p>
                              )}
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 flex items-center gap-2" style={{ borderTop: "1px solid #3D2A7A", position: "relative" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: "#1E1040", color: "#F5C200" }}>
            {(profile?.full_name || profile?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{profile?.full_name || profile?.email}</p>
            <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{ROLE_LABEL[profile?.role ?? "staff"]}</p>
          </div>
          <button
            onClick={() => { const m = !muted; setMuted(m); setMutedState(m); unlockAudio(); if (!m) playChirp(); }}
            title={muted ? "Suara notif: mati (klik untuk nyalakan)" : "Suara notif: nyala (klik untuk tes/matikan)"}
            className="btn-bounce w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: muted ? "rgba(255,255,255,0.3)" : "#F5C200" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button
            onClick={signOut}
            title="Keluar"
            className="btn-bounce w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav: top-level sections ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
        style={{ background: "#2D1B69", borderTop: "1px solid #3D2A7A", height: "60px" }}
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = section.id === activeSection.id;
          return (
            <button
              key={section.id}
              onClick={(e) => { addRipple(e); onViewChange(section.items[0].id); }}
              className="nav-item-btn btn-bounce flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
              style={{ background: "transparent" }}
            >
              <Icon size={19} style={{ color: isActive ? "#F5C200" : "rgba(255,255,255,0.4)", transform: isActive ? "scale(1.15)" : "scale(1)", transition: "transform 0.15s ease" }} />
              <span className="text-[10px] font-medium" style={{ color: isActive ? "#F5C200" : "rgba(255,255,255,0.4)" }}>
                {section.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
