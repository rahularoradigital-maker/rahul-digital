import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeEventRoi, type EventRow, type EventRoi } from "./event-roi";

// Assemble event ROI from the store: join each ad's optimisation EVENT (ad_meta.optimization_event, written
// by the sync) with its spend/revenue/purchases (ad_metrics) over the window, group by event, then apply the
// rubric. Self-contained read (own admin query, tenant-scoped) so it never touches the cockpit pipeline.
// Returns [] when the event column is not populated yet (sync has not run) - the card then shows "sync to enable".

const PAGE = 1000;

export async function getEventRoi(userId: string, accountExternalId: string, since: string, until: string): Promise<EventRoi[]> {
  try {
    const admin = createAdminClient();
    const eventByAd = new Map<string, string>();
    const { data: meta } = await admin.from("ad_meta").select("ad_id,optimization_event").eq("user_id", userId).eq("account_external_id", accountExternalId);
    for (const m of (meta ?? []) as { ad_id: string; optimization_event: string | null }[]) {
      if (m.optimization_event) eventByAd.set(m.ad_id, m.optimization_event);
    }
    if (eventByAd.size === 0) return []; // optimization_event not populated yet

    const agg = new Map<string, EventRow>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("ad_metrics")
        .select("ad_id,spend,revenue,purchases")
        .eq("user_id", userId)
        .eq("account_external_id", accountExternalId)
        .gte("date", since)
        .lte("date", until)
        .range(from, from + PAGE - 1);
      if (error) break;
      const rows = (data ?? []) as { ad_id: string; spend: number | null; revenue: number | null; purchases: number | null }[];
      for (const r of rows) {
        const ev = eventByAd.get(r.ad_id);
        if (!ev) continue;
        const cur = agg.get(ev) ?? { event: ev, spendRs: 0, revenueRs: 0, purchases: 0 };
        cur.spendRs += Number(r.spend ?? 0);
        cur.revenueRs += Number(r.revenue ?? 0);
        cur.purchases += Number(r.purchases ?? 0);
        agg.set(ev, cur);
      }
      if (rows.length < PAGE) break;
    }
    return computeEventRoi([...agg.values()]);
  } catch {
    return [];
  }
}
