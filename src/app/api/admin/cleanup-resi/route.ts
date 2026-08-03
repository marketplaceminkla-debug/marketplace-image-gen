import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Deprecated: resi files now upload to Cloudinary (see uploadResi() in
 * lib/warehouse.ts), not Supabase Storage, so there is nothing here left
 * to clean up. Kept as a super-admin-gated no-op instead of deleting the
 * route outright, in case old links are reported later.
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

  return NextResponse.json({
    ok: true,
    deleted: 0,
    more: false,
    note: "Resi sekarang disimpan di Cloudinary, bukan Supabase Storage — tidak ada lagi yang perlu dibersihkan lewat endpoint ini.",
  });
}
