"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, RefreshCw, Loader2, Check, UserPlus, Copy, X, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth, type Profile, type Role } from "@/lib/auth";
import { listWarehouses, type Warehouse } from "@/lib/warehouse";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "product", label: "Product Listing" },
  { id: "warehouse", label: "Multiwarehouse" },
  { id: "stock", label: "Stock Management" },
  { id: "tools", label: "Tools" },
];

const ROLES: Role[] = ["staff", "admin", "super_admin"];

interface CreatedAccount { email: string; password: string; }

export default function UserManagementPanel() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tambah Akun (Super Admin creates the login directly, no self-signup round-trip)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("staff");
  const [newAccess, setNewAccess] = useState<string[]>([]);
  const [newWarehouseScope, setNewWarehouseScope] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  // Maintenance: manually run the product-photos cleanup (normally weekly via Vercel Cron)
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null);

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
  useEffect(() => { listWarehouses().then(setWarehouses); }, []);

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

  function toggleWarehouseScope(row: Profile, whId: string) {
    const scope = row.warehouse_scope ?? [];
    const has = scope.includes(whId);
    const warehouse_scope = has ? scope.filter((w) => w !== whId) : [...scope, whId];
    update(row.id, { warehouse_scope });
  }

  function toggleNewAccess(sectionId: string) {
    setNewAccess((a) => (a.includes(sectionId) ? a.filter((x) => x !== sectionId) : [...a, sectionId]));
  }

  function toggleNewWarehouseScope(whId: string) {
    setNewWarehouseScope((a) => (a.includes(whId) ? a.filter((x) => x !== whId) : [...a, whId]));
  }

  function resetAddForm() {
    setNewFullName(""); setNewEmail(""); setNewRole("staff"); setNewAccess([]); setNewWarehouseScope([]); setCreateError(null);
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim()) { setCreateError("Nama dan email wajib diisi."); return; }
    setCreating(true);
    setCreateError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setCreateError("Sesi habis, coba login ulang."); setCreating(false); return; }

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: newFullName.trim(), email: newEmail.trim(), role: newRole, access: newAccess,
          warehouseScope: (newAccess.includes("warehouse") || newAccess.includes("stock")) ? newWarehouseScope : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) { setCreateError(json.error || "Gagal bikin akun."); setCreating(false); return; }
      setCreatedAccount({ email: json.email, password: json.password });
      setShowAddForm(false);
      resetAddForm();
      await load();
    } catch {
      setCreateError("Gagal terhubung ke server.");
    }
    setCreating(false);
  }

  async function handleCopyCreds() {
    if (!createdAccount) return;
    await navigator.clipboard.writeText(`Email: ${createdAccount.email}\nPassword: ${createdAccount.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCleanupPhotos() {
    setCleaning(true);
    setCleanupMsg(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setCleanupMsg("Sesi habis, coba login ulang."); setCleaning(false); return; }

    let totalDeleted = 0;
    let round = 0;
    try {
      // Server hanya membersihkan sebagian tiap panggilan (biar gak timeout
      // kalau foto numpuk banyak) — ulangi sampai beneran habis.
      for (;;) {
        round++;
        if (round > 1) setCleanupMsg(`Masih ada sisa, lanjut membersihkan… (${totalDeleted} foto terhapus sejauh ini)`);
        const res = await fetch("/api/cron/cleanup-photos", { headers: { Authorization: `Bearer ${token}` } });
        const text = await res.text();
        let json: { ok?: boolean; error?: string; deleted?: number; retentionDays?: number; more?: boolean };
        try {
          json = JSON.parse(text);
        } catch {
          setCleanupMsg(`Server error (status ${res.status}): ${text.slice(0, 200) || "respons kosong"}`);
          setCleaning(false);
          return;
        }
        if (!res.ok || !json.ok) {
          setCleanupMsg(json.error || `Gagal membersihkan foto (status ${res.status}).`);
          setCleaning(false);
          return;
        }
        totalDeleted += json.deleted ?? 0;
        if (!json.more || round >= 500) break;
      }
      setCleanupMsg(`Selesai! Total ${totalDeleted} foto lama dihapus dari storage.`);
    } catch (err) {
      setCleanupMsg(`Gagal terhubung ke server: ${err instanceof Error ? err.message : String(err)}`);
    }
    setCleaning(false);
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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setShowAddForm((v) => !v); if (showAddForm) resetAddForm(); }}
              className="btn-bounce inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 text-sm font-semibold"
            >
              <UserPlus size={14} /> Tambah Akun
            </button>
            <button
              onClick={load}
              className="btn-bounce inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Maintenance: manual storage cleanup */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
          <p className="text-sm font-bold text-slate-900 mb-1">Maintenance</p>
          <p className="text-xs text-slate-500 mb-3">Hapus foto hasil generate yang lebih tua dari 7 hari dari Supabase Storage (biasanya otomatis tiap minggu — ini buat bersihin manual sekarang juga).</p>
          {cleanupMsg && <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">{cleanupMsg}</p>}
          <button
            onClick={handleCleanupPhotos}
            disabled={cleaning}
            className="btn-bounce inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-danger/30 bg-danger-light text-danger text-sm font-semibold hover:bg-danger hover:text-white disabled:opacity-60"
          >
            {cleaning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Bersihkan Foto Lama Sekarang
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleCreateAccount} className="bg-white rounded-2xl border border-brand-muted shadow-sm p-4 md:p-5 mb-4">
            <p className="text-sm font-bold text-slate-900 mb-3">Tambah Akun Baru</p>
            {createError && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-3">{createError}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500">Nama lengkap</label>
                <input
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Nama anggota tim"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {newRole !== "super_admin" && (
              <div className="mt-2.5">
                <label className="text-[11px] text-slate-500">Hak akses menu</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SECTIONS.map((s) => {
                    const checked = newAccess.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggleNewAccess(s.id)}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          checked ? "bg-brand-light text-brand-hover border-brand-muted" : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked ? "bg-brand" : "bg-slate-200"}`}>
                          {checked && <Check size={10} className="text-slate-900" />}
                        </span>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {newRole !== "super_admin" && (newAccess.includes("warehouse") || newAccess.includes("stock")) && warehouses.length > 0 && (
              <div className="mt-2.5">
                <label className="text-[11px] text-slate-500">Cabang gudang (kosongkan = semua cabang)</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {warehouses.map((w) => {
                    const checked = newWarehouseScope.includes(w.id);
                    return (
                      <button
                        type="button"
                        key={w.id}
                        onClick={() => toggleNewWarehouseScope(w.id)}
                        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          checked ? "bg-brand-light text-brand-hover border-brand-muted" : "bg-white text-slate-500 border-slate-200"
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked ? "bg-brand" : "bg-slate-200"}`}>
                          {checked && <Check size={10} className="text-slate-900" />}
                        </span>
                        {w.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2.5">Password digenerate otomatis dan cuma ditampilkan sekali — akun langsung aktif, gak perlu approve lagi.</p>
            <button type="submit" disabled={creating}
              className="btn-bounce mt-3 px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Buat Akun
            </button>
          </form>
        )}

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

                  {/* Warehouse scope — relevant when the account has Multiwarehouse or Stock Management access */}
                  {row.role !== "super_admin" && (row.access.includes("warehouse") || row.access.includes("stock")) && warehouses.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Cabang gudang (kosongkan = semua cabang)</p>
                      <div className="flex flex-wrap gap-2">
                        {warehouses.map((w) => {
                          const checked = (row.warehouse_scope ?? []).includes(w.id);
                          return (
                            <button
                              key={w.id}
                              onClick={() => toggleWarehouseScope(row, w.id)}
                              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                checked
                                  ? "bg-brand-light text-brand-hover border-brand-muted"
                                  : "bg-white text-slate-500 border-slate-200"
                              }`}
                            >
                              <span className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked ? "bg-brand" : "bg-slate-200"}`}>
                                {checked && <Check size={10} className="text-slate-900" />}
                              </span>
                              {w.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Show generated password once */}
      {createdAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-slate-900">Akun berhasil dibuat!</p>
              <button onClick={() => setCreatedAccount(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-3">Catat / kirim ke orangnya sekarang — password ini cuma tampil sekali.</p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 font-mono text-sm">
              <p><span className="text-slate-400">Email:</span> <span className="text-slate-900">{createdAccount.email}</span></p>
              <p><span className="text-slate-400">Password:</span> <span className="text-slate-900 font-bold">{createdAccount.password}</span></p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleCopyCreds}
                className="flex-1 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Tersalin!" : "Salin"}
              </button>
              <button onClick={() => setCreatedAccount(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
