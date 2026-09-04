import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paged";
import { unstable_cache } from "next/cache";
import { accountStoreTag } from "@/lib/cache";

// Video retention curve (P3/P4): account-level share of impressions that reached each milestone
// (3s -> 25% -> 50% -> 75% -> 100%). The shape is the diagnostic - WHERE viewers drop, not just the endpoint.
// Self-contained read (own tenant-scoped query, cached, busted by ingest), same pattern as hook-hold/event-roi.
// Quartile columns are 0 for rows synced before migration 0044, so the curve fills in going forward.

export type RetentionPoint = { label: string; count: number; pctOfImpressions: number; pctOf3s: number };
export type RetentionCurve = { impressions: number; video3s: number; points: RetentionPoint[]; hasData: boolean };

async function computeRetentionCurve(userId: string, accountExternalId: string, since: string, until: string): Promise<RetentionCurve> {
  const empty: RetentionCurve = { impressions: 0, video3s: 0, points: [], hasData: false };
  try {
    const admin = createAdminClient();
    let impressions = 0, v3 = 0, p25 = 0, p50 = 0, p75 = 0, p100 = 0;
    const rows = await readAllPages<{ impressions: number | null; video_3s: number | null; video_p25: number | null; video_p50: number | null; video_p75: number | null; video_p100: number | null }>((f, t) =>
      admin.from("ad_metrics").select("impressions,video_3s,video_p25,video_p50,video_p75,video_p100").eq("user_id", userId).eq("account_external_id", accountExternalId).gte("date", since).lte("date", until).order("ad_id", { ascending: true }).order("date", { ascending: true }).range(f, t),
    );
    for (const r of rows) {
      impressions += Number(r.impressions ?? 0);
      v3 += Number(r.video_3s ?? 0);
      p25 += Number(r.video_p25 ?? 0);
      p50 += Number(r.video_p50 ?? 0);
      p75 += Number(r.video_p75 ?? 0);
      p100 += Number(r.video_p100 ?? 0);
    }
    // No quartile data yet (pre-0044 rows, or a non-video account) -> honest "no data".
    if (v3 === 0 && p25 + p50 + p75 + p100 === 0) return empty;
    const mk = (label: string, count: number): RetentionPoint => ({
      label,
      count,
      pctOfImpressions: impressions > 0 ? count / impressions : 0,
      pctOf3s: v3 > 0 ? count / v3 : 0,
    });
    return {
      impressions,
      video3s: v3,
      hasData: true,
      points: [mk("3s view", v3), mk("25%", p25), mk("50%", p50), mk("75%", p75), mk("100%", p100)],
    };
  } catch {
    return empty;
  }
}

export async function getRetentionCurve(userId: string, accountExternalId: string, since: string, until: string): Promise<RetentionCurve> {
  try {
    return await unstable_cache(
      () => computeRetentionCurve(userId, accountExternalId, since, until),
      ["retention-curve", userId, accountExternalId, since, until],
      { revalidate: 6 * 3600, tags: [accountStoreTag(userId, accountExternalId)] },
    )();
  } catch {
    return { impressions: 0, video3s: 0, points: [], hasData: false };
  }
}
