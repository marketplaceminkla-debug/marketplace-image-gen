import { supabase } from "./supabase";

export type KpiUnit = "number" | "percent" | "currency";
export type KpiCategory = "proses" | "hasil";
export const PIC_LIST = ["Rona", "Dina", "Alfin", "Mauren"] as const;
export type PicName = (typeof PIC_LIST)[number];

export interface KpiIndicator {
  id: string;
  pic_name: PicName;
  category: KpiCategory;
  name: string;
  target_value: number; // default target (fallback jika tidak ada monthly target)
  unit: KpiUnit;
  bobot: number;
  sort_order: number;
  is_active: boolean;
  source_field: "revenue" | "kombo_total" | "margin_sum" | null;
}

export interface KpiActual {
  id: string;
  indicator_id: string;
  month: string;
  actual_value: number;
  updated_at: string;
}

export interface KpiTarget {
  id: string;
  indicator_id: string;
  month: string;
  target_value: number;
}

export interface KpiRow extends KpiIndicator {
  effective_target: number; // monthly override jika ada, else indicator default
  actual_value: number;
  capaian_pct: number;  // actual / target * 100, uncapped — can exceed 100 when overachieved
  nilai_akhir: number;  // capaian_pct * bobot / 100
}

export interface PicKpiSummary {
  pic: PicName;
  rows: KpiRow[];
  totalNilai: number;
  totalBobot: number;
  totalPct: number;
  needsAttention: KpiRow[]; // capaian < 75%
}

export function fmtKpiValue(v: number, unit: KpiUnit): string {
  if (unit === "currency") {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(0)}jt`;
    return `Rp ${v.toLocaleString("id-ID")}`;
  }
  if (unit === "percent") return `${v}%`;
  return `${v}`;
}

export async function listIndicators(pic: PicName): Promise<KpiIndicator[]> {
  const { data, error } = await supabase
    .from("kpi_indicators")
    .select("*")
    .eq("pic_name", pic)
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data) return [];
  return data as KpiIndicator[];
}

export async function listActuals(indicatorIds: string[], month: string): Promise<KpiActual[]> {
  if (!indicatorIds.length) return [];
  const { data, error } = await supabase
    .from("kpi_actuals")
    .select("*")
    .in("indicator_id", indicatorIds)
    .eq("month", month);
  if (error || !data) return [];
  return data as KpiActual[];
}

/** Ambil target per bulan dari kpi_targets. Returns map: indicatorId -> target_value */
export async function listMonthlyTargets(indicatorIds: string[], month: string): Promise<Map<string, number>> {
  if (!indicatorIds.length) return new Map();
  const { data, error } = await supabase
    .from("kpi_targets")
    .select("indicator_id, target_value")
    .in("indicator_id", indicatorIds)
    .eq("month", month);
  if (error || !data) return new Map();
  return new Map((data as KpiTarget[]).map((t) => [t.indicator_id, t.target_value]));
}

/** Simpan target untuk bulan tertentu (tidak mempengaruhi bulan lain). */
export async function upsertMonthlyTarget(
  indicatorId: string,
  month: string,
  targetValue: number,
  userId: string | null,
) {
  const { error } = await supabase.from("kpi_targets").upsert(
    {
      indicator_id: indicatorId,
      month,
      target_value: targetValue,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "indicator_id,month" },
  );
  return { error: error ? error.message : null };
}

export async function upsertActual(
  indicatorId: string,
  month: string,
  actualValue: number,
  userId: string | null,
) {
  const { error } = await supabase.from("kpi_actuals").upsert(
    {
      indicator_id: indicatorId,
      month,
      actual_value: actualValue,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "indicator_id,month" },
  );
  return { error: error ? error.message : null };
}

/**
 * Build KpiRow dari indicators + actuals + optional monthly targets.
 * effective_target = monthly target jika ada, else indicator.target_value (default).
 */
export function buildKpiRows(
  indicators: KpiIndicator[],
  actuals: KpiActual[],
  monthlyTargets?: Map<string, number>,
): KpiRow[] {
  const actualMap = new Map(actuals.map((a) => [a.indicator_id, a.actual_value]));
  return indicators.map((ind) => {
    const effective_target = monthlyTargets?.get(ind.id) ?? ind.target_value;
    const actual_value = actualMap.get(ind.id) ?? 0;
    const raw_pct = effective_target > 0 ? (actual_value / effective_target) * 100 : 0;
    // "Proses" indicators are capped at 100% (can't over-achieve a process
    // metric like upload/reply rate); "Hasil" indicators can exceed 100%.
    const capaian_pct = ind.category === "proses" ? Math.min(raw_pct, 100) : raw_pct;
    const nilai_akhir = (capaian_pct * ind.bobot) / 100;
    return { ...ind, effective_target, actual_value, capaian_pct, nilai_akhir };
  });
}

/** Load KPI semua PIC untuk Overview. */
export async function loadAllPicKpi(month: string): Promise<PicKpiSummary[]> {
  const results: PicKpiSummary[] = [];
  for (const pic of PIC_LIST) {
    const indicators = await listIndicators(pic);
    const ids = indicators.map((i) => i.id);
    const [actuals, monthlyTargets] = await Promise.all([
      listActuals(ids, month),
      listMonthlyTargets(ids, month),
    ]);
    const rows = buildKpiRows(indicators, actuals, monthlyTargets);
    const totalNilai = rows.reduce((s, r) => s + r.nilai_akhir, 0);
    const totalBobot = rows.reduce((s, r) => s + r.bobot, 0);
    const totalPct = totalBobot > 0 ? (totalNilai / totalBobot) * 100 : 0;
    const needsAttention = rows.filter((r) => r.capaian_pct < 75);
    results.push({ pic, rows, totalNilai, totalBobot, totalPct, needsAttention });
  }
  return results;
}

export async function updateIndicatorName(id: string, name: string) {
  const { error } = await supabase.from("kpi_indicators").update({ name }).eq("id", id);
  return { error: error ? error.message : null };
}

export async function addIndicator(input: {
  pic_name: PicName;
  category: KpiCategory;
  name: string;
  target_value: number;
  unit: KpiUnit;
  bobot: number;
  sort_order: number;
}) {
  const { error } = await supabase.from("kpi_indicators").insert({ ...input, is_active: true, source_field: null });
  return { error: error ? error.message : null };
}

export async function deleteIndicator(id: string) {
  const { error } = await supabase.from("kpi_indicators").update({ is_active: false }).eq("id", id);
  return { error: error ? error.message : null };
}

/**
 * Sum the "Margin" (category hasil) indicator's actual_value across
 * Rona/Dina/Alfin for a month. Matched by name containing "margin" since
 * each PIC's indicator is worded differently (Margin Laptop, Margin
 * Aksesoris (...), Margin All (...)) — there's no shared indicator id.
 */
async function sumMarginFromOtherPics(month: string): Promise<number> {
  const { data: marginIndicators } = await supabase
    .from("kpi_indicators")
    .select("id")
    .in("pic_name", ["Rona", "Dina", "Alfin"])
    .eq("category", "hasil")
    .eq("is_active", true)
    .ilike("name", "%margin%");
  const ids = (marginIndicators ?? []).map((i: { id: string }) => i.id);
  if (!ids.length) return 0;

  const { data: actuals } = await supabase
    .from("kpi_actuals")
    .select("actual_value")
    .in("indicator_id", ids)
    .eq("month", month);
  return (actuals ?? []).reduce((s: number, a: { actual_value: number }) => s + (a.actual_value ?? 0), 0);
}

/** Sync auto KPI actuals from warehouse_orders (+ cross-PIC Margin sum) for a PIC + month. */
export async function syncKpiFromOrders(
  pic: PicName,
  month: string,
  indicators: KpiIndicator[],
  userId: string | null,
): Promise<{ revenue: number; kombo: number; marginSum: number }> {
  const storeQuery = supabase.from("store_accounts").select("id");
  if (pic !== "Mauren") storeQuery.eq("pic_name", pic);
  const { data: stores } = await storeQuery;
  const storeIds = (stores ?? []).map((s: { id: string }) => s.id);

  let revenue = 0;
  let kombo = 0;
  if (storeIds.length) {
    const [y, m] = month.split("-");
    const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
    const monthStart = `${month}-01`;
    const monthEnd   = `${month}-${String(daysInMonth).padStart(2, "0")}`;

    const { data: orders } = await supabase
      .from("warehouse_orders")
      .select("revenue, kombo_hemat")
      .in("store_account_id", storeIds)
      .gte("order_date", monthStart)
      .lte("order_date", monthEnd)
      .neq("status", "denied");

    revenue = (orders ?? []).reduce((s: number, o: { revenue: number }) => s + (o.revenue ?? 0), 0);
    kombo   = (orders ?? []).filter((o: { kombo_hemat: string | null }) => o.kombo_hemat !== null).length;
  }

  const needsMarginSum = indicators.some((i) => i.source_field === "margin_sum");
  const marginSum = needsMarginSum ? await sumMarginFromOtherPics(month) : 0;

  for (const ind of indicators) {
    if (!ind.source_field) continue;
    const val =
      ind.source_field === "revenue" ? revenue :
      ind.source_field === "kombo_total" ? kombo :
      marginSum;
    await upsertActual(ind.id, month, val, userId);
  }

  return { revenue, kombo, marginSum };
}
