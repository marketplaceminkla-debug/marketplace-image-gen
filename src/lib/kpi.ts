import { supabase } from "./supabase";

export type KpiUnit = "number" | "percent" | "currency";
export type KpiCategory = "proses" | "hasil";
export const PIC_LIST = ["Rona", "Diza", "Alfin", "Mauren"] as const;
export type PicName = (typeof PIC_LIST)[number];

export interface KpiIndicator {
  id: string;
  pic_name: PicName;
  category: KpiCategory;
  name: string;
  target_value: number;
  unit: KpiUnit;
  bobot: number;
  sort_order: number;
  is_active: boolean;
  source_field: "revenue" | "kombo_total" | null;
}

export interface KpiActual {
  id: string;
  indicator_id: string;
  month: string;
  actual_value: number;
  updated_at: string;
}

export interface KpiRow extends KpiIndicator {
  actual_value: number;
  capaian_pct: number;  // actual / target * 100, capped at 100
  nilai_akhir: number;  // capaian_pct * bobot / 100
}

export function fmtKpiValue(v: number, unit: KpiUnit): string {
  if (unit === "currency") {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
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

/** Sync auto KPI actuals from warehouse_orders for a PIC + month. Returns values synced. */
export async function syncKpiFromOrders(
  pic: PicName,
  month: string,
  indicators: KpiIndicator[],
  userId: string | null,
): Promise<{ revenue: number; kombo: number }> {
  // 1. Get store account IDs for this PIC (Mauren = all stores)
  const storeQuery = supabase.from("store_accounts").select("id");
  if (pic !== "Mauren") storeQuery.eq("pic_name", pic);
  const { data: stores } = await storeQuery;
  const storeIds = (stores ?? []).map((s: { id: string }) => s.id);

  if (!storeIds.length) return { revenue: 0, kombo: 0 };

  // 2. Aggregate orders for this month
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

  const revenue = (orders ?? []).reduce((s: number, o: { revenue: number }) => s + (o.revenue ?? 0), 0);
  const kombo   = (orders ?? []).filter((o: { kombo_hemat: string | null }) => o.kombo_hemat !== null).length;

  // 3. Upsert actuals for auto indicators
  for (const ind of indicators) {
    if (!ind.source_field) continue;
    const val = ind.source_field === "revenue" ? revenue : kombo;
    await upsertActual(ind.id, month, val, userId);
  }

  return { revenue, kombo };
}

export async function updateIndicatorTarget(id: string, targetValue: number) {
  const { error } = await supabase
    .from("kpi_indicators")
    .update({ target_value: targetValue })
    .eq("id", id);
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

export function buildKpiRows(indicators: KpiIndicator[], actuals: KpiActual[]): KpiRow[] {
  const actualMap = new Map(actuals.map((a) => [a.indicator_id, a.actual_value]));
  return indicators.map((ind) => {
    const actual_value = actualMap.get(ind.id) ?? 0;
    const raw_pct = ind.target_value > 0 ? (actual_value / ind.target_value) * 100 : 0;
    const capaian_pct = Math.min(raw_pct, 100);
    const nilai_akhir = (capaian_pct * ind.bobot) / 100;
    return { ...ind, actual_value, capaian_pct, nilai_akhir };
  });
}
