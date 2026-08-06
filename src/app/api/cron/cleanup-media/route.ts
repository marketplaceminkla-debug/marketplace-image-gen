import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { WAREHOUSE_RESI_BUCKET, TAL_PROOF_BUCKET, TEMPLATES_BUCKET, PRODUCT_PHOTOS_BUCKET, SHOPEE_TEMPLATES_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Resi & bukti TAL dihapus otomatis setelah lebih tua dari ini.
const RETENTION_DAYS = 30;
const MAX_DELETES_PER_RUN = 300;

// Batas kuota storage (Supabase free tier = 1GB) — kalau kepakai udah lewat
// ambang ini, kirim notifikasi "system" ke Super Admin lewat bel notif,
// SEBELUM bucket sampai penuh & Supabase kunci project-nya.
const STORAGE_LIMIT_BYTES = Number(process.env.STORAGE_LIMIT_BYTES) || 1024 * 1024 * 1024;
const WARN_THRESHOLD = 0.8;

const ALL_BUCKETS = [TEMPLATES_BUCKET, PRODUCT_PHOTOS_BUCKET, SHOPEE_TEMPLATES_BUCKET, WAREHOUSE_RESI_BUCKET, TAL_PROOF_BUCKET];

function basename(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).pathname.split("/").pop() || null; } catch { return url.split("/").pop() || null; }
}

/**
 * Vercel Cron (daily, see vercel.json) — needs `SUPABASE_SERVICE_ROLE_KEY`
 * to bypass RLS for storage listing/deletion and to clear stale DB refs.
 * Auth: Bearer <CRON_SECRET>, sent automatically by Vercel Cron once that
 * env var is set.
 */
export async function GET(req: Request) {
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY belum diset." }, { status: 503 });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  async function cleanupBucket(bucket: string): Promise<{ deleted: number; more: boolean; names: string[] }> {
    const toDelete: string[] = [];
    let truncated = false;
    let offset = 0;
    for (;;) {
      const { data: files, error } = await admin.storage.from(bucket).list("", { limit: 1000, offset });
      if (error) throw error;
      if (!files || files.length === 0) break;
      for (const f of files) {
        const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
        if (ts && ts < cutoff) {
          toDelete.push(f.name);
          if (toDelete.length >= MAX_DELETES_PER_RUN) { truncated = true; break; }
        }
      }
      if (truncated || files.length < 1000) break;
      offset += 1000;
    }
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) throw error;
      deleted += batch.length;
    }
    return { deleted, more: truncated, names: toDelete };
  }

  async function bucketUsageBytes(bucket: string): Promise<number> {
    let total = 0;
    const { data: root } = await admin.storage.from(bucket).list("", { limit: 1000 });
    for (const entry of root ?? []) {
      if (entry.id === null) {
        let offset = 0;
        for (;;) {
          const { data: files } = await admin.storage.from(bucket).list(entry.name, { limit: 1000, offset });
          if (!files || files.length === 0) break;
          for (const f of files) total += (f.metadata as { size?: number } | null)?.size ?? 0;
          if (files.length < 1000) break;
          offset += 1000;
        }
      } else {
        total += (entry.metadata as { size?: number } | null)?.size ?? 0;
      }
    }
    return total;
  }

  try {
    const [resiResult, proofResult] = await Promise.all([
      cleanupBucket(WAREHOUSE_RESI_BUCKET),
      cleanupBucket(TAL_PROOF_BUCKET),
    ]);

    // Clear stale DB refs so the UI stops showing dead links instead of
    // just leaving the resi_url/proof_url pointing at a deleted file.
    let clearedOrders = 0;
    if (resiResult.names.length) {
      const deletedSet = new Set(resiResult.names);
      const { data: orders } = await admin.from("warehouse_orders").select("id, resi_url").not("resi_url", "is", null);
      const ids = (orders ?? []).filter((o) => deletedSet.has(basename(o.resi_url) ?? "")).map((o) => o.id);
      if (ids.length) {
        await admin.from("warehouse_orders").update({ resi_url: null }).in("id", ids);
        clearedOrders = ids.length;
      }
    }
    let clearedTal = 0;
    if (proofResult.names.length) {
      const deletedSet = new Set(proofResult.names);
      const { data: tal } = await admin.from("tal_items").select("id, proof_url").not("proof_url", "is", null);
      const ids = (tal ?? []).filter((t) => deletedSet.has(basename(t.proof_url) ?? "")).map((t) => t.id);
      if (ids.length) {
        await admin.from("tal_items").update({ proof_url: null, proof_name: null }).in("id", ids);
        clearedTal = ids.length;
      }
    }

    // ── Cek kuota storage, warn Super Admin sebelum kepenuhan ──
    const usages = await Promise.all(ALL_BUCKETS.map((b) => bucketUsageBytes(b)));
    const totalBytes = usages.reduce((s, n) => s + n, 0);
    const pct = totalBytes / STORAGE_LIMIT_BYTES;

    let warned = false;
    if (pct >= WARN_THRESHOLD) {
      // Dedupe: jangan spam notif tiap hari kalau udah pernah warn <24 jam terakhir.
      const { data: recent } = await admin
        .from("notifications")
        .select("id, created_at")
        .eq("category", "system")
        .order("created_at", { ascending: false })
        .limit(1);
      const lastWarnTs = recent?.[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
      if (Date.now() - lastWarnTs > 24 * 60 * 60 * 1000) {
        const usedMb = (totalBytes / 1024 / 1024).toFixed(0);
        const limitMb = (STORAGE_LIMIT_BYTES / 1024 / 1024).toFixed(0);
        await admin.from("notifications").insert({
          category: "system",
          title: `Storage Supabase ${(pct * 100).toFixed(0)}% penuh`,
          body: `${usedMb}MB dari ${limitMb}MB terpakai. Segera hapus file lama atau upgrade plan sebelum project ke-lock.`,
          target_view: "admin-users",
          actor_name: "Sistem",
        });
        warned = true;
      }
    }

    return NextResponse.json({
      ok: true,
      resi: { deleted: resiResult.deleted, more: resiResult.more, clearedOrders },
      talProof: { deleted: proofResult.deleted, more: proofResult.more, clearedTal },
      storage: { totalBytes, limitBytes: STORAGE_LIMIT_BYTES, pct: Number((pct * 100).toFixed(1)), warned },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
