import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamAccountDayWiseRows, listAllSpendingAdIds, fetchAdMeta, fetchAdCreatives, listAdSetEnds, type AdMetricRow } from "@/lib/meta-source";
import { thumbUrlOf, deterministicFingerprint } from "@/lib/creative/fingerprint";
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
const AD_CHUNK = 40; // ad ids per day-wise pull: keeps each Meta page fast enough to beat the request timeout

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

  // Always cover the full window [today - backfillDays, today]. Every successful run therefore leaves the
  // store holding the complete window (and refreshes recent days, whose conversions Meta keeps attributing
  // late). ponytail: this re-pulls the whole window each run - correct + simple. An incremental "tail-only
  // after first backfill" optimization is a documented next step (APP-CANON roadmap) for when re-pull cost
  // at scale (hundreds of accounts x thousands of ads) matters; RESYNC_TAIL_DAYS is reserved for it.
  void RESYNC_TAIL_DAYS;
  const since = isoDaysAgo(backfillDays);

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

  const seenAds = new Set<string>();
  let totalRows = 0;
  const persist = async (batch: AdMetricRow[]) => {
    const active = batch.filter((r) => r.spend > 0 || r.impressions > 0);
    if (active.length === 0) return;
    for (let i = 0; i < active.length; i += UPSERT_BATCH) {
      const chunk = active.slice(i, i + UPSERT_BATCH).map(toDbRow);
      const { error } = await admin.from("ad_metrics").upsert(chunk, { onConflict: "user_id,account_external_id,ad_id,date" });
      if (error) throw new Error(`upsert: ${error.message}`);
    }
    active.forEach((r) => seenAds.add(r.adId));
    totalRows += active.length;
  };
  // Capture each ad's parent ids as we stream, so the metadata sync can attach campaign/ad-set + end dates.
  const idMap = new Map<string, { campaignId: string | null; adsetId: string | null }>();
  const persistAndTrack = async (batch: AdMetricRow[]) => {
    for (const r of batch) if (!idMap.has(r.adId)) idMap.set(r.adId, { campaignId: r.campaignId, adsetId: r.adsetId });
    await persist(batch);
  };

  let ads: { adId: string; name: string }[] = [];
  try {
    // Enumerate EVERY spending ad (complete, no cap), then pull day-wise in fast filtered chunks - the
    // whole-account day-wise query is too heavy for Meta to page within the timeout, but ~40 ids at a time
    // pages quickly. Each page is upserted immediately, so a run cut short still persists what it pulled.
    ads = await listAllSpendingAdIds(accountExternalId, since, token);
    for (let i = 0; i < ads.length; i += AD_CHUNK) {
      const chunk = ads.slice(i, i + AD_CHUNK).map((a) => a.adId);
      await streamAccountDayWiseRows(accountExternalId, since, token, persistAndTrack, undefined, chunk);
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : "sync failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500), last_rows: totalRows });
    return { adsSeen: seenAds.size, rows: totalRows, since, ok: false, error };
  }

  // Metadata (name, status, parent names, creative, end date) for every ad, so the app can render + rank
  // entirely from the DB. Best-effort: a metadata hiccup must not lose the metrics we just stored.
  try {
    await syncAdMeta(userId, accountExternalId, token, ads, idMap);
  } catch (e) {
    console.error("[ingest] ad_meta sync failed (metrics still stored)", e);
  }

  await writeState({ last_ok: true, last_error: null, last_synced_date: isoDaysAgo(0), ads_seen: seenAds.size, last_rows: totalRows });
  return { adsSeen: seenAds.size, rows: totalRows, since, ok: true };
}

// Sync per-ad METADATA (name, status, parent names, creative thumb + catalog flag, ad-set end date) into
// ad_meta for every ad, so the app renders + ranks from the DB. idMap carries campaign/ad-set ids captured
// during the metrics stream (Meta's day-wise rows have them; the metadata edges do not). Best-effort per
// source: a missing status/creative just leaves that column null, never blocks the rest.
async function syncAdMeta(
  userId: string,
  accountExternalId: string,
  token: TokenSet,
  ads: { adId: string; name: string }[],
  idMap: Map<string, { campaignId: string | null; adsetId: string | null }>,
): Promise<void> {
  if (ads.length === 0) return;
  const admin = createAdminClient();
  const adIds = ads.map((a) => a.adId);
  const nameById = new Map(ads.map((a) => [a.adId, a.name]));
  const [meta, creatives] = await Promise.all([
    fetchAdMeta(accountExternalId, adIds, token).catch(() => new Map()),
    fetchAdCreatives(accountExternalId, adIds, token).catch(() => new Map()),
  ]);
  const adsetIds = [...new Set([...idMap.values()].map((v) => v.adsetId).filter((x): x is string => Boolean(x)))];
  const ends = await listAdSetEnds(accountExternalId, adsetIds, token).catch(() => new Map<string, number>());

  const rows = adIds.map((adId) => {
    const ids = idMap.get(adId);
    const m = meta.get(adId);
    const c = creatives.get(adId);
    return {
      user_id: userId,
      account_external_id: accountExternalId,
      ad_id: adId,
      name: nameById.get(adId) ?? adId,
      effective_status: m?.status ?? null,
      campaign_id: ids?.campaignId ?? null,
      campaign_name: m?.campaignName ?? null,
      adset_id: ids?.adsetId ?? null,
      adset_name: m?.adsetName ?? null,
      thumb_url: c ? thumbUrlOf(c) : null,
      is_catalog: c?.isCatalog ?? false,
      format: c ? deterministicFingerprint(c).format : null, // for the creative-diversity read off the store
      adset_end_unix: ids?.adsetId ? (ends.get(ids.adsetId) ?? null) : null,
      updated_at: new Date().toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await admin.from("ad_meta").upsert(batch, { onConflict: "user_id,account_external_id,ad_id" });
    if (error) throw new Error(`ad_meta upsert: ${error.message}`);
  }
}
