"use client";

import { useState } from "react";
import { LayoutGrid, Mail, Lock, User, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email, password);
        if (error) setError(translate(error));
        // success: AuthProvider switches the screen automatically.
      } else {
        if (fullName.trim().length < 2) { setError("Isi nama lengkap dulu ya."); return; }
        if (password.length < 6) { setError("Password minimal 6 karakter."); return; }
        const { error, needsConfirm } = await signUp(email, password, fullName);
        if (error) { setError(translate(error)); return; }
        if (needsConfirm) {
          setInfo("Akun dibuat! Cek email kamu untuk konfirmasi, lalu login.");
          setMode("login");
        } else {
          setInfo("Akun dibuat! Menunggu persetujuan Super Admin.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-main-bg px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: "#2D1B69" }}>
            <LayoutGrid size={28} style={{ color: "#F5C200" }} />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Marketplace Workspace</h1>
          <p className="text-xs text-slate-500 mt-0.5">Internal tools untuk tim marketplace</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); setInfo(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {m === "login" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <Field icon={User} type="text" placeholder="Nama lengkap" value={fullName} onChange={setFullName} />
            )}
            <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} required />
            <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} required />

            {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2">{error}</p>}
            {info && <p className="text-xs text-success bg-success-light rounded-lg px-3 py-2">{info}</p>}

            <button
              type="submit"
              disabled={busy}
              className="btn-bounce w-full py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "login" ? "Masuk" : "Buat Akun"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-4">
          Akun baru perlu disetujui Super Admin sebelum bisa dipakai.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, type, placeholder, value, onChange, required,
}: {
  icon: typeof Mail; type: string; placeholder: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="relative">
      <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-muted"
      />
    </div>
  );
}

function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email atau password salah.";
  if (m.includes("already registered")) return "Email ini sudah terdaftar. Coba login.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Cek inbox kamu.";
  return msg;
}
