"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Star, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAllDescTemplates,
  saveDescTemplate,
  updateDescTemplate,
  deleteDescTemplate,
  getActiveDescTemplateId,
  setActiveDescTemplate,
} from "@/lib/descriptionTemplateStorage";
import type { DescriptionTemplate } from "@/types";

const KLA_DEFAULT = `MELAYANI PENGIRIMAN INSTAN DARI SEMUA CABANG KLA COMPUTER (SAMPAI DI HARI YANG SAMA)

Selamat Datang di KLA Computer

Harap membaca sebelum membeli !
1. Tanyakan stock sebelum membeli.
Bisa chat admin untuk konsultasi / cari barang
2. KLA Computer adalah Master Dealer Hardware IT terbesar di Jawa Tengah & DIY
Garansi toko selama 7hari setelah unit diterima
Ganti baru atau pengembalian barang hanya untuk kerusakan cacat pabrik seperti mati / tidak berfungsi
3. Barang yang kami jual Baru, Asli dan Bergaransi Resmi.
4. Pengiriman sudah dibungkus dengan Bubble Wrap Tebal.
5. Pembelian sebelum Jam 12.00 akan kami Request Pickup Courier pada hari yang sama
6. Pembelian setelah Jam 12.00 akan kami Request Pickup Courier pada keesokan harinya
7. Cepat / lambatnya pengiriman adalah bergantung pada kecepatan ekspedisi
8. Jika pilih pengiriman Reguler TIDAK perlu order packing kayu
9. Jika pilih pengiriman Kargo WAJIB order packing kayu, jika tidak maka garansi toko hangus
10. WAJIB chat admin jika ada kendala SEBELUM memberikan review

{{SPEK_LENGKAP}}


- Ongkir sudah termasuk asuransi pengiriman jika menggunakan ekspedisi Shopee Express Standard/Instant.
- UNTUK EKSPEDISI KARGO (JNE TRUCKING) WAJIB ORDER PACKING KAYU. Jika tidak, maka GARANSI TOKO tidak bisa di klaim.
- Garansi toko 7 hari setelah barang di terima lebih dari itu masuk pusat servis resmi, (kerusakan yang di sebabkan cacat pabrik bukan dikarenakan human error. S&K berlaku)
- Barang dijamin 100% Baru, Original, dan Garansi Resmi
- Tolong Videokan (Unboxing) jika unit sudah tiba jika ingin mengklaim garansinya
- Membeli berarti setuju, terimakasih`;

export default function DescriptionTemplateSection() {
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formText, setFormText] = useState("");

  const reload = () => {
    setTemplates(getAllDescTemplates());
    setActiveId(getActiveDescTemplateId());
  };

  useEffect(() => { reload(); }, []);

  const handleNew = () => {
    setEditingId(null);
    setFormName("KLA Computer");
    setFormText(KLA_DEFAULT);
    setShowForm(true);
  };

  const handleEdit = (t: DescriptionTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormText(t.templateText);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formText.trim()) return;
    if (editingId) {
      updateDescTemplate(editingId, formName.trim(), formText.trim());
    } else {
      saveDescTemplate(formName.trim(), formText.trim());
    }
    setShowForm(false);
    setEditingId(null);
    reload();
  };

  const handleDelete = (id: string) => {
    deleteDescTemplate(id);
    reload();
  };

  const handleSetActive = (id: string) => {
    setActiveDescTemplate(id);
    setActiveId(id);
  };

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#E0F2F1" }}>
          <FileText size={18} style={{ color: "#0D9488" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Template Deskripsi Produk</h2>
          <p className="text-xs text-slate-400">Output .txt per produk saat generate. Gunakan <code className="bg-slate-100 px-1 rounded font-mono">{"{{SPEK_LENGKAP}}"}</code> sebagai placeholder spesifikasi.</p>
        </div>
        {!showForm && (
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors hover:opacity-90 shrink-0"
            style={{ background: "#0D9488" }}
          >
            <Plus size={14} /> Tambah
          </button>
        )}
      </div>

      {/* Template list */}
      {templates.length > 0 && !showForm && (
        <div className="space-y-2 mb-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className={cn(
                "bg-white border rounded-xl p-4 transition-all",
                t.id === activeId ? "border-teal-400 shadow-sm" : "border-slate-200"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                    {t.id === activeId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: "#CCFBF1", color: "#0D9488" }}>
                        AKTIF
                      </span>
                    )}
                  </div>
                  {/* Preview first 2 lines */}
                  <p className="text-xs text-slate-400 line-clamp-2 whitespace-pre-line">
                    {t.templateText.slice(0, 120)}{t.templateText.length > 120 ? "…" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {t.id !== activeId && (
                    <button onClick={() => handleSetActive(t.id)} title="Set aktif" className="w-8 h-8 rounded-lg hover:bg-teal-50 flex items-center justify-center text-slate-400 hover:text-teal-500 transition-colors">
                      <Star size={15} />
                    </button>
                  )}
                  {t.id === activeId && <Star size={15} style={{ color: "#0D9488" }} className="mx-1" />}
                  <button onClick={() => handleEdit(t)} title="Edit" className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} title="Hapus" className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {templates.length === 0 && !showForm && (
        <div
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-teal-300 hover:bg-teal-50/20"
          onClick={handleNew}
        >
          <FileText size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500 font-medium">Belum ada template deskripsi</p>
          <p className="text-xs text-slate-400 mt-1">Klik untuk tambah — template KLA Computer sudah disiapkan</p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{editingId ? "Edit Template" : "Template Baru"}</p>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-colors">
              <X size={14} />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nama Template</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="cth: KLA Computer"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400 bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              Isi Template <span className="text-slate-400 font-normal">— gunakan <code className="bg-white px-1 rounded font-mono">{"{{SPEK_LENGKAP}}"}</code> sebagai placeholder</span>
            </label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              rows={12}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-teal-400 bg-white resize-y"
              placeholder={"Isi template deskripsi produk...\n\n{{SPEK_LENGKAP}}\n\n...lanjutan deskripsi"}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex-1 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={!formName.trim() || !formText.trim()}
              className="flex-1 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ background: "#0D9488" }}
            >
              <Check size={14} /> Simpan Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
