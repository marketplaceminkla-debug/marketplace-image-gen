"use client";

import { type LucideIcon, Sparkles, Check } from "lucide-react";

interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** Bullet points describing what this page will contain. */
  features: string[];
}

export default function PlaceholderPage({ icon: Icon, title, subtitle, features }: PlaceholderPageProps) {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <Icon size={24} className="text-brand-hover" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{title}</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-light text-brand-hover border border-brand-muted">
                <Sparkles size={11} /> Segera hadir
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          </div>
        </div>

        {/* Planned content card */}
        <div className="mt-6 max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Yang bakal ada di sini
          </p>
          <ul className="space-y-2.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-success-light flex items-center justify-center shrink-0">
                  <Check size={12} className="text-success" />
                </span>
                <span className="text-sm text-slate-700 leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-400 mt-5">
          Halaman ini masih kerangka. Isinya bakal kita bangun di tahap berikutnya. 🚧
        </p>
      </div>
    </div>
  );
}
