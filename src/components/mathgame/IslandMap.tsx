"use client";

import { TOTAL_LEVELS } from "@/lib/mathgame/levels";
import type { Progress } from "@/lib/mathgame/progress";
import { isLevelUnlocked } from "@/lib/mathgame/progress";
import { Lock, Star, Play } from "lucide-react";

// Hand-placed node positions (viewBox 0 0 1000 700) tracing a winding path
// across the island, echoing the pirate-map layout: start top-left, loop
// through the middle, finish at the treasure bottom-left.
const NODES: { x: number; y: number }[] = [
  { x: 175, y: 110 },
  { x: 290, y: 185 },
  { x: 425, y: 145 },
  { x: 560, y: 115 },
  { x: 665, y: 220 },
  { x: 665, y: 355 },
  { x: 565, y: 420 },
  { x: 565, y: 535 },
  { x: 460, y: 560 },
  { x: 390, y: 465 },
  { x: 330, y: 555 },
  { x: 258, y: 605 },
  { x: 190, y: 555 },
  { x: 168, y: 425 },
];

const DECOR = [
  { emoji: "🌴", x: 55, y: 250, size: 46 },
  { emoji: "🌴", x: 900, y: 150, size: 40 },
  { emoji: "⚓", x: 60, y: 610, size: 40 },
  { emoji: "🐚", x: 900, y: 600, size: 34 },
  { emoji: "☁️", x: 130, y: 40, size: 44 },
  { emoji: "☁️", x: 780, y: 60, size: 38 },
  { emoji: "🐬", x: 900, y: 380, size: 40 },
  { emoji: "🌊", x: 40, y: 450, size: 30 },
];

interface Props {
  progress: Progress;
  onSelectLevel: (level: number) => void;
}

export default function IslandMap({ progress, onSelectLevel }: Props) {
  const pathD = NODES.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`).join(" ");

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border-4 border-white/70 shadow-2xl bg-gradient-to-b from-sky-300 to-sky-400">
      <svg viewBox="0 0 1000 700" className="w-full h-auto block select-none">
        <defs>
          <radialGradient id="islandGrad" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#8fd67a" />
            <stop offset="100%" stopColor="#63b653" />
          </radialGradient>
        </defs>

        {/* island blob */}
        <path
          d="M 120 300 C 60 190 200 60 380 65 C 520 -10 700 40 760 150 C 900 190 940 340 830 430
             C 900 520 780 640 620 630 C 520 700 340 690 260 610 C 100 610 40 430 120 300 Z"
          fill="url(#islandGrad)"
          stroke="#4f9c42"
          strokeWidth="6"
        />

        {/* decorations */}
        {DECOR.map((d, i) => (
          <text key={i} x={d.x} y={d.y} fontSize={d.size}>
            {d.emoji}
          </text>
        ))}

        {/* dashed path connecting nodes */}
        <path d={pathD} fill="none" stroke="#a9702f" strokeWidth="6" strokeDasharray="2 14" strokeLinecap="round" />

        {/* "Mulai" flag near node 1 */}
        <g transform={`translate(${NODES[0].x - 90}, ${NODES[0].y - 70})`}>
          <rect x="0" y="0" width="76" height="30" rx="15" fill="white" stroke="#334155" strokeWidth="2" />
          <text x="38" y="20" fontSize="15" fontWeight="700" textAnchor="middle" fill="#334155">
            Mulai
          </text>
        </g>

        {/* treasure chest near final node */}
        <text x={NODES[13].x - 70} y={NODES[13].y + 10} fontSize="46">
          💰
        </text>

        {/* level nodes */}
        {NODES.map((n, idx) => {
          const level = idx + 1;
          const stars = progress.stars[level] ?? 0;
          const unlocked = isLevelUnlocked(progress, level);
          return (
            <g
              key={level}
              transform={`translate(${n.x}, ${n.y})`}
              className={unlocked ? "cursor-pointer" : "cursor-not-allowed"}
              onClick={() => unlocked && onSelectLevel(level)}
            >
              <circle
                r="30"
                fill={unlocked ? (stars > 0 ? "#facc15" : "#ffffff") : "#94a3b8"}
                stroke={unlocked ? "#334155" : "#64748b"}
                strokeWidth="4"
              />
              {unlocked ? (
                <text x="0" y="8" fontSize="22" fontWeight="800" textAnchor="middle" fill="#1e293b">
                  {level}
                </text>
              ) : (
                <foreignObject x="-11" y="-11" width="22" height="22">
                  <Lock size={22} color="#1e293b" />
                </foreignObject>
              )}
              {stars > 0 && (
                <foreignObject x="-24" y="30" width="48" height="18">
                  <div className="flex items-center justify-center gap-0.5">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < stars ? "fill-yellow-300 text-yellow-600" : "fill-white/40 text-slate-400"}
                      />
                    ))}
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>

      <button
        onClick={() => {
          const firstUnfinished = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).find(
            (lvl) => isLevelUnlocked(progress, lvl) && (progress.stars[lvl] ?? 0) === 0
          );
          onSelectLevel(firstUnfinished ?? 1);
        }}
        className="absolute bottom-4 right-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-full shadow-lg transition-colors"
      >
        <Play size={18} className="fill-white" /> Main
      </button>
    </div>
  );
}
