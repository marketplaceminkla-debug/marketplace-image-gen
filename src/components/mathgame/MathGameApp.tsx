"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Star, MapPin } from "lucide-react";
import IslandMap from "./IslandMap";
import LevelModal from "./LevelModal";
import { TOTAL_LEVELS } from "@/lib/mathgame/levels";
import {
  loadProgress,
  saveLevelResult,
  totalStars,
  levelsCompleted,
  type Progress,
} from "@/lib/mathgame/progress";

const MAX_STARS = TOTAL_LEVELS * 3;

export default function MathGameApp() {
  const [progress, setProgress] = useState<Progress>({ stars: {} });
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setMounted(true);
  }, []);

  function handleFinish(stars: number) {
    if (activeLevel === null) return;
    setProgress(saveLevelResult(progress, activeLevel, stars));
    setActiveLevel(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 to-sky-50 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white shadow-sm">
        <Link
          href="/"
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
          aria-label="Tutup"
        >
          <X size={20} />
        </Link>

        <h1 className="font-extrabold text-slate-700 text-sm sm:text-lg text-center flex-1 px-2">
          🏝️ Petualangan Berhitung — Pulau Angka
        </h1>

        <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base font-bold">
          <div className="flex items-center gap-1 text-sky-600">
            <MapPin size={18} />
            {mounted ? levelsCompleted(progress) : 0}/{TOTAL_LEVELS}
          </div>
          <div className="flex items-center gap-1 text-yellow-500">
            <Star size={18} className="fill-yellow-400" />
            {mounted ? totalStars(progress) : 0}/{MAX_STARS}
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <IslandMap progress={progress} onSelectLevel={setActiveLevel} />
      </main>

      {activeLevel !== null && (
        <LevelModal level={activeLevel} onClose={() => setActiveLevel(null)} onFinish={handleFinish} />
      )}
    </div>
  );
}
