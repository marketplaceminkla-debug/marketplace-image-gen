"use client";

import { useMemo, useState } from "react";
import { X, Star, ArrowRight, RotateCcw, BookOpen, Lightbulb, ChevronRight, ChevronLeft } from "lucide-react";
import { generateLevelQuestions, levelTitle, QUESTIONS_PER_LEVEL } from "@/lib/mathgame/levels";
import { getMateriForLevel } from "@/lib/mathgame/materi";

interface Props {
  level: number;
  onClose: () => void;
  onFinish: (stars: number) => void;
}

type Slide = { kind: "materi" } | { kind: "contoh" } | { kind: "soal"; index: number } | { kind: "selesai" };

export default function LevelModal({ level, onClose, onFinish }: Props) {
  const questions = useMemo(() => generateLevelQuestions(level), [level]);
  const materi = useMemo(() => getMateriForLevel(level), [level]);

  const slides: Slide[] = useMemo(
    () => [
      { kind: "materi" },
      { kind: "contoh" },
      ...Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) => ({ kind: "soal" as const, index: i })),
      { kind: "selesai" },
    ],
    [level]
  );

  const [slideIdx, setSlideIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const slide = slides[slideIdx];
  const progressPct = ((slideIdx + 1) / slides.length) * 100;

  function goNext() {
    setSlideIdx((i) => Math.min(i + 1, slides.length - 1));
  }
  function goPrev() {
    setSlideIdx((i) => Math.max(i - 1, 0));
  }

  function pick(option: number, answer: number) {
    if (feedback) return;
    setSelected(option);
    const isCorrect = option === answer;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((c) => c + 1);
    setTimeout(() => {
      setSelected(null);
      setFeedback(null);
      goNext();
    }, 900);
  }

  const canNavigate = slide.kind === "materi" || slide.kind === "contoh";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-sky-500 text-white">
          <div>
            <p className="text-xs opacity-80">Level {level}</p>
            <p className="font-bold">{levelTitle(level)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20">
            <X size={20} />
          </button>
        </div>

        <div className="relative">
          {canNavigate && slideIdx > 0 && (
            <button
              onClick={goPrev}
              aria-label="Sebelumnya"
              className="absolute left-0 top-0 bottom-0 w-9 flex items-center justify-center bg-slate-800/10 hover:bg-slate-800/20 z-10"
            >
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
          )}
          {canNavigate && (
            <button
              onClick={goNext}
              aria-label="Selanjutnya"
              className="absolute right-0 top-0 bottom-0 w-9 flex items-center justify-center bg-slate-800/10 hover:bg-slate-800/20 z-10"
            >
              <ChevronRight size={20} className="text-slate-600" />
            </button>
          )}

          <div className="px-9 py-6 min-h-[320px] flex flex-col justify-center">
            {slide.kind === "materi" && (
              <div>
                <div className="flex items-center gap-2 mb-4 text-sky-600">
                  <BookOpen size={22} />
                  <h2 className="font-extrabold text-lg">Tujuan Pembelajaran</h2>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-sm">
                  <p>
                    <span className="font-bold text-slate-700">Materi Pokok:</span>{" "}
                    <span className="text-slate-600">{materi.materiPokok}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-700">Sub Materi:</span>{" "}
                    <span className="text-slate-600">{materi.subMateri}</span>
                  </p>
                  <p>
                    <span className="font-bold text-slate-700">Tujuan:</span>{" "}
                    <span className="text-slate-600">{materi.tujuan}</span>
                  </p>
                </div>
                <ul className="mt-4 space-y-2">
                  {materi.poin.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <span className="text-sky-500 mt-0.5">●</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {slide.kind === "contoh" && (
              <div>
                <div className="flex items-center gap-2 mb-4 text-emerald-600">
                  <Lightbulb size={22} />
                  <h2 className="font-extrabold text-lg">Contoh Soal</h2>
                </div>
                <p className="font-bold text-slate-800 text-lg mb-4">{materi.contoh.soal}</p>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5 text-sm text-slate-600">
                  {materi.contoh.langkah.map((l, i) => (
                    <p key={i}>
                      {i + 1}. {l}
                    </p>
                  ))}
                </div>
                <p className="mt-4 font-bold text-emerald-700 text-center">{materi.contoh.jawaban}</p>
              </div>
            )}

            {slide.kind === "soal" && (
              <div>
                <div className="flex gap-1.5 mb-6 justify-center">
                  {Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-10 rounded-full ${
                        i < slide.index ? "bg-emerald-400" : i === slide.index ? "bg-sky-400" : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-center text-2xl font-extrabold text-slate-800 mb-8 leading-snug">
                  {questions[slide.index].prompt}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {questions[slide.index].options.map((opt) => {
                    const answer = questions[slide.index].answer;
                    const isSelected = selected === opt;
                    const showCorrect = feedback && opt === answer;
                    const showWrong = feedback && isSelected && opt !== answer;
                    return (
                      <button
                        key={opt}
                        disabled={!!feedback}
                        onClick={() => pick(opt, answer)}
                        className={`py-4 rounded-2xl text-xl font-bold border-2 transition-colors
                          ${showCorrect ? "bg-emerald-100 border-emerald-500 text-emerald-700" : ""}
                          ${showWrong ? "bg-red-100 border-red-500 text-red-700" : ""}
                          ${!feedback ? "border-slate-200 hover:border-sky-400 hover:bg-sky-50 text-slate-700" : ""}
                          ${!showCorrect && !showWrong && feedback ? "opacity-40 border-slate-200 text-slate-500" : ""}
                        `}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {slide.kind === "selesai" && (
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700 mb-2">
                  {correctCount === QUESTIONS_PER_LEVEL
                    ? "Selamat Berpetualang, Sempurna! 🎉"
                    : correctCount > 0
                    ? "Selamat Berpetualang, Lanjutkan!"
                    : "Ayo coba lagi!"}
                </p>
                <div className="flex justify-center gap-2 my-4">
                  {Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) => (
                    <Star
                      key={i}
                      size={40}
                      className={i < correctCount ? "fill-yellow-400 text-yellow-500" : "fill-slate-100 text-slate-300"}
                    />
                  ))}
                </div>
                <p className="text-slate-500 text-sm mb-6">
                  {correctCount} dari {QUESTIONS_PER_LEVEL} jawaban benar
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    <RotateCcw size={16} /> Peta
                  </button>
                  <button
                    onClick={() => onFinish(correctCount)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-sky-500 text-white font-semibold hover:bg-sky-600"
                  >
                    Lanjut <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-2 bg-slate-100">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </div>
  );
}
