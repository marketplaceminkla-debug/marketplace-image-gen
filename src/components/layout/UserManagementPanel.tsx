"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, RefreshCw, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile, type Role } from "@/lib/auth";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "product", label: "Product Listing" },
  { id: "warehouse", label: "Multiwarehouse" },
  { id: "tools", label: "Tools" },
];

const ROLES: Role[] = ["staff", "admin", "super_admin"];

export default function UserManagementPanel() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setRows((data ?? []) as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function update(id: string, patch: Partial<Profile>) {
    setSavingId(id);
    setError(null);
    // Optimistic update
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) { setError(error.message); await load(); }
    setSavingId(null);
  }

  function toggleAccess(row: Profile, sectionId: string) {
    const has = row.access.includes(sectionId);
    const access = has ? row.access.filter((a) => a !== sectionId) : [...row.access, sectionId];
    update(row.id, { access });
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
              <Users size={24} className="text-brand-hover" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Kelola Akun</h1>
              <p className="text-sm text-slate-500 mt-1">Setujui anggota tim dan atur hak aksesnya.</p>
            </div>
          </div>
          <button
            onClick={load}
            className="btn-bounce inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shrink-0"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat akun…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">Belum ada akun terdaftar.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isMe = row.id === me?.id;
              const saving = savingId === row.id;
              return (
                <div key={row.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">{row.full_name || "(tanpa nama)"}</p>
                        {isMe && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-light text-brand-hover border border-brand-muted">kamu</span>}
                        {saving && <Loader2 size={13} className="animate-spin text-slate-400" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{row.email}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Role */}
                      <select
                        value={row.role}
                        disabled={isMe}
                        onChange={(e) => update(row.id, { role: e.target.value as Role })}
                        className="text-xs rounded-lg border border-slate-200 bg-white text-slate-700 px-2 py-1.5 disabled:opacity-60"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>

                      {/* Active toggle */}
                      <button
                        onClick={() => !isMe && update(row.id, { is_active: !row.is_active })}
                        disabled={isMe}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
                          row.is_active
                            ? "bg-success-light text-success border-success/30"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {row.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </div>
                  </div>

                  {/* Access checkboxes */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Hak akses menu</p>
                    <div className="flex flex-wrap gap-2">
                      {row.role === "super_admin" ? (
                        <span className="text-xs text-slate-500">Super Admin punya akses ke semua menu.</span>
                      ) : (
                        SECTIONS.map((s) => {
                          const checked = row.access.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              onClick={() => toggleAccess(row, s.id)}
                              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                checked
                                  ? "bg-brand-light text-brand-hover border-brand-muted"
                                  : "bg-white text-slate-500 border-slate-200"
                              }`}
                            >
                              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked ? "bg-brand" : "bg-slate-200"}`}>
                                {checked && <Check size={10} className="text-slate-900" />}
                              </span>
                              {s.label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
