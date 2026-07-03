import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const VALID_ROLES = ["staff", "admin", "super_admin"];
const VALID_SECTIONS = ["dashboard", "product", "warehouse", "stock", "tools"];

function randomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Super-admin-only: create a teammate's login directly (no self-signup +
 * approval round-trip). Requires SUPABASE_SERVICE_ROLE_KEY in Vercel — the
 * anon key can't create users with a password.
 */
export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY belum diset di Vercel. Tambahkan dulu env var-nya lalu redeploy." },
      { status: 503 }
    );
  }

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return NextResponse.json({ error: "Sesi tidak valid, coba login ulang." }, { status: 401 });
  }

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (!callerProfile || callerProfile.role !== "super_admin") {
    return NextResponse.json({ error: "Cuma Super Admin yang bisa bikin akun." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const role = VALID_ROLES.includes(body.role) ? body.role : "staff";
  const access = Array.isArray(body.access) ? body.access.filter((a: unknown) => VALID_SECTIONS.includes(String(a))) : [];
  const warehouseScope = Array.isArray(body.warehouseScope)
    ? body.warehouseScope.filter((w: unknown) => typeof w === "string" && w.length > 0)
    : [];

  if (!email || !fullName) {
    return NextResponse.json({ error: "Email dan nama wajib diisi." }, { status: 400 });
  }

  const password = randomPassword();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message || "Gagal bikin akun.";
    const friendly = /already.*registered|already been registered/i.test(msg) ? "Email ini sudah terdaftar." : msg;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  // A trigger on auth.users auto-creates the profiles row (staff / inactive
  // by default) — patch it with the role/access/active state chosen here.
  let profileError: string | null = null;
  for (let i = 0; i < 5; i++) {
    const { error } = await admin
      .from("profiles")
      .update({ role, access, warehouse_scope: warehouseScope, is_active: true, full_name: fullName })
      .eq("id", created.user.id);
    profileError = error?.message ?? null;
    if (!error) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ ok: true, email, password, profileWarning: profileError });
}
