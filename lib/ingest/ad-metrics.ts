import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamAccountDayWiseRows, type AdMetricRow } from "@/lib/meta-source";
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
export async function syncAdMetrics(userId: string, accountExternalId: string, token: TokenSet, backfillDays: number = BACKFILL_DAYS): Promise<SyncResult> {
  const admin = createAdminClient();

  // Always record the run outcome (ok/error/rows) so a background run is observable without server logs.
  const writeState = (fields: Record<string, unknown>) =>
    admin
      .from("ad_sync_state")
      .upsert({ user_id: userId, account_external_id: accountExternalId, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields }, { onConflict: "user_id,account_external_id" })
      .then(undefined, () => {});

  // Incremental window: first run backfills BACKFILL_DAYS; later runs re-pull only the recent tail + new days.
  let since = isoDaysAgo(backfillDays);
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
      const floor = isoDaysAgo(backfillDays);
      if (since < floor) since = floor;
    }
  } catch {
    // no sync-state row yet (or read failed) -> full backfill, which is the safe default
  }

  // Map one metrics row to its DB shape. Only rows with real activity (spend or impressions) are stored,
  // so a brand with 5 ads stores 5 and one with 5,000 stores 5,000 - nothing capped, nothing empty stored.
  const toDbRow = (r: AdMetricRow) => ({
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
  });

  // Stream page-by-page and upsert each page immediately: the store fills as the pull runs, so a run cut
  // short still makes progress (and the next run resumes), and a huge account never buffers in memory.
  const seenAds = new Set<string>();
  let totalRows = 0;
  try {
    await streamAccountDayWiseRows(accountExternalId, since, token, async (batch) => {
      const active = batch.filter((r) => r.spend > 0 || r.impressions > 0);
      if (active.length === 0) return;
      for (let i = 0; i < active.length; i += UPSERT_BATCH) {
        const chunk = active.slice(i, i + UPSERT_BATCH).map(toDbRow);
        const { error } = await admin.from("ad_metrics").upsert(chunk, { onConflict: "user_id,account_external_id,ad_id,date" });
        if (error) throw new Error(`upsert: ${error.message}`);
      }
      active.forEach((r) => seenAds.add(r.adId));
      totalRows += active.length;
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "sync failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500), last_rows: totalRows });
    return { adsSeen: seenAds.size, rows: totalRows, since, ok: false, error };
  }

  await writeState({ last_ok: true, last_error: null, last_synced_date: isoDaysAgo(0), ads_seen: seenAds.size, last_rows: totalRows });
  return { adsSeen: seenAds.size, rows: totalRows, since, ok: true };
}
