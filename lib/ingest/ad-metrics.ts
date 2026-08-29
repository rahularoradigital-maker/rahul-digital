import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAccountDayWiseRows, type AdMetricRow } from "@/lib/meta-source";
import type { TokenSet } from "@/lib/ad-source";

// Ingestion pipeline (roadmap #1): pull EVERY ad's day-wise metrics for an account into the ad_metrics
// store, so the app can analyze every spending ad regardless of size (built for $100M/month brands with
// thousands of ads). This is a BACKGROUND job (cron/worker), never a page-load call - it has the time to
// paginate through the whole account. Idempotent: re-running upserts the same rows, so a partial run is
// safe to retry.
//
// Incremental: after the first (backfill) run, each run re-pulls only the last RESYNC_TAIL_DAYS plus any
// new days. The tail is re-pulled because Meta keeps attributing conversions to recent days for days after
// the click, so yesterday's revenue/purchases change under us - we must overwrite, not skip.

const BACKFILL_DAYS = 90; // the app-wide comparison window; first sync backfills this much history
const RESYNC_TAIL_DAYS = 4; // re-pull this many recent days each run to absorb late attribution
const UPSERT_BATCH = 500; // rows per upsert call, so a huge account never sends one giant payload

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export type SyncResult = { adsSeen: number; rows: number; since: string; ok: boolean; error?: string };

/**
 * Sync one account's day-wise ad metrics into the ad_metrics store. Complete coverage: no top-N cap.
 * Returns counts for observability. Never throws - returns { ok:false, error } so a cron loop continues.
 */
export async function syncAdMetrics(userId: string, accountExternalId: string, token: TokenSet): Promise<SyncResult> {
  const admin = createAdminClient();

  // Incremental window: first run backfills BACKFILL_DAYS; later runs re-pull only the recent tail + new days.
  let since = isoDaysAgo(BACKFILL_DAYS);
  try {
    const { data } = await admin
      .from("ad_sync_state")
      .select("last_synced_date")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .maybeSingle();
    const last = data?.last_synced_date as string | undefined;
    if (last) {
      const tail = isoDaysAgo(RESYNC_TAIL_DAYS);
      // Start from the earlier of (last-synced minus the tail) and the tail date, but never older than the
      // backfill horizon - so we always cover the attributing tail + any gap since the last run.
      const lastMinusTail = new Date(new Date(last).getTime() - RESYNC_TAIL_DAYS * 86_400_000).toISOString().slice(0, 10);
      since = [lastMinusTail, tail].sort()[0]; // earlier date
      const floor = isoDaysAgo(BACKFILL_DAYS);
      if (since < floor) since = floor;
    }
  } catch {
    // no sync-state row yet (or read failed) -> full backfill, which is the safe default
  }

  let rows: AdMetricRow[];
  try {
    rows = await fetchAccountDayWiseRows(accountExternalId, since, token);
  } catch (e) {
    return { adsSeen: 0, rows: 0, since, ok: false, error: e instanceof Error ? e.message : "pull failed" };
  }

  // Upsert in batches. Only rows with real activity are stored (spend or impressions), so a brand with
  // 5 ads stores 5 and one with 5,000 stores 5,000 - nothing is capped, nothing empty is stored.
  const active = rows.filter((r) => r.spend > 0 || r.impressions > 0);
  const dbRows = active.map((r) => ({
    user_id: userId,
    account_external_id: accountExternalId,
    ad_id: r.adId,
    date: r.date,
    campaign_id: r.campaignId,
    adset_id: r.adsetId,
    objective: r.objective,
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    frequency: r.frequency,
    purchases: r.purchases,
    revenue: r.revenue,
    video_3s: r.video3s,
    video_thruplays: r.videoThruplays,
    outbound_clicks: r.outboundClicks,
    landing_page_views: r.landingPageViews,
    add_to_carts: r.addToCarts,
    initiate_checkouts: r.initiateCheckouts,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < dbRows.length; i += UPSERT_BATCH) {
    const batch = dbRows.slice(i, i + UPSERT_BATCH);
    const { error } = await admin.from("ad_metrics").upsert(batch, { onConflict: "user_id,account_external_id,ad_id,date" });
    if (error) return { adsSeen: 0, rows: i, since, ok: false, error: error.message };
  }

  const adsSeen = new Set(active.map((r) => r.adId)).size;
  await admin
    .from("ad_sync_state")
    .upsert(
      { user_id: userId, account_external_id: accountExternalId, last_synced_date: isoDaysAgo(0), last_run_at: new Date().toISOString(), ads_seen: adsSeen, updated_at: new Date().toISOString() },
      { onConflict: "user_id,account_external_id" },
    )
    .then(undefined, () => {}); // bookmark write is best-effort; the upsert above is the real work

  return { adsSeen, rows: dbRows.length, since, ok: true };
}
