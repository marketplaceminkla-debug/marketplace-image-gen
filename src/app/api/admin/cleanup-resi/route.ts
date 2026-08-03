import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { WAREHOUSE_RESI_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keep each invocation well under serverless timeouts; client loops if `more`.
const MAX_DELETES_PER_RUN = 300;

/**
 * Super-admin-only: delete warehouse-resi files uploaded within a date
 * range (e.g. "semua resi bulan Juli"). Files live flat in the bucket
 * (no subfolders) — see uploadResi() in lib/warehouse.ts.
 *
 * Uses the CALLER's own session (not the shared anon client) because the
 * warehouse-resi delete policy requires has_section('warehouse'), which
 * only resolves when auth.uid() is present.
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Konfigurasi Supabase belum lengkap." }, { status: 503 });
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userRes } = await callerClient.auth.getUser(token);
  if (!userRes?.user) {
    return NextResponse.json({ error: "Sesi tidak valid, coba login ulang." }, { status: 401 });
  }

  const { data: prof } = await callerClient.from("profiles").select("role").eq("id", userRes.user.id).single();
  if (!prof || prof.role !== "super_admin") {
    return NextResponse.json({ error: "Cuma Super Admin yang bisa bersihin resi." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const from = String(body.from || "");
  const to = String(body.to || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Tanggal from/to gak valid." }, { status: 400 });
  }
  const fromTs = new Date(`${from}T00:00:00Z`).getTime();
  const toTs = new Date(`${to}T23:59:59Z`).getTime();

  const bucket = WAREHOUSE_RESI_BUCKET;
  const toDelete: string[] = [];

  try {
    let offset = 0;
    let truncated = false;
    scan: for (;;) {
      const { data: files, error } = await callerClient.storage.from(bucket).list("", { limit: 1000, offset });
      if (error) throw error;
      if (!files || files.length === 0) break;
      for (const f of files) {
        const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
        if (ts >= fromTs && ts <= toTs) {
          toDelete.push(f.name);
          if (toDelete.length >= MAX_DELETES_PER_RUN) { truncated = true; break scan; }
        }
      }
      if (files.length < 1000) break;
      offset += 1000;
    }

    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await callerClient.storage.from(bucket).remove(batch);
      if (error) throw error;
      deleted += batch.length;
    }

    return NextResponse.json({ ok: true, bucket, deleted, more: truncated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
