import type { SupabaseClient } from "@supabase/supabase-js";

/** Shapes returned by the admin_metrics / admin_suggestions functions in supabase/schema.sql. */

export interface Count {
  name: string;
  count: number;
}

export interface Metrics {
  users: { total: number; last7: number; last30: number; withNotes: number; active7: number };
  content: { notes: number; tables: number; nodes: number; notebooks: number; links: number; cards: number; events: number; shares: number };
  ai: { uses: number; people: number };
  daily: { day: string; count: number }[];
  campaigns: Count[];
  sources: Count[];
  suggestions: Record<Status, number>;
}

export type Kind = "idea" | "problema" | "otro";
export type Status = "nueva" | "vista" | "hecha";

export const KINDS: { id: Kind; label: string }[] = [
  { id: "idea", label: "Una idea" },
  { id: "problema", label: "Algo falla" },
  { id: "otro", label: "Otra cosa" },
];
export const STATUSES: Status[] = ["nueva", "vista", "hecha"];

export interface Suggestion {
  id: string;
  kind: Kind;
  message: string;
  status: Status;
  created_at: string;
  email: string;
}

/** Share of `part` in `whole` as a whole percent; 0 when there is nothing to divide by. */
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export async function isAdmin(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("is_admin");
  return !error && data === true;
}

/** Everything /admin shows. Null when the person is not an admin or the functions are missing. */
export async function loadAdmin(client: SupabaseClient): Promise<{ metrics: Metrics; suggestions: Suggestion[] } | null> {
  const [metrics, suggestions] = await Promise.all([client.rpc("admin_metrics"), client.rpc("admin_suggestions", { max_rows: 200 })]);
  if (metrics.error || suggestions.error || !metrics.data) return null;
  return { metrics: metrics.data as Metrics, suggestions: (suggestions.data ?? []) as Suggestion[] };
}
