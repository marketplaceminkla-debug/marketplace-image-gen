import { supabase } from "./supabase";

export interface StoreAccount {
  id: string;
  name: string;
  platform: string;
  pic_name: string;
  pic_wa: string | null;
  categories: string[];
  is_active: boolean;
  created_at: string;
}

export interface MonthlyTarget {
  id: string;
  pic_name: string;
  month: number;
  year: number;
  target: number;
}

export interface DailySalesReport {
  id: string;
  report_date: string;
  store_account_id: string;
  revenue_today: number;
  revenue_total: number;
  revenue_estimate: number;
  chat_count: number;
  upload_count: number;
  kombo_non_garansi: number;
  kombo_garansi: number;
  loss_notes: string | null;
  // Template v2 (supabase-report-template-v2.sql)
  live_revenue: number;
  unit_laptop: number;
  unit_aksesoris: number;
  video_count: number;
  ops_unboxing_retur: number;
  ops_service_count: number;
  ops_cases: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportDeal {
  id: string;
  report_id: string;
  product_name: string;
  qty: number;
  created_at: string;
}

export interface PendingItem {
  id: string;
  store_account_id: string;
  report_date: string;
  product_name: string;
  status: "pending" | "done";
  resolved_at: string | null;
  created_at: string;
}

export interface MonthlyStats {
  month: number;
  year: number;
  chat_count: number;
  deal_qty: number;
  revenue_total: number;
  target: number;
}

/** Display name: "SHOPEE KLA (Laptop/Tablet/AIO) — Rona" */
export function storeDisplayName(s: StoreAccount): string {
  const cats = s.categories.filter((c) => c !== "All");
  const catStr = cats.length ? ` (${cats.join("/")})` : "";
  return `${s.name}${catStr} — ${s.pic_name}`;
}

/** Label for WA report headers: first non-All category or store name */
export function storeReportLabel(s: StoreAccount): string {
  const cat = s.categories.find((c) => c !== "All");
  return cat ?? s.name;
}

// Fixed header wording per PIC (as dictated by the owner) — combines their
// store names into one line, e.g. "Shopee KLA Laptop + Lenovo" for Rona.
const PIC_REPORT_HEADERS: Record<string, string> = {
  Dina: "Shopee KLA Acc + Tiktok + Gadget Klik",
  Rona: "Shopee KLA Laptop + Lenovo",
};

/** Header line for a PIC's combined WA report (store names, not the person's name). */
export function picReportHeader(picName: string, stores: StoreAccount[]): string {
  if (PIC_REPORT_HEADERS[picName]) return PIC_REPORT_HEADERS[picName];
  const labels = stores.filter((s) => s.pic_name === picName).map((s) => storeReportLabel(s));
  const unique: string[] = [];
  labels.forEach((l) => { if (!unique.includes(l)) unique.push(l); });
  return unique.length ? unique.join(" & ") : picName;
}

export function formatIDR(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];
export function monthName(m: number): string { return MONTH_NAMES[m - 1] ?? String(m); }

// ── Store Accounts ──────────────────────────────────────────
export async function listStoreAccounts(): Promise<StoreAccount[]> {
  const { data } = await supabase
    .from("store_accounts")
    .select("*")
    .eq("is_active", true)
    .order("pic_name")
    .order("name");
  return (data as StoreAccount[]) ?? [];
}

// ── Monthly Targets ─────────────────────────────────────────
export async function getMonthlyTarget(picName: string, month: number, year: number): Promise<number> {
  const { data } = await supabase
    .from("monthly_targets")
    .select("target")
    .eq("pic_name", picName)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();
  return (data as { target: number } | null)?.target ?? 0;
}

export async function setMonthlyTarget(
  picName: string, month: number, year: number, target: number
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("monthly_targets")
    .upsert({ pic_name: picName, month, year, target }, { onConflict: "pic_name,month,year" });
  return { error: error ? error.message : null };
}

// ── Daily Reports ───────────────────────────────────────────
export async function getDailyReport(storeAccountId: string, date: string): Promise<DailySalesReport | null> {
  const { data } = await supabase
    .from("daily_sales_reports")
    .select("*")
    .eq("store_account_id", storeAccountId)
    .eq("report_date", date)
    .maybeSingle();
  return data as DailySalesReport | null;
}

export async function upsertDailyReport(
  storeAccountId: string,
  date: string,
  patch: Partial<Omit<DailySalesReport, "id" | "created_at" | "updated_at">>,
  createdBy: string | null
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("daily_sales_reports")
    .upsert(
      {
        store_account_id: storeAccountId,
        report_date: date,
        ...patch,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "report_date,store_account_id" }
    )
    .select("id")
    .single();
  return { id: (data as { id: string } | null)?.id ?? null, error: error ? error.message : null };
}

// ── Report Deals ────────────────────────────────────────────
export async function listReportDeals(reportId: string): Promise<ReportDeal[]> {
  const { data } = await supabase
    .from("report_deals")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at");
  return (data as ReportDeal[]) ?? [];
}

export async function addReportDeal(reportId: string, productName: string, qty: number): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("report_deals")
    .insert({ report_id: reportId, product_name: productName, qty });
  return { error: error ? error.message : null };
}

export async function deleteReportDeal(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("report_deals").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// ── Pending Items ───────────────────────────────────────────
export async function listPendingItems(storeAccountId?: string): Promise<PendingItem[]> {
  let q = supabase
    .from("report_pending_items")
    .select("*")
    .order("status") // pending first
    .order("report_date", { ascending: false });
  if (storeAccountId) q = q.eq("store_account_id", storeAccountId);
  const { data } = await q;
  return (data as PendingItem[]) ?? [];
}

/** Pending items across multiple stores (PIC-level). */
export async function listPendingItemsForStores(storeIds: string[]): Promise<PendingItem[]> {
  if (!storeIds.length) return [];
  const { data } = await supabase
    .from("report_pending_items")
    .select("*")
    .in("store_account_id", storeIds)
    .order("status")
    .order("report_date", { ascending: false });
  return (data as PendingItem[]) ?? [];
}

export async function listOpenPendingItems(): Promise<PendingItem[]> {
  const { data } = await supabase
    .from("report_pending_items")
    .select("*")
    .eq("status", "pending")
    .order("report_date", { ascending: false });
  return (data as PendingItem[]) ?? [];
}

export async function addPendingItem(
  storeAccountId: string, date: string, productName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("report_pending_items")
    .insert({ store_account_id: storeAccountId, report_date: date, product_name: productName });
  return { error: error ? error.message : null };
}

export async function updatePendingItem(
  id: string, productName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("report_pending_items")
    .update({ product_name: productName })
    .eq("id", id);
  return { error: error ? error.message : null };
}

export async function updatePendingStatus(
  id: string, status: "pending" | "done"
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("report_pending_items")
    .update({ status, resolved_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);
  return { error: error ? error.message : null };
}

export async function deletePendingItem(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("report_pending_items").delete().eq("id", id);
  return { error: error ? error.message : null };
}

// ── Analytics ───────────────────────────────────────────────
export async function listMonthlyStats(
  picName: string | null,
  year: number
): Promise<MonthlyStats[]> {
  // Get store account IDs for this PIC (or all)
  let acctQ = supabase.from("store_accounts").select("id").eq("is_active", true);
  if (picName) acctQ = acctQ.eq("pic_name", picName);
  const { data: accounts } = await acctQ;
  if (!accounts || accounts.length === 0) return [];
  const ids = accounts.map((a: { id: string }) => a.id);

  // Get all daily reports for the year
  const { data: reports } = await supabase
    .from("daily_sales_reports")
    .select("id, report_date, revenue_today, chat_count")
    .in("store_account_id", ids)
    .gte("report_date", `${year}-01-01`)
    .lte("report_date", `${year}-12-31`);

  if (!reports || reports.length === 0) return [];

  type ReportRow = { id: string; report_date: string; revenue_today: number; chat_count: number };
  const byMonth: Record<number, MonthlyStats> = {};
  for (const r of reports as ReportRow[]) {
    const m = parseInt(r.report_date.split("-")[1]);
    if (!byMonth[m]) byMonth[m] = { month: m, year, chat_count: 0, deal_qty: 0, revenue_total: 0, target: 0 };
    byMonth[m].chat_count += r.chat_count;
    byMonth[m].revenue_total += r.revenue_today;
  }

  // Get deal quantities
  const reportIds = (reports as ReportRow[]).map((r) => r.id);
  if (reportIds.length > 0) {
    const { data: deals } = await supabase
      .from("report_deals")
      .select("report_id, qty")
      .in("report_id", reportIds);
    if (deals) {
      const reportToMonth: Record<string, number> = {};
      for (const r of reports as ReportRow[]) {
        reportToMonth[r.id] = parseInt(r.report_date.split("-")[1]);
      }
      for (const d of deals as { report_id: string; qty: number }[]) {
        const m = reportToMonth[d.report_id];
        if (m && byMonth[m]) byMonth[m].deal_qty += d.qty;
      }
    }
  }

  // Get targets
  if (picName) {
    await Promise.all(
      Object.keys(byMonth).map(async (m) => {
        byMonth[parseInt(m)].target = await getMonthlyTarget(picName, parseInt(m), year);
      })
    );
  }

  return Object.values(byMonth).sort((a, b) => a.month - b.month);
}

// ── Operasional (all stores, auto) ──────────────────────────
export interface OpsAutoData {
  orders_today: number;     // semua orderan hari itu (kecuali denied)
  orders_shipped: number;   // yang statusnya Done
  orders_pending: number;   // yang belum Done
  retur_today: number;      // retur yang masuk hari itu
  retur_unprocessed: number; // retur status New (semua tanggal)
}

export async function getOpsAutoData(date: string): Promise<OpsAutoData> {
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const orders = () => supabase.from("warehouse_orders").select("id", { count: "exact", head: true }).eq("order_date", date).neq("status", "denied");
  const returns = () => supabase.from("stock_returns").select("id", { count: "exact", head: true });
  const [orders_today, orders_shipped, retur_today, retur_unprocessed] = await Promise.all([
    count(orders()),
    count(orders().eq("status", "done")),
    count(returns().eq("return_date", date)),
    count(returns().eq("status", "new")),
  ]);
  return { orders_today, orders_shipped, orders_pending: orders_today - orders_shipped, retur_today, retur_unprocessed };
}

export interface ReportManualFields {
  liveRevenue: number;
  unitLaptop: number;
  unitAksesoris: number;
  videoCount: number;
  lossNotes: string;
  opsUnboxingRetur: number;
  opsServiceCount: number;
  opsCases: string;
}

// ── WA Report Generator ─────────────────────────────────────
export function buildReportWaMessage(
  store: StoreAccount,
  report: DailySalesReport,
  deals: ReportDeal[],
  pendingItems: PendingItem[],
  target: number
): string {
  const [y, m, d] = report.report_date.split("-");
  const dateStr = `${d}/${m}/${y}`;
  const catLabel = storeReportLabel(store);
  const totalDealQty = deals.reduce((s, dd) => s + dd.qty, 0);

  const dealLines = deals.length
    ? deals.map((dd) => `${dd.qty} unit\t${dd.product_name}`).join("\n")
    : "-";

  const openPending = pendingItems.filter((p) => p.status === "pending");
  const pendingLines = openPending.length
    ? openPending.map((p, i) => `${i + 1}. ${p.product_name}`).join("\n")
    : "-";

  return (
    `Report ${store.name} ${dateStr}\n\n` +
    `TARGET : ${formatIDR(target)}\n` +
    `Total Revenue : ${formatIDR(report.revenue_total)}\n` +
    `Revenue Hari Ini : ${formatIDR(report.revenue_today)}\n` +
    `Estimasi Revenue : ${formatIDR(report.revenue_estimate)}\n\n` +
    `Chat ${catLabel} : ${report.chat_count}\n` +
    `Deal ${catLabel} : ${totalDealQty}\n` +
    `${dealLines}\n\n` +
    `Upload produk : ${report.upload_count > 0 ? report.upload_count : "-"} \n\n` +
    `Kombo Hemat\n` +
    `Non Garansi : ${report.kombo_non_garansi > 0 ? report.kombo_non_garansi : "-"}\n` +
    `Garansi : ${report.kombo_garansi > 0 ? report.kombo_garansi : "-"}\n\n` +
    `Pending :\n${pendingLines}\n\n` +
    `Loss : ${report.loss_notes || "-"}`
  );
}

/** Build WA report for a PIC (aggregates all their stores) — template v2:
 *  Tim Penjualan + Operasional. */
export function buildPicWaMessage(
  picName: string,
  stores: StoreAccount[],
  autoData: { revenue_today: number; revenue_total: number; revenue_estimate: number; order_count: number },
  ops: OpsAutoData | null,
  pendingCount: number,
  target: number,
  date: string,
  manual: ReportManualFields,
): string {
  const [y, m, d] = date.split("-");
  const dateStr = `${d}/${m}/${y}`;
  const header = picReportHeader(picName, stores);
  const n = (v: number) => (v > 0 ? String(v) : "-");
  const list = (text: string) => (text.trim() ? `
${text.trim()}` : " -");
  return (
    `Report ${header} ${dateStr}

` +
    `Tim Penjualan : ${header}
` +
    `Target Revenue : ${formatIDR(target)}
` +
    `Revenue Hari ini : ${formatIDR(autoData.revenue_today)}
` +
    `Total Revenue : ${formatIDR(autoData.revenue_total)}
` +
    `Estimasi Revenue Akhir Bulan : ${formatIDR(autoData.revenue_estimate)}
` +
    `Total Revenue dari Live : ${manual.liveRevenue > 0 ? formatIDR(manual.liveRevenue) : "-"}
` +
    `Total Unit Laptop : ${n(manual.unitLaptop)}
` +
    `Total Unit Aksesoris : ${n(manual.unitAksesoris)}
` +
    `Jumlah Orderan : ${n(autoData.order_count)}
` +
    `Jumlah Pending belum SO : ${n(pendingCount)}
` +
    `Jumlah Vidio yang di Upload : ${n(manual.videoCount)}
` +
    `Loss :${list(manual.lossNotes)}

` +
    `Operasional :
` +
    `Total Jumlah Order Hari ini : ${n(ops?.orders_today ?? 0)}
` +
    `Total Pesanan Terkirim : ${n(ops?.orders_shipped ?? 0)}
` +
    `Total Pesanan Pending : ${n(ops?.orders_pending ?? 0)}
` +
    `Total Retur Yang Masuk : ${n(ops?.retur_today ?? 0)}
` +
    `Total Unboxing Vidio Retur : ${n(manual.opsUnboxingRetur)}
` +
    `Retur yang belum di Proses : ${n(ops?.retur_unprocessed ?? 0)}
` +
    `Total Barang Service : ${n(manual.opsServiceCount)}
` +
    `Case Operasional yang Muncul :${list(manual.opsCases)}`
  );
}

/** Build a combined report for Mauren from all stores */
export function buildCombinedWaMessage(
  stores: StoreAccount[],
  reports: DailySalesReport[],
  dealsByReport: Record<string, ReportDeal[]>,
  allPending: PendingItem[],
  targets: Record<string, number>,
  date: string
): string {
  const [y, m, d] = date.split("-");
  const dateStr = `${d}/${m}/${y}`;

  const parts = reports.map((r) => {
    const store = stores.find((s) => s.id === r.store_account_id);
    if (!store) return "";
    const deals = dealsByReport[r.id] ?? [];
    const pending = allPending.filter(
      (p) => p.store_account_id === store.id && p.status === "pending"
    );
    const target = targets[store.pic_name] ?? 0;
    return buildReportWaMessage(store, r, deals, pending, target);
  });

  return `LAPORAN GABUNGAN ${dateStr}\n${"=".repeat(30)}\n\n` + parts.filter(Boolean).join(`\n\n${"─".repeat(30)}\n\n`);
}
