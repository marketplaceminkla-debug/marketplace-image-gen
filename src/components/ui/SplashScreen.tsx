"use client";

import { useEffect, useState } from "react";

export default function SplashScreen() {
  const [state, setState] = useState<"visible" | "hiding" | "hidden">("visible");

  useEffect(() => {
    // Hide after 2.1s (animation finishes + brief hold)
    const t1 = setTimeout(() => setState("hiding"), 2100);
    const t2 = setTimeout(() => setState("hidden"), 2650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (state === "hidden") return null;

  // pixel grid: 5 cols × 4 rows + bar row
  const row1 = ["gold","gold","gold","purp","dark"];
  const row2 = ["gold","dark","gold","gold","purp"];
  const row3 = ["gold","gold","gold","dark","purp"];
  // bar row heights encode ascending bars
  const bars = [
    { cls: "bar1", style: { height: "9px" } },
    { cls: "bar1", style: { height: "14px" } },
    { cls: "bar2", style: { height: "20px" } },
    { cls: "bar2", style: { height: "27px" } },
    { cls: "bar2", style: { height: "34px" } },
  ];

  return (
    <div id="ps-splash" className={state === "hiding" ? "hiding" : ""}>
      {/* pixel grid */}
      <div className="px-grid">
        {[...row1, ...row2, ...row3].map((cls, i) => (
          <div key={i} className={`px-cell ${cls}`} style={{ height: "18px" }} />
        ))}
        {/* bar row — each cell is a rising bar */}
        {bars.map((b, i) => (
          <div
            key={`bar-${i}`}
            className={`px-cell ${b.cls}`}
            style={{
              ...b.style,
              alignSelf: "flex-end",
              animationDelay: `${0.18 + i * 0.06}s`,
            }}
          />
        ))}
      </div>

      <div className="splash-wordmark">PixelSeller</div>
      <div className="splash-sub">MARKETPLACE TOOLS</div>

      <div className="splash-bar-wrap">
        <div className="splash-bar" />
      </div>
    </div>
  );
}
