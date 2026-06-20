"use client";

import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function PendingScreen({ reason }: { reason: "pending" | "no-access" }) {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-main-bg px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-light border border-brand-muted flex items-center justify-center mx-auto mb-4">
          <Clock size={26} className="text-brand-hover" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">
          {reason === "pending" ? "Akun menunggu persetujuan" : "Belum ada akses"}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {reason === "pending"
            ? "Akun kamu sudah dibuat. Super Admin perlu menyetujui dan memberi akses dulu sebelum kamu bisa masuk."
            : "Akun kamu aktif tapi belum diberi akses ke menu mana pun. Hubungi Super Admin untuk diatur."}
        </p>
        {profile?.email && (
          <p className="text-xs text-slate-400 mt-3">Masuk sebagai {profile.email}</p>
        )}
        <button
          onClick={signOut}
          className="btn-bounce mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <LogOut size={15} /> Keluar
        </button>
      </div>
    </div>
  );
}
