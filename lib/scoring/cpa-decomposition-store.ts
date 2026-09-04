import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { unstable_cache } from "next/cache";
import { accountStoreTag } from "@/lib/cache";
import { priorWindow } from "./event-roi";
import { decomposeCpa, type CpaDecomposition, type CpaWindow } from "./cpa-decomposition";

// Self-contained read for the CPA decomposition: account totals for the current window vs the equal-length
// window just before it, then decomposeCpa attributes the CPA move to CPM / CTR / CVR. Same pattern as the
// event-ROI / hook-hold reads (own tenant-scoped query, parallel paging, unstable_cache busted by ingest).

async function computeCpaDecomposition(userId: string, accountExternalId: string, since: string, until: string): Promise<CpaDecomposition> {
  const insufficient: CpaDecomposition = { ok: false, cpaBefore: null, cpaAfter: null, deltaPct: null, contributions: null, dominant: null, reason: "not enough data yet" };
  try {
    const admin = createAdminClient();
    const { priorSince } = priorWindow(since, until);
    const before: CpaWindow = { spend: 0, impressions: 0, clicks: 0, purchases: 0 };
    const after: CpaWindow = { spend: 0, impressions: 0, clicks: 0, purchases: 0 };
    const rows = await readAllPages<{ date: string; spend: number | null; impressions: number | null; clicks: number | null; purchases: number | null }>((f, t) =>
      admin.from("ad_metrics").select("date,spend,impressions,clicks,purchases").eq("user_id", userId).eq("account_external_id", accountExternalId).gte("date", priorSince).lte("date", until).order("ad_id", { ascending: true }).order("date", { ascending: true }).range(f, t),
    );
    for (const r of rows) {
      const bucket = r.date >= since ? after : before; // lexical compare is correct for YYYY-MM-DD
      bucket.spend += Number(r.spend ?? 0);
      bucket.impressions += Number(r.impressions ?? 0);
      bucket.clicks += Number(r.clicks ?? 0);
      bucket.purchases += Number(r.purchases ?? 0);
    }
    return decomposeCpa(before, after);
  } catch {
    return insufficient;
  }
}

export async function getCpaDecomposition(userId: string, accountExternalId: string, since: string, until: string): Promise<CpaDecomposition> {
  try {
    return await unstable_cache(
      () => computeCpaDecomposition(userId, accountExternalId, since, until),
      ["cpa-decomposition", userId, accountExternalId, since, until],
      { revalidate: 6 * 3600, tags: [accountStoreTag(userId, accountExternalId)] },
    )();
  } catch {
    return { ok: false, cpaBefore: null, cpaAfter: null, deltaPct: null, contributions: null, dominant: null, reason: "not enough data yet" };
  }
}
