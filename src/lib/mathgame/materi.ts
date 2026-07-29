import { levelTier } from "./levels";

export interface ContohSoal {
  soal: string;
  langkah: string[];
  jawaban: string;
}

export interface Materi {
  materiPokok: string;
  subMateri: string;
  tujuan: string;
  poin: string[];
  contoh: ContohSoal;
}

const MATERI_BY_TIER: Record<number, Materi> = {
  1: {
    materiPokok: "Operasi Hitung",
    subMateri: "Penjumlahan dan Pengurangan Bilangan Cacah sampai 100.000",
    tujuan: "Murid mampu melakukan operasi penjumlahan dan pengurangan bilangan cacah sampai 100.000.",
    poin: [
      "Penjumlahan adalah menggabungkan dua bilangan atau lebih menjadi satu jumlah total.",
      "Pengurangan adalah mencari selisih (sisa) antara dua bilangan.",
      "Susun bilangan sesuai nilai tempatnya (satuan, puluhan, ratusan) agar mudah dihitung.",
    ],
    contoh: {
      soal: "245 + 132 = ?",
      langkah: ["Satuan: 5 + 2 = 7", "Puluhan: 4 + 3 = 7", "Ratusan: 2 + 1 = 3"],
      jawaban: "Jadi, 245 + 132 = 377",
    },
  },
  2: {
    materiPokok: "Operasi Hitung",
    subMateri: "Perkalian Bilangan Cacah sampai 100.000",
    tujuan: "Murid mampu melakukan operasi perkalian bilangan cacah sampai 100.000.",
    poin: [
      "Perkalian adalah penjumlahan berulang dari bilangan yang sama.",
      "a × b artinya a dijumlahkan sebanyak b kali.",
      "Hafalkan perkalian dasar 1-10 agar berhitung lebih cepat.",
    ],
    contoh: {
      soal: "24 × 3 = ?",
      langkah: ["Uraikan 24 = 20 + 4", "20 × 3 = 60", "4 × 3 = 12", "Jumlahkan: 60 + 12 = 72"],
      jawaban: "Jadi, 24 × 3 = 72",
    },
  },
  3: {
    materiPokok: "Operasi Hitung",
    subMateri: "Pembagian Bilangan Cacah sampai 100.000",
    tujuan: "Murid mampu melakukan operasi pembagian bilangan cacah sampai 100.000.",
    poin: [
      "Pembagian adalah kebalikan (invers) dari perkalian.",
      "a ÷ b artinya a dibagi rata menjadi b kelompok.",
      "Gunakan hafalan perkalian untuk mempermudah pembagian.",
    ],
    contoh: {
      soal: "84 ÷ 4 = ?",
      langkah: ["Cari bilangan yang jika dikali 4 hasilnya 84", "4 × 20 = 80", "4 × 21 = 84 ✓"],
      jawaban: "Jadi, 84 ÷ 4 = 21",
    },
  },
  4: {
    materiPokok: "Operasi Hitung",
    subMateri: "Campuran Penjumlahan, Pengurangan, Perkalian, dan Pembagian Bilangan Cacah sampai 100.000",
    tujuan:
      "Murid mampu melakukan operasi penjumlahan, pengurangan, perkalian, dan pembagian bilangan cacah sampai 100.000.",
    poin: [
      "Kerjakan perkalian dan pembagian terlebih dahulu sebelum penjumlahan dan pengurangan.",
      "Baca soal cerita dengan teliti untuk menentukan operasi yang tepat.",
      "Periksa kembali jawabanmu sebelum memilih.",
    ],
    contoh: {
      soal: "Ibu membeli 5 kotak pensil, setiap kotak berisi 12 pensil. Lalu 8 pensil diberikan ke adik. Berapa sisa pensil ibu?",
      langkah: ["5 × 12 = 60 (jumlah pensil awal)", "60 − 8 = 52"],
      jawaban: "Jadi, sisa pensil ibu ada 52 buah",
    },
  },
};

export function getMateriForLevel(level: number): Materi {
  return MATERI_BY_TIER[levelTier(level)];
}
