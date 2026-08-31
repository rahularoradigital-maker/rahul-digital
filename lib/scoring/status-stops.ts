import "server-only";
import { createAdminClient } from "../supabase/admin.ts";

// A focused reader for the culprit-diagnostic: the latest LOGGED status change (pause / stop / run_status) per
// entity, so the diagnostic can corroborate an inferred stop with the real event - who changed it, and when.
// Best-effort: returns an empty map on any error or before ad_changes exists, so the culprit falls back to its
// inferred wording and never breaks. Tenant-scoped by user_id (the RLS-bypassing admin client demands it).

export type StatusStop = { date: string; actorName: string | null; source: "buyer" | "algo" };

export async function recentStatusStops(userId: string, accountExternalId: string, sinceDate: string): Promise<Map<string, StatusStop>> {
  const out = new Map<string, StatusStop>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ad_changes")
      .select("object_id,date,actor_name,source,change_type")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .eq("change_type", "status")
      .gte("date", sinceDate)
      .order("date", { ascending: false })
      .limit(500);
    for (const r of (data ?? []) as { object_id: string | null; date: string; actor_name: string | null; source: "buyer" | "algo" }[]) {
      // Keep the MOST RECENT status change per entity (rows arrive newest-first).
      if (r.object_id && !out.has(r.object_id)) out.set(r.object_id, { date: r.date, actorName: r.actor_name, source: r.source });
    }
  } catch {
    /* ad_changes missing / query failed -> empty map -> culprit uses inferred wording */
  }
  return out;
}
