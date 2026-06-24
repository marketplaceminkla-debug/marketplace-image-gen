import { NextResponse } from "next/server";
import { supabase, PRODUCT_PHOTOS_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Foto hasil generate dihapus setelah lebih tua dari ini.
const RETENTION_DAYS = 7;

/**
 * Weekly cleanup of generated product photos (bucket: product-photos).
 * Triggered by Vercel Cron (see vercel.json). Protected by CRON_SECRET:
 * Vercel sends it as a Bearer token automatically when the env var is set.
 *
 * Only product-photos is touched — frame templates, Shopee templates, and
 * warehouse resi files are left alone.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET belum diset di Vercel — pembersihan dimatikan demi keamanan." },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const bucket = PRODUCT_PHOTOS_BUCKET;
  const toDelete: string[] = [];

  try {
    const { data: root, error: rootErr } = await supabase.storage.from(bucket).list("", { limit: 1000 });
    if (rootErr) throw rootErr;

    for (const entry of root ?? []) {
      // Folders are returned with id === null; recurse one level into them.
      if (entry.id === null) {
        let offset = 0;
        for (;;) {
          const { data: files, error } = await supabase.storage
            .from(bucket)
            .list(entry.name, { limit: 1000, offset });
          if (error) throw error;
          if (!files || files.length === 0) break;
          for (const f of files) {
            const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
            if (ts < cutoff) toDelete.push(`${entry.name}/${f.name}`);
          }
          if (files.length < 1000) break;
          offset += 1000;
        }
      } else {
        const ts = entry.created_at ? new Date(entry.created_at).getTime() : 0;
        if (ts < cutoff) toDelete.push(entry.name);
      }
    }

    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) throw error;
      deleted += batch.length;
    }

    return NextResponse.json({ ok: true, bucket, retentionDays: RETENTION_DAYS, deleted });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
