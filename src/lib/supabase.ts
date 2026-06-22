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

// Bucket name for generated product photos (used for Shopee Excel export —
// photos need a public URL since Shopee Mass Upload only accepts links, not files)
export const PRODUCT_PHOTOS_BUCKET = "product-photos";

// Bucket + table for the user-uploaded Shopee Mass Upload Excel template
export const SHOPEE_TEMPLATES_BUCKET = "shopee-templates";
export const SHOPEE_TEMPLATES_TABLE = "shopee_templates";

// Table name — must match what you create in Supabase DB
export const TEMPLATES_TABLE = "templates";

// Bucket for warehouse order receipts (resi) — public, optional uploads
export const WAREHOUSE_RESI_BUCKET = "warehouse-resi";
