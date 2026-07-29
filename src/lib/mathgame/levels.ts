// Math question generation for the "Pulau Angka" adventure map.
// 14 levels, difficulty rises in tiers; each level = 3 multiple-choice questions.

export const TOTAL_LEVELS = 14;
export const QUESTIONS_PER_LEVEL = 3;
export const MAX_STARS = TOTAL_LEVELS * QUESTIONS_PER_LEVEL;

export interface MathQuestion {
  prompt: string;
  answer: number;
  options: number[];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOptions(answer: number, spread: number): number[] {
  const set = new Set<number>([answer]);
  while (set.size < 4) {
    const delta = randInt(-spread, spread) || 1;
    const candidate = answer + delta;
    if (candidate >= 0 && !set.has(candidate)) set.add(candidate);
  }
  return shuffle(Array.from(set));
}

function addSub(min: number, max: number, spread: number): MathQuestion {
  const isAdd = Math.random() < 0.5;
  let a = randInt(min, max);
  let b = randInt(min, max);
  if (!isAdd && b > a) [a, b] = [b, a];
  const answer = isAdd ? a + b : a - b;
  return {
    prompt: `${a} ${isAdd ? "+" : "-"} ${b} = ?`,
    answer,
    options: buildOptions(answer, spread),
  };
}

function mul(maxTable: number): MathQuestion {
  const a = randInt(2, maxTable);
  const b = randInt(2, 10);
  const answer = a * b;
  return { prompt: `${a} × ${b} = ?`, answer, options: buildOptions(answer, 8) };
}

function div(maxTable: number): MathQuestion {
  const b = randInt(2, maxTable);
  const a = randInt(2, 10);
  const answer = a;
  return { prompt: `${a * b} ÷ ${b} = ?`, answer, options: buildOptions(answer, 5) };
}

function mixed(): MathQuestion {
  const kind = randInt(0, 3);
  if (kind === 0) return addSub(10, 99, 10);
  if (kind === 1) return mul(10);
  if (kind === 2) return div(10);
  return addSub(20, 200, 15);
}

const WORD_TEMPLATES = [
  (a: number, b: number) => ({
    prompt: `Ani punya ${a} permen, lalu diberi ${b} lagi oleh kakaknya. Berapa jumlah permen Ani sekarang?`,
    answer: a + b,
  }),
  (a: number, b: number) => ({
    prompt: `Budi punya ${a + b} kelereng, ${b} diberikan ke temannya. Sisa kelereng Budi ada berapa?`,
    answer: a,
  }),
  (a: number, b: number) => ({
    prompt: `Di kelas ada ${a} kelompok, masing-masing berisi ${b} anak. Berapa jumlah anak semuanya?`,
    answer: a * b,
  }),
];

function wordProblem(): MathQuestion {
  const a = randInt(2, 12);
  const b = randInt(2, 9);
  const t = WORD_TEMPLATES[randInt(0, WORD_TEMPLATES.length - 1)](a, b);
  return { prompt: t.prompt, answer: t.answer, options: buildOptions(t.answer, 10) };
}

// Each entry generates ONE question appropriate for the level's tier.
const GENERATORS: Array<() => MathQuestion> = [
  () => addSub(1, 10, 3), // 1
  () => addSub(1, 10, 3), // 2
  () => addSub(5, 20, 4), // 3
  () => addSub(10, 50, 6), // 4
  () => addSub(10, 50, 6), // 5
  () => mul(5), // 6
  () => mul(5), // 7
  () => mul(10), // 8
  () => mul(10), // 9
  () => div(10), // 10
  () => div(10), // 11
  () => mixed(), // 12
  () => wordProblem(), // 13
  () => wordProblem(), // 14
];

export function levelTitle(level: number): string {
  if (level <= 5) return "Tambah & Kurang";
  if (level <= 9) return "Perkalian";
  if (level <= 11) return "Pembagian";
  return "Soal Campuran";
}

export function generateLevelQuestions(level: number): MathQuestion[] {
  const gen = GENERATORS[level - 1] ?? mixed;
  return Array.from({ length: QUESTIONS_PER_LEVEL }, () => gen());
}
