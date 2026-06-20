"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "ps-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Sync with whatever the no-flash script already applied to <html>.
  useEffect(() => {
    const current: Theme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    setTheme(current);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Aktifkan light mode" : "Aktifkan dark mode"}
      title={isDark ? "Ganti ke light mode" : "Ganti ke dark mode"}
      // position:fixed + right are set inline so nothing in the global CSS
      // cascade can override the placement. Pinned to the bottom-right; the
      // mobile bottom nav (~60px) is cleared by bottom-[76px], dropping to
      // bottom-6 on desktop. Hidden until mounted to avoid a knob flash.
      style={{ position: "fixed", right: "1.25rem", visibility: mounted ? "visible" : "hidden" }}
      className="bottom-[76px] md:bottom-6 z-[200] flex h-9 w-[68px] items-center rounded-full border border-white/20 bg-kla-purpleDeep/90 px-1 shadow-lg backdrop-blur-sm transition-colors duration-300 hover:border-brand/60 dark:bg-[#221F33]/90"
    >
      {/* Track icons */}
      <Sun
        size={15}
        className="absolute left-[9px] text-brand transition-opacity duration-300"
        style={{ opacity: isDark ? 0.35 : 1 }}
      />
      <Moon
        size={14}
        className="absolute right-[9px] text-[#A78BFA] transition-opacity duration-300"
        style={{ opacity: isDark ? 1 : 0.35 }}
      />
      {/* Sliding knob */}
      <span
        className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{ transform: isDark ? "translateX(32px)" : "translateX(0)" }}
      >
        {isDark ? (
          <Moon size={14} className="text-kla-purple" />
        ) : (
          <Sun size={15} className="text-brand" />
        )}
      </span>
    </button>
  );
}
