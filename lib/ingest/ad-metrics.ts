import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamAccountDayWiseRows, listAllSpendingAdIds, fetchAdMeta, fetchAdCreatives, listAdSetEnds, type AdMetricRow } from "@/lib/meta-source";
import { thumbUrlOf, deterministicFingerprint } from "@/lib/creative/fingerprint";
import { selectAdsToSync } from "@/lib/ingest/select-ads";
import { notify, notifyFailure } from "@/lib/notifications/store";
import type { TokenSet } from "@/lib/ad-source";

// Ingestion pipeline (roadmap #1): pull EVERY ad's day-wise metrics for an account into the ad_metrics
// store, so the app can analyze every spending ad regardless of size (built for $100M/month brands with
// thousands of ads). This is a BACKGROUND job (cron/worker), never a page-load call - it has the time to
// paginate through the whole account. Idempotent: re-running upserts the same rows, so a partial run is
// safe to retry.
//
// RESUMABLE + deadline-bounded: an account with 2-3k ads cannot be fully pulled inside one serverless
// request (300s). So each run does a BOUNDED slice - it syncs the ads that are missing or stalest first,
// stops before the deadline, and records durable progress. Repeated runs (client-looped for a manual sync,
// self-chained for the cron) converge to complete coverage, then keep it fresh. Idempotent throughout.

const BACKFILL_DAYS = 90; // the app-wide comparison window; first sync backfills this much history
const UPSERT_BATCH = 500; // rows per upsert call, so a huge account never sends one giant payload
const AD_CHUNK = 40; // ad ids per day-wise pull: keeps each Meta page fast enough to beat the request timeout
const DEADLINE_MS = 230_000; // stop a run here, under the 300s function cap, leaving margin to record progress + chain
const REFRESH_INTERVAL_MS = 20 * 60 * 60 * 1000; // once an ad is synced, skip it for ~a day (then re-pull to absorb late attribution)

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// processed/remaining/complete drive the resumable loop: the caller re-invokes until complete === true.
export type SyncResult = { adsSeen: number; rows: number; since: string; ok: boolean; error?: string; processed: number; remaining: number; complete: boolean };

/**
 * Sync one account's day-wise metrics + metadata into the store, RESUMABLY. Complete coverage, no top-N cap,
 * but BOUNDED per run: it processes the ads that are missing or stalest first, up to opts.deadlineMs, then
 * returns { processed, remaining, complete }. Re-invoke until complete === true. Never throws - returns
 * ok:false so a cron loop continues.
 */
export async function syncAdMetrics(userId: string, accountExternalId: string, token: TokenSet, opts: { backfillDays?: number; deadlineMs?: number } = {}): Promise<SyncResult> {
  const admin = createAdminClient();
  const backfillDays = opts.backfillDays ?? BACKFILL_DAYS;
  const deadline = Date.now() + (opts.deadlineMs ?? DEADLINE_MS);
  const since = isoDaysAgo(backfillDays);

  // Always record the run outcome (ok/error/rows) so a background run is observable without server logs.
  const writeState = (fields: Record<string, unknown>) =>
    admin
      .from("ad_sync_state")
      .upsert({ user_id: userId, account_external_id: accountExternalId, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...fields }, { onConflict: "user_id,account_external_id" })
      .then(undefined, () => {});

  // Map one metrics row to its DB shape. Only DELIVERED rows (impressions > 0) are stored - a day with no
  // delivery has no analyzable signal, and a 0/negative-impression row must never reach a rate (CTR/CPM/
  // frequency). This is the single ingest gate for the whole app: nothing with impressions <= 0 gets in.
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

  // 1. Enumerate EVERY spending ad in the window (fast: one paginated insights call, no per-ad work yet).
  let allAds: { adId: string; name: string }[];
  try {
    allAds = await listAllSpendingAdIds(accountExternalId, since, token);
  } catch (e) {
    const error = e instanceof Error ? e.message : "sync failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500) });
    await notifyFailure(userId, "sync", error, { dedupeKey: `sync:${accountExternalId}`, source: "syncing your ad data", context: { accountExternalId } });
    return { adsSeen: 0, rows: 0, since, ok: false, error, processed: 0, remaining: 0, complete: false };
  }

  // 2. Pick the ads still needing work: never synced (no ad_meta row) first, then the stalest, and skip any
  //    synced within REFRESH_INTERVAL. This is what makes the sync resumable AND self-refreshing - every run
  //    advances the least-covered ads, so repeated runs converge on full coverage and then keep it fresh.
  const { data: metaRows } = await admin.from("ad_meta").select("ad_id, updated_at").eq("user_id", userId).eq("account_external_id", accountExternalId);
  const syncedAt = new Map<string, number>(((metaRows ?? []) as { ad_id: string; updated_at: string }[]).map((r) => [r.ad_id, Date.parse(r.updated_at)]));
  const toProcess = selectAdsToSync(allAds, syncedAt, Date.now() - REFRESH_INTERVAL_MS);

  // 3. Process chunks until the deadline (or done). Each chunk syncs metrics AND metadata TOGETHER, so an ad
  //    is covered atomically: a run cut short leaves whole, usable ads behind, never half-synced ones.
  let totalRows = 0;
  let processed = 0;
  let metaError: string | null = null;
  try {
    for (let i = 0; i < toProcess.length; i += AD_CHUNK) {
      if (Date.now() > deadline) break; // out of time - the next run resumes at the next stalest ad
      const chunk = toProcess.slice(i, i + AD_CHUNK);
      const idMap = new Map<string, { campaignId: string | null; adsetId: string | null }>();
      const persist = async (batch: AdMetricRow[]) => {
        for (const r of batch) if (!idMap.has(r.adId)) idMap.set(r.adId, { campaignId: r.campaignId, adsetId: r.adsetId });
        const active = batch.filter((r) => r.impressions > 0);
        for (let j = 0; j < active.length; j += UPSERT_BATCH) {
          const { error } = await admin.from("ad_metrics").upsert(active.slice(j, j + UPSERT_BATCH).map(toDbRow), { onConflict: "user_id,account_external_id,ad_id,date" });
          if (error) throw new Error(`upsert: ${error.message}`);
        }
        totalRows += active.length;
      };
      await streamAccountDayWiseRows(accountExternalId, since, token, persist, undefined, chunk.map((a) => a.adId));
      // Metadata for this chunk. A failure is recorded but never fatal to the metrics just stored - the ad
      // stays "stale" (its ad_meta row isn't written), so the next run naturally retries it.
      try {
        await syncAdMeta(userId, accountExternalId, token, chunk, idMap);
      } catch (e) {
        metaError = e instanceof Error ? e.message : "ad_meta sync failed";
        console.error("[ingest] ad_meta chunk failed (metrics stored; ad stays stale for retry)", e);
      }
      processed += chunk.length;
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : "sync failed";
    await writeState({ last_ok: false, last_error: error.slice(0, 500), ads_seen: allAds.length, last_rows: totalRows });
    await notifyFailure(userId, "sync", error, { dedupeKey: `sync:${accountExternalId}`, source: "syncing your ad data", context: { accountExternalId } });
    return { adsSeen: allAds.length, rows: totalRows, since, ok: false, error, processed, remaining: toProcess.length - processed, complete: false };
  }

  const remaining = toProcess.length - processed;
  const complete = remaining === 0;
  await writeState({ last_ok: metaError === null, last_error: metaError ? `metadata: ${metaError}`.slice(0, 500) : null, last_synced_date: isoDaysAgo(0), ads_seen: allAds.length, last_rows: totalRows });
  // Tell the user, only once coverage converges (dedupe_key keeps it to one live row per account, so the
  // self-chaining hops don't spam the feed): a clean "up to date", or a plain-English partial-sync warning.
  if (complete) {
    if (metaError) await notifyFailure(userId, "sync", `metadata: ${metaError}`, { dedupeKey: `sync:${accountExternalId}`, source: "syncing your ad data", context: { accountExternalId } });
    else await notify({ userId, kind: "sync", status: "success", title: "Your ad data is up to date", detail: `Synced ${allAds.length} ads.`, dedupeKey: `sync:${accountExternalId}`, context: { accountExternalId, ads: allAds.length } });
  }
  return { adsSeen: allAds.length, rows: totalRows, since, ok: true, processed, remaining, complete };
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
    // Per-ad, NEVER throw: one malformed creative must not lose the other ads' metadata. A bad
    // fingerprint/thumb just leaves those two fields null - the ad is still stored, still analyzable.
    let thumb: string | null = null;
    let format: string | null = null;
    let contentHash: string | null = null;
    let isCatalog = false;
    if (c) {
      try {
        thumb = thumbUrlOf(c);
        const fp = deterministicFingerprint(c); // for the creative-diversity read off the store
        format = fp.format;
        contentHash = fp.contentHash; // fingerprint-once key into creative_semantics (hook/emotion/subject)
        isCatalog = c.isCatalog ?? false;
      } catch {
        /* malformed creative -> leave format/thumb null, keep the row */
      }
    }
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
      thumb_url: thumb,
      is_catalog: isCatalog,
      format,
      content_hash: contentHash,
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
