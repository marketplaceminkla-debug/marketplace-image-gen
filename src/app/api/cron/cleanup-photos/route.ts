import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase, PRODUCT_PHOTOS_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Foto hasil generate dihapus setelah lebih tua dari ini.
const RETENTION_DAYS = 7;

/**
 * Cleanup of generated product photos (bucket: product-photos). Two ways in:
 * 1. Vercel Cron (see vercel.json) sends `Bearer <CRON_SECRET>` automatically
 *    once that env var is set — runs weekly, unattended.
 * 2. A logged-in Super Admin can also trigger this on demand from the app
 *    (Admin → Kelola Akun) by sending their own session token — useful right
 *    now while CRON_SECRET isn't set yet, or to clear storage in a hurry.
 *
 * Only product-photos is touched — frame templates, Shopee templates, and
 * warehouse resi files are left alone.
 */
export async function GET(req: Request) {
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secret = process.env.CRON_SECRET;

  let authorized = !!secret && provided === secret;
  if (!authorized && provided) {
    // Query as the caller (not the shared anon client) so the profiles RLS
    // policy (`id = auth.uid() or is_super_admin()`) actually resolves.
    const callerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${provided}` } } }
    );
    const { data: userRes } = await callerClient.auth.getUser(provided);
    if (userRes?.user) {
      const { data: prof } = await callerClient.from("profiles").select("role").eq("id", userRes.user.id).single();
      authorized = prof?.role === "super_admin";
    }
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const daysParam = new URL(req.url).searchParams.get("days");
  const retentionDays = daysParam ? Math.max(0, parseInt(daysParam, 10) || RETENTION_DAYS) : RETENTION_DAYS;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
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

    return NextResponse.json({ ok: true, bucket, retentionDays, deleted });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
