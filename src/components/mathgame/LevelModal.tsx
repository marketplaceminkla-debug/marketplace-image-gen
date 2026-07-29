"use client";

import { useMemo, useState } from "react";
import { X, Star, ArrowRight, RotateCcw } from "lucide-react";
import { generateLevelQuestions, levelTitle, QUESTIONS_PER_LEVEL } from "@/lib/mathgame/levels";

interface Props {
  level: number;
  onClose: () => void;
  onFinish: (stars: number) => void;
}

export default function LevelModal({ level, onClose, onFinish }: Props) {
  const questions = useMemo(() => generateLevelQuestions(level), [level]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[step];

  function pick(option: number) {
    if (feedback) return;
    setSelected(option);
    const isCorrect = option === q.answer;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setCorrectCount((c) => c + 1);
    setTimeout(() => {
      if (step + 1 < QUESTIONS_PER_LEVEL) {
        setStep((s) => s + 1);
        setSelected(null);
        setFeedback(null);
      } else {
        setDone(true);
      }
    }, 900);
  }

  const stars = correctCount;

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

        {!done ? (
          <div className="p-6">
            <div className="flex gap-1.5 mb-6 justify-center">
              {Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) => (
                <div
                  key={i}
                  className={`h-2 w-10 rounded-full ${i < step ? "bg-emerald-400" : i === step ? "bg-sky-400" : "bg-slate-200"}`}
                />
              ))}
            </div>

            <p className="text-center text-2xl font-extrabold text-slate-800 mb-8 leading-snug">{q.prompt}</p>

            <div className="grid grid-cols-2 gap-3">
              {q.options.map((opt) => {
                const isSelected = selected === opt;
                const showCorrect = feedback && opt === q.answer;
                const showWrong = feedback && isSelected && opt !== q.answer;
                return (
                  <button
                    key={opt}
                    disabled={!!feedback}
                    onClick={() => pick(opt)}
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
        ) : (
          <div className="p-8 text-center">
            <p className="text-lg font-bold text-slate-700 mb-2">
              {stars === QUESTIONS_PER_LEVEL ? "Keren, sempurna! 🎉" : stars > 0 ? "Bagus, lanjutkan!" : "Ayo coba lagi!"}
            </p>
            <div className="flex justify-center gap-2 my-4">
              {Array.from({ length: QUESTIONS_PER_LEVEL }, (_, i) => (
                <Star
                  key={i}
                  size={40}
                  className={i < stars ? "fill-yellow-400 text-yellow-500" : "fill-slate-100 text-slate-300"}
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
                onClick={() => onFinish(stars)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-sky-500 text-white font-semibold hover:bg-sky-600"
              >
                Lanjut <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
