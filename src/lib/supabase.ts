import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Bucket name — must match what you create in Supabase Storage
export const TEMPLATES_BUCKET = "templates";

// Table name — must match what you create in Supabase DB
export const TEMPLATES_TABLE = "templates";
