"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ListChecks, Plus, Loader2, Trash2, Check, Target, Lightbulb, Pin,
  Paperclip, X, FileText, Eye, Upload,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  TalItem, TalCategory, listTalItems, addTalItem, updateTalItem, deleteTalItem,
  currentMonth, monthLabel, uploadTalProof,
} from "@/lib/tal";

const CATEGORY = {
  target:   { label: "Target",   icon: Target,    style: "bg-brand-light text-brand-hover border-brand-muted" },
  strategi: { label: "Strategi", icon: Lightbulb, style: "bg-kla-purpleLight text-kla-purple border-kla-purple/20" },
  lainnya:  { label: "Lainnya",  icon: Pin,       style: "bg-slate-100 text-slate-500 border-slate-200" },
} as const;

const PIC_LIST = ["Semua", "Rona", "Diza", "Alfin", "Mauren"] as const;
type PicFilter = (typeof PIC_LIST)[number];

// ── Proof upload modal ──
function ProofModal({
  item,
  onClose,
  onSaved,
}: {
  item: TalItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const { url, name, error: uploadErr } = await uploadTalProof(file);
    if (uploadErr || !url) { setError(uploadErr ?? "Gagal upload"); setUploading(false); return; }
    const { error: saveErr } = await updateTalItem(item.id, {
      is_done: true,
      proof_url: url,
      proof_name: name,
    });
    setUploading(false);
    if (saveErr) { setError(saveErr); return; }
    onSaved();
    onClose();
  }

  const isPdf = file?.type === "application/pdf";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-semibold text-sm">Upload Bukti Pencapaian</h2>
            <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{item.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className="border-2 border-dashed border-slate-600 hover:border-brand rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
            ) : file ? (
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <FileText size={36} className="text-slate-500" />
                <span className="text-sm">{file.name}</span>
                {isPdf && <span className="text-xs text-slate-500">PDF · {(file.size / 1024).toFixed(0)} KB</span>}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Upload size={28} />
                <p className="text-sm">Klik atau drag & drop file di sini</p>
                <p className="text-xs">Gambar (JPG, PNG, WEBP) atau PDF · maks 10 MB</p>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Existing proof */}
          {item.proof_url && !file && (
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800 rounded-lg px-3 py-2">
              <Paperclip size={12} />
              <span className="flex-1 truncate">{item.proof_name ?? "Bukti tersimpan"}</span>
              <a href={item.proof_url} target="_blank" rel="noreferrer"
                className="text-brand hover:underline flex items-center gap-1">
                <Eye size={12} /> Lihat
              </a>
            </div>
          )}

          {error && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 transition-colors">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={!file || uploading}
            className="flex-1 px-4 py-2 rounded-xl bg-brand text-black text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Mengupload…</> : <><Check size={14} /> Simpan & Tandai Selesai</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Proof preview chip ──
function ProofChip({ url, name }: { url: string; name: string | null }) {
  const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 border border-green-700/40 text-green-400 hover:bg-green-800/40 transition-colors shrink-0">
      {isImg ? <Eye size={10} /> : <FileText size={10} />}
      {name ? name.slice(0, 20) + (name.length > 20 ? "…" : "") : "Bukti"}
    </a>
  );
}

export default function TalPanel() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin";

  const [items, setItems] = useState<TalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [pic, setPic] = useState<PicFilter>("Semua");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TalCategory>("target");
  const [picAdd, setPicAdd] = useState<string>("Rona");
  const [busy, setBusy] = useState(false);

  const [proofItem, setProofItem] = useState<TalItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setItems(await listTalItems());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const set = new Set(items.map((i) => i.month));
    set.add(currentMonth());
    set.add(month);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [items, month]);

  const monthItems = useMemo(
    () => items.filter((i) => {
      if (i.month !== month) return false;
      if (pic === "Semua") return true;
      return i.pic_name === pic;
    }),
    [items, month, pic],
  );
  const doneCount = monthItems.filter((i) => i.is_done).length;
  const pct = monthItems.length > 0 ? (doneCount / monthItems.length) * 100 : 0;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Isi dulu apa yang mau dicapai."); return; }
    setBusy(true);
    setError(null);
    const { error } = await addTalItem({
      month, title: title.trim(), category,
      pic_name: picAdd,
      created_by: profile?.id ?? null,
    });
    setBusy(false);
    if (error) { setError(error); return; }
    setTitle("");
    load();
  }

  async function toggle(item: TalItem) {
    if (item.is_done) {
      // Unmark done (admin only)
      if (!isAdmin) return;
      setItems((rs) => rs.map((r) => r.id === item.id ? { ...r, is_done: false } : r));
      await updateTalItem(item.id, { is_done: false });
      load();
    } else {
      // Open proof upload modal
      setProofItem(item);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;
    setItems((rs) => rs.filter((r) => r.id !== id));
    const { error } = await deleteTalItem(id);
    if (error) { setError(error); load(); }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 md:px-10 py-6 md:py-8 max-w-3xl">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0 border border-brand-muted">
            <ListChecks size={24} className="text-brand-hover" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">TAL — To Achieve List</h1>
            <p className="text-sm text-slate-500 mt-1">Target & strategi tim tiap bulan. Centang item + upload bukti untuk tandai selesai.</p>
          </div>
        </div>

        {error && <p className="text-xs text-danger bg-danger-light rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Month selector */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {months.map((m) => (
            <button key={m} onClick={() => setMonth(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                m === month ? "bg-brand text-slate-900 border-brand" : "bg-white text-slate-600 border-slate-200"
              }`}>
              {monthLabel(m)}
            </button>
          ))}
          <input type="month" value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="px-2 py-1.5 rounded-full text-xs border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-brand"
            title="Pilih / tambah bulan lain" />
        </div>

        {/* PIC filter */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4 w-fit">
          {PIC_LIST.map((p) => (
            <button key={p} onClick={() => setPic(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                pic === p ? "bg-brand text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}>
              {p}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-slate-700">
              Progress {monthLabel(month)}{pic !== "Semua" ? ` — ${pic}` : ""}
            </span>
            <span className="text-sm font-bold text-brand-hover">{doneCount}/{monthItems.length} · {pct.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Add form — semua user bisa tambah */}
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">+ Tambah Target / TAL</p>
          <div className="flex flex-col gap-2.5">
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={`Apa yang mau dicapai di ${monthLabel(month)}?`}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand" />
            <div className="flex gap-2 flex-wrap">
              <select value={picAdd} onChange={(e) => setPicAdd(e.target.value)}
                className="flex-1 min-w-[100px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand">
                <option value="Rona">Rona</option>
                <option value="Diza">Diza</option>
                <option value="Alfin">Alfin</option>
                <option value="Mauren">Mauren</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value as TalCategory)}
                className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-brand">
                <option value="target">🎯 Target</option>
                <option value="strategi">💡 Strategi</option>
                <option value="lainnya">📌 Lainnya</option>
              </select>
              <button type="submit" disabled={busy}
                className="btn-bounce px-4 py-2 rounded-lg bg-brand hover:bg-brand-hover text-slate-900 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Tambah
              </button>
            </div>
          </div>
        </form>

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
            <Loader2 size={16} className="animate-spin" /> Memuat…
          </div>
        ) : monthItems.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">
            Belum ada TAL untuk {monthLabel(month)}{pic !== "Semua" ? ` — ${pic}` : ""}. Tambah di atas.
          </p>
        ) : (
          <div className="space-y-2">
            {monthItems.map((item) => {
              const cat = CATEGORY[item.category];
              const CatIcon = cat.icon;
              return (
                <div key={item.id}
                  className={`bg-white rounded-xl border shadow-sm p-3 flex items-start gap-3 transition-colors ${
                    item.is_done ? "border-green-200 bg-green-50/50" : "border-slate-200"
                  }`}>

                  {/* Checkbox — klik buka modal upload bukti */}
                  <button
                    onClick={() => toggle(item)}
                    title={item.is_done ? (isAdmin ? "Klik untuk batalkan" : "Sudah selesai") : "Centang & upload bukti"}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      item.is_done
                        ? "bg-success border-success text-white cursor-default"
                        : "bg-white border-slate-300 hover:border-brand cursor-pointer"
                    }`}>
                    {item.is_done && <Check size={14} />}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className={`text-sm leading-snug ${item.is_done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {item.title}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.pic_name && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-kla-purpleLight text-kla-purple border border-kla-purple/20">
                          {item.pic_name}
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cat.style}`}>
                        <CatIcon size={10} /> {cat.label}
                      </span>
                      {item.proof_url && (
                        <ProofChip url={item.proof_url} name={item.proof_name} />
                      )}
                      {!item.is_done && (
                        <button
                          onClick={() => setProofItem(item)}
                          className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand px-2 py-0.5 rounded-full border border-dashed border-slate-300 hover:border-brand transition-colors">
                          <Paperclip size={10} /> Upload bukti
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete (admin only) */}
                  {isAdmin && (
                    <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-danger shrink-0 mt-0.5">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proof modal */}
      {proofItem && (
        <ProofModal
          item={proofItem}
          onClose={() => setProofItem(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
