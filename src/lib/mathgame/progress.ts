import { TOTAL_LEVELS } from "./levels";

const STORAGE_KEY = "pulau-angka-progress";

export interface Progress {
  stars: Record<number, number>; // level -> stars earned (0-3), best attempt kept
}

export function loadProgress(): Progress {
  if (typeof window === "undefined") return { stars: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stars: {} };
    const parsed = JSON.parse(raw);
    return { stars: parsed.stars ?? {} };
  } catch {
    return { stars: {} };
  }
}

export function saveLevelResult(progress: Progress, level: number, stars: number): Progress {
  const best = Math.max(progress.stars[level] ?? 0, stars);
  const next: Progress = { stars: { ...progress.stars, [level]: best } };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — ignore */
  }
  return next;
}

export function resetProgress(): Progress {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return { stars: {} };
}

export function isLevelUnlocked(progress: Progress, level: number): boolean {
  if (level === 1) return true;
  return (progress.stars[level - 1] ?? 0) > 0;
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.stars).reduce((sum, s) => sum + s, 0);
}

export function levelsCompleted(progress: Progress): number {
  return Object.values(progress.stars).filter((s) => s > 0).length;
}

export { TOTAL_LEVELS };
