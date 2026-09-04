import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { unstable_cache } from "next/cache";
import { accountStoreTag } from "@/lib/cache";
import { classifyHookHold, hookHoldMedians, type HookHoldInput, type HookHoldRead } from "./hook-hold";

// Self-contained read for the hook x hold 2x2 (mirrors event-roi-store's pattern): its own tenant-scoped
// admin query over ad_meta (names) + ad_metrics (per-ad video counts) for the window, aggregated per ad,
// then classified vs THIS account's own medians (hook-hold.ts). Never touches the cockpit pipeline.

export type HookHoldAd = { adId: string; name: string; spendRs: number; impressions: number; read: HookHoldRead };
export type HookHoldSummary = { ads: HookHoldAd[]; hookMedian: number | null; holdMedian: number | null; counts: Record<HookHoldRead["quadrant"], number> };

async function computeHookHold(userId: string, accountExternalId: string, since: string, until: string): Promise<HookHoldSummary> {
  const empty: HookHoldSummary = { ads: [], hookMedian: null, holdMedian: null, counts: { scale: 0, rewrite_payoff: 0, recut_hook: 0, kill_concept: 0, insufficient: 0 } };
  try {
    const admin = createAdminClient();
    // Names (paged: a bare select caps at 1,000 rows, silently dropping a big account's later ads).
    const nameById = new Map<string, string>();
    const meta = await readAllPages<{ ad_id: string; name: string | null }>((f, t) =>
      admin.from("ad_meta").select("ad_id,name").eq("user_id", userId).eq("account_external_id", accountExternalId).order("ad_id", { ascending: true }).range(f, t),
    );
    for (const m of meta) nameById.set(m.ad_id, m.name ?? m.ad_id);

    // Per-ad video counts over the window. Parallel-burst paging + total order (ad_id, date) - the Phase-0
    // paging discipline (offset paging with no total order can duplicate/drop rows).
    const agg = new Map<string, HookHoldInput & { spendRs: number }>();
    const rows = await readAllPages<{ ad_id: string; spend: number | null; impressions: number | null; video_3s: number | null; video_thruplays: number | null }>((f, t) =>
      admin.from("ad_metrics").select("ad_id,spend,impressions,video_3s,video_thruplays").eq("user_id", userId).eq("account_external_id", accountExternalId).gte("date", since).lte("date", until).order("ad_id", { ascending: true }).order("date", { ascending: true }).range(f, t),
    );
    for (const r of rows) {
      const cur = agg.get(r.ad_id) ?? { impressions: 0, video3s: 0, thruplays: 0, spendRs: 0 };
      cur.impressions += Number(r.impressions ?? 0);
      cur.video3s += Number(r.video_3s ?? 0);
      cur.thruplays += Number(r.video_thruplays ?? 0);
      cur.spendRs += Number(r.spend ?? 0);
      agg.set(r.ad_id, cur);
    }
    if (agg.size === 0) return empty;

    const inputs = [...agg.values()];
    const { hookMedian, holdMedian } = hookHoldMedians(inputs);
    const counts = { scale: 0, rewrite_payoff: 0, recut_hook: 0, kill_concept: 0, insufficient: 0 } as Record<HookHoldRead["quadrant"], number>;
    const ads: HookHoldAd[] = [];
    for (const [adId, v] of agg) {
      const read = classifyHookHold({ impressions: v.impressions, video3s: v.video3s, thruplays: v.thruplays }, hookMedian, holdMedian);
      counts[read.quadrant]++;
      ads.push({ adId, name: nameById.get(adId) ?? adId, spendRs: v.spendRs, impressions: v.impressions, read });
    }
    // Biggest spenders first: the most expensive creative decisions sit at the top.
    ads.sort((a, b) => b.spendRs - a.spendRs);
    return { ads, hookMedian, holdMedian, counts };
  } catch {
    return empty;
  }
}

// Cached wrapper (data cache, busted by the ingest via accountStoreTag) - same instant-repeat-load pattern as
// the event-ROI panel. The Map/Set-free return is already serializable.
export async function getHookHold(userId: string, accountExternalId: string, since: string, until: string): Promise<HookHoldSummary> {
  try {
    return await unstable_cache(
      () => computeHookHold(userId, accountExternalId, since, until),
      ["hook-hold", userId, accountExternalId, since, until],
      { revalidate: 6 * 3600, tags: [accountStoreTag(userId, accountExternalId)] },
    )();
  } catch {
    return { ads: [], hookMedian: null, holdMedian: null, counts: { scale: 0, rewrite_payoff: 0, recut_hook: 0, kill_concept: 0, insufficient: 0 } };
  }
}
