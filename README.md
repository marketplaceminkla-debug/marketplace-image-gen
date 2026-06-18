# ImgGen — Bulk Product Image Generator

Web app internal untuk generate cover produk marketplace (Shopee, Tokopedia, TikTok Shop) secara massal.

## Cara Kerja

1. Upload frame/overlay PNG branding toko Anda
2. Upload ratusan foto produk sekaligus
3. Klik "Generate Semua" — sistem akan otomatis:
   - Resize foto agar proporsional
   - Menempatkan foto di tengah canvas
   - Menempel frame di atas foto
   - Export ke JPEG kualitas tinggi
4. Download semua hasil dalam satu ZIP
   - Hasil otomatis dikelompokkan per produk (folder per 5 foto) + file deskripsi.txt di tiap folder

## Export ke Excel Mass Upload Shopee

PixelSeller bisa langsung menghasilkan file Excel Mass Upload Shopee dari hasil generate:

1. Buka menu **Template Shopee**, upload sekali file .xlsx Mass Upload asli dari Shopee Seller Centre
2. Setelah generate foto, klik tombol **Export Excel Shopee** di halaman Generate
3. Sistem akan: upload tiap foto ke Supabase (mendapat link publik), lalu mengisi template Shopee — Nama Produk, Deskripsi, Foto Sampul + 4 Foto Produk per produk (per grup 5 foto)

**Catatan penting tentang foto Shopee:** Kolom foto di Mass Upload Shopee hanya menerima URL/link publik (bukan file). Karena itu foto diupload dulu ke Supabase Storage (bucket `product-photos`, publik) dan link-nya yang dimasukkan ke Excel.

**Kolom yang WAJIB diedit manual** sebelum upload ke Shopee (tidak ada datanya di PixelSeller, diisi placeholder default): Kategori (kosong), Harga (0), Berat (100g), dan periksa Jasa Kirim.

## Import ZIP lama → Excel Shopee (tanpa generate ulang)

Kalau sudah punya ZIP hasil generate sebelumnya, tidak perlu generate ulang. Buka menu **Import ZIP → Shopee**:

1. Drop file ZIP hasil generate (format folder per produk: `1.jpg`–`5.jpg` + `deskripsi.txt`)
2. PixelSeller membaca tiap folder: nama folder → Nama Produk, `deskripsi.txt` → Deskripsi, foto → upload ke cloud
3. Output: file Excel Mass Upload Shopee siap pakai

Catatan: baris awal data terdeteksi otomatis (template Basic Shopee mulai baris 7, template Advanced/kategori mulai baris 6).

---

## Instalasi & Menjalankan Lokal

### Prasyarat

- **Node.js** v18 atau lebih baru → [nodejs.org](https://nodejs.org)
- **npm** v9+ (sudah termasuk dengan Node.js)

### Langkah Instalasi

```bash
# 1. Clone atau extract project ke folder lokal
cd marketplace-image-gen

# 2. Install dependencies
npm install

# 3. Jalankan development server
npm run dev
```

Buka browser: **http://localhost:3000**

### Build untuk Production

```bash
npm run build
npm start
```

---

## Struktur Folder

```
marketplace-image-gen/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── template/route.ts      # Upload/delete template
│   │   │   ├── preview/route.ts       # Generate preview 1 gambar
│   │   │   └── generate/
│   │   │       ├── route.ts           # Bulk generation
│   │   │       └── download/route.ts  # Download ZIP
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Root page
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx            # Navigasi kiri
│   │   │   ├── TemplatePanel.tsx      # Panel upload template
│   │   │   └── GeneratePanel.tsx      # Panel utama generate
│   │   └── ui/
│   │       ├── SettingsPanel.tsx      # Pengaturan output
│   │       ├── ImageGrid.tsx          # Grid foto produk
│   │       ├── ProcessingProgress.tsx # Progress bar animated
│   │       └── PreviewModal.tsx       # Modal preview
│   ├── lib/
│   │   ├── imageProcessor.ts          # Core Sharp logic
│   │   └── utils.ts                   # Helper functions
│   └── types/
│       └── index.ts                   # TypeScript types
├── data/                              # Auto-dibuat saat runtime
│   ├── templates/                     # Tempat simpan template
│   └── output/                        # Hasil generate + ZIP
├── public/
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

---

## Cara Penggunaan

### 1. Upload Template
- Buka menu **"Upload Template"** di sidebar
- Upload file PNG frame/overlay branding Anda
- Template PNG harus memiliki background transparan
- Template akan disimpan dan dipakai untuk semua foto

### 2. Generate Cover Produk
- Buka menu **"Generate Images"**
- Drag & drop atau pilih foto produk (JPG/PNG, bisa ratusan sekaligus)
- Atur preset marketplace di panel kanan (Shopee, Tokopedia, TikTok Shop)
- Klik **"Preview"** untuk melihat contoh hasil
- Klik **"Generate Semua"** untuk memproses semua foto
- Setelah selesai, klik **"Download ZIP"**

### 3. Preset Marketplace yang Tersedia
| Platform | Ukuran |
|----------|--------|
| Shopee Portrait | 720 × 1108 px |
| Shopee Square | 1000 × 1000 px |
| Tokopedia | 1000 × 1000 px |
| TikTok Shop | 800 × 800 px |
| Custom | Bebas |

---

## Konfigurasi

### Mengubah Ukuran Default
Edit `src/types/index.ts`:
```typescript
export const DEFAULT_SETTINGS: ProcessingSettings = {
  outputWidth: 720,   // ← ubah sesuai kebutuhan
  outputHeight: 1108, // ← ubah sesuai kebutuhan
  outputQuality: 90,
  outputPrefix: "cover_laptop",
};
```

### Mengubah Padding Foto Produk
Edit `src/lib/imageProcessor.ts`:
```typescript
const padding = Math.round(outputWidth * 0.05); // 0.05 = 5% padding
```

---

## Roadmap Fase 2

- [ ] **Auto Remove Background** — integrasi Remove.bg API atau model lokal
- [ ] **AI Judul Produk** — generate judul SEO-friendly pakai Claude/GPT
- [ ] **AI Deskripsi Shopee** — auto-fill deskripsi produk
- [ ] **Export CSV BigSeller** — siap import massal ke BigSeller
- [ ] **Multi-Template** — kelola beberapa frame untuk variasi promosi
- [ ] **Batch Watermark** — tambah watermark teks/logo
- [ ] **Auto Enhancement** — auto brightness, contrast, sharpness
- [ ] **Marketplace Presets Lanjutan** — Lazada, Blibli, Bukalapak
- [ ] **Background Replacement** — ganti background foto produk otomatis
- [ ] **Scheduler Export** — jadwalkan export otomatis

---

## Catatan Teknis

- Semua data tersimpan **lokal** — tidak ada data yang dikirim ke server eksternal
- Folder `data/` dibuat otomatis, **tidak perlu dibuat manual**
- Untuk batch besar (>500 foto), proses dilakukan per chunk 10 foto untuk menghindari timeout
- Output selalu JPEG (lebih kecil dari PNG) dengan mozjpeg compression
