"use client";

import { useState } from "react";
import { Clock, LogOut, RefreshCw, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function PendingScreen({ reason }: { reason: "pending" | "no-access" }) {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  // Signed in but no profile row came back: usually a network problem on this
  // device, not an unapproved account — say so instead of "menunggu persetujuan".
  const loadFailed = reason === "pending" && !profile;
  const email = profile?.email || session?.user?.email;

  async function retry() {
    setRetrying(true);
    await refreshProfile();
    setRetrying(false);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-main-bg px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-light border border-brand-muted flex items-center justify-center mx-auto mb-4">
          <Clock size={26} className="text-brand-hover" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">
          {loadFailed ? "Data akun gagal dimuat" : reason === "pending" ? "Akun menunggu persetujuan" : "Belum ada akses"}
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          {loadFailed
            ? "Login berhasil, tapi data akun nggak kebaca — biasanya karena koneksi internet di perangkat ini. Klik Coba lagi, atau ganti jaringan (misal hotspot HP)."
            : reason === "pending"
            ? "Akun kamu sudah dibuat. Super Admin perlu menyetujui dan memberi akses dulu sebelum kamu bisa masuk."
            : "Akun kamu aktif tapi belum diberi akses ke menu mana pun. Hubungi Super Admin untuk diatur."}
        </p>
        {email && (
          <p className="text-xs text-slate-400 mt-3">Masuk sebagai {email}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-2">
        <button
          onClick={retry}
          disabled={retrying}
          className="btn-bounce inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {retrying ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Coba lagi
        </button>
        <button
          onClick={signOut}
          className="btn-bounce inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <LogOut size={15} /> Keluar
        </button>
        </div>
      </div>
    </div>
  );
}
