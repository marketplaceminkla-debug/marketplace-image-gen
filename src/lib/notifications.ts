import { supabase } from "./supabase";

export type NotifCategory = "warehouse" | "product";

export interface AppNotification {
  id: string;
  category: NotifCategory;
  title: string;
  body: string | null;
  target_view: string;
  actor_name: string | null;
  created_at: string;
}

export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as AppNotification[];
}

const SEEN_KEY = "ps_notif_last_seen_at";

/** Last time the user opened the notification bell (per-browser). */
export function getLastSeenAt(): string {
  if (typeof window === "undefined") return new Date(0).toISOString();
  return localStorage.getItem(SEEN_KEY) || new Date(0).toISOString();
}
export function markSeenNow(): string {
  const now = new Date().toISOString();
  if (typeof window !== "undefined") localStorage.setItem(SEEN_KEY, now);
  return now;
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Kemarin";
  if (day < 7) return `${day} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}
