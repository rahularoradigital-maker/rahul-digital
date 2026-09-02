import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapMetaObjective, fetchAdStatuses, type ScopeInsights } from "@/lib/meta-source";
import type { MetricsRow, TokenSet } from "@/lib/ad-source";
import { toCockpitInputs, type RealAd } from "@/lib/scoring";
import { passesEventFilter } from "@/lib/scope/event-filter";
import { analyzeAccount } from "@/lib/cockpit/analyze";
import { windowFunnel, type ExtendedMetricsRow } from "@/lib/metrics/funnel-metrics";
import { buildDailySeries, type DailyInputRow } from "@/lib/cockpit/daily-series";
import { levelFunnels, type NativeByLevel } from "@/lib/cockpit/level-funnel";
import { marginalScaling } from "@/lib/scoring/marginal";
import { assessDataQuality } from "@/lib/scoring/data-quality";
import { daysUntilEnd } from "@/lib/scoring/fatigue";
import { assessDiversity, type CreativeRecord, type DiversityRead } from "@/lib/creative/diversity";
import { buildCreativeStrategy, type CreativeStrategy } from "@/lib/creative/strategy";
import { after } from "next/server";
import { readSemanticsCache, decodeMissingVisual } from "@/lib/creative/decode";
import type { CreativeFormat, CreativeAsset } from "@/lib/creative/fingerprint";
import { VERDICT_WEIGHTS, type ScoreWeights } from "@/lib/rules/verdict";
import type { LiveCockpit, AccountMetrics, ProcessedCounts, CatalogMode } from "@/lib/meta-sync";
import { captureError } from "@/lib/observability";

// Stable per-creative identity for the semantic cache. Ingestion normally stores content_hash (derived
// from creative facts); when it is absent - older rows synced before that logic, or any account with a
// sync gap - fall back to the creative's CDN asset filename, the one stable part of the thumb URL (host
// region + the ?_nc_* query token churn between fetches; the numeric filename is the asset's identity).
// Keeps creative-diversity populating for EVERY account regardless of when its meta was last synced.
function semanticKey(m?: { content_hash?: string | null; thumb_url?: string | null } | null): string | null {
  if (m?.content_hash) return m.content_hash;
  const u = m?.thumb_url;
  if (!u) return null;
  const path = u.split("?")[0];
  const file = path.slice(path.lastIndexOf("/") + 1);
  return file ? "cdn:" + file : null;
}

// STAGE 2b: build the cockpit from the ad_metrics + ad_meta STORE instead of a live Meta pull. The store
// holds EVERY spending ad day-wise (no top-N cap), so the leaderboard, verdicts, KPIs, and funnel finally
// reflect the whole account. Returns null when the store has no data for this account+window, so the caller
// falls back to the on-demand pull - the app is therefore never worse than before, only more complete.
//
// Reuses the exact downstream the live pull uses (toCockpitInputs -> analyzeAccount, windowFunnel,
// buildDailySeries, levelFunnels, marginalScaling, assessDataQuality), so the output shape is identical.

type MetricRowDb = {
  ad_id: string;
  date: string;
  campaign_id: string | null;
  adset_id: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  frequency: number;
  purchases: number;
  revenue: number;
  video_3s: number;
  video_thruplays: number;
  outbound_clicks: number;
  landing_page_views: number;
  add_to_carts: number;
  initiate_checkouts: number;
};
type MetaRowDb = {
  ad_id: string;
  name: string | null;
  effective_status: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  thumb_url: string | null;
  is_catalog: boolean | null;
  format: string | null;
  content_hash: string | null;
  adset_end_unix: number | null;
  optimization_event: string | null;
};

const PAGE = 1000; // Supabase caps a select at 1000 rows; page through so a 40k-row account is not silently truncated.

// Read every ad_metrics row for the account within [since, until], paging past the 1000-row cap.
async function readAllMetricRows(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  accountExternalId: string,
  since: string,
  until: string,
): Promise<MetricRowDb[]> {
  const out: MetricRowDb[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ad_metrics")
      .select("ad_id,date,campaign_id,adset_id,objective,spend,impressions,clicks,frequency,purchases,revenue,video_3s,video_thruplays,outbound_clicks,landing_page_views,add_to_carts,initiate_checkouts")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .gte("date", since)
      .lte("date", until)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ad_metrics read: ${error.message}`);
    const rows = (data ?? []) as MetricRowDb[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

// Read every ad_meta row for the account, paging past the 1000-row cap. One row per ad, but a 2-3k-ad
// account still exceeds 1000 - a single .range() silently truncates to 1000, which left ~34 of Soch's 1034
// ads with no metadata in the map and tripped the completeness gate, so the store never activated at scale.
async function readAllMetaRows(admin: ReturnType<typeof createAdminClient>, userId: string, accountExternalId: string): Promise<MetaRowDb[]> {
  const out: MetaRowDb[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ad_meta")
      .select("ad_id,name,effective_status,campaign_id,campaign_name,adset_id,adset_name,thumb_url,is_catalog,format,content_hash,adset_end_unix,optimization_event")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ad_meta read: ${error.message}`);
    const rows = (data ?? []) as MetaRowDb[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function buildCockpitFromStore(opts: {
  userId: string;
  accountExternalId: string;
  accountName: string;
  since: string;
  until: string;
  catalog: CatalogMode;
  weights?: ScoreWeights;
  objectives?: string[];
  events?: string[]; // optimization-event filter (ad set's custom_event_type/optimization_goal)
  campaignIds?: string[];
  syncedAt?: string;
  // Meta's ACCOUNT-LEVEL scope total (from the caller), used for the headline so spend/revenue match Ads
  // Manager exactly even when the ad-level store lags the long tail of tiny-spend ads. Best-effort.
  scopePromise?: Promise<ScopeInsights | null>;
  // Level-native metrics (reach/frequency/budget) the caller fetched live (the store has no token). Best-effort;
  // absent/empty -> the level cards show "n/a" as before. This is what makes the PRIMARY (store) path show them.
  nativePromise?: Promise<NativeByLevel>;
  // The user's Meta token. When present, the store path refreshes the CURRENT effective_status for the top
  // spenders (the ads that surface as actions) so a recently-paused/ended ad - whose stored status is only as
  // fresh as the last sync - never gets an action nudge. Best-effort; absent/failure -> stored status is used.
  token?: TokenSet;
}): Promise<LiveCockpit | null> {
  const { userId, accountExternalId, accountName, since, until, catalog } = opts;
  const weights = opts.weights ?? VERDICT_WEIGHTS;
  const admin = createAdminClient();

  // The DISPLAY window (what the topbar selected) is [since, until]. The fatigue/trend/scaling BASELINE is
  // always the full 90 days ending `until`, read regardless of the display window - switching to a 7-day
  // view never shrinks the trend read, and it needs no re-pull (the store already holds 90 days).
  const displaySince = since;
  const BASELINE_DAYS = 90;
  const baselineSince = new Date(new Date(`${until}T00:00:00Z`).getTime() - BASELINE_DAYS * 86_400_000).toISOString().slice(0, 10);

  let metricRows: MetricRowDb[];
  try {
    metricRows = await readAllMetricRows(admin, userId, accountExternalId, baselineSince, until);
  } catch {
    return null; // store unavailable -> fall back to the live pull
  }
  if (metricRows.length === 0) return null; // nothing stored yet -> fall back

  // Metadata for the account (name/status/parents/creative/format/end), paged past the 1000-row cap.
  let metaRows: MetaRowDb[];
  try {
    metaRows = await readAllMetaRows(admin, userId, accountExternalId);
  } catch {
    return null; // store unavailable -> fall back to the live pull
  }
  const metaById = new Map<string, MetaRowDb>(metaRows.map((m) => [m.ad_id, m]));
  // Correctness gate: without metadata we cannot exclude catalog ads or hide paused ads (both would be
  // wrong), so if the metadata half of the store has not synced yet, fall back to the live pull.
  if (metaById.size === 0) return null;

  // Group day-wise rows by ad.
  const rowsByAd = new Map<string, MetricRowDb[]>();
  for (const r of metricRows) {
    const list = rowsByAd.get(r.ad_id) ?? [];
    list.push(r);
    rowsByAd.set(r.ad_id, list);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const toMetricsRow = (r: MetricRowDb): MetricsRow => ({
    adExternalId: r.ad_id,
    date: r.date,
    spend: r.spend,
    impressions: r.impressions,
    clicks: r.clicks,
    purchases: r.purchases,
    revenue: r.revenue,
    frequency: r.frequency,
    video3sViews: r.video_3s,
    videoThruplays: r.video_thruplays,
    outboundClicks: r.outbound_clicks,
    landingPageViews: r.landing_page_views,
    addToCarts: r.add_to_carts,
    initiateCheckouts: r.initiate_checkouts,
  });

  // Build one RealAd per ad, joining metadata. Objective is the raw Meta objective on the rows, mapped.
  let realAds: RealAd[] = [];
  for (const [adId, rows] of rowsByAd) {
    const m = metaById.get(adId);
    const rawObjective = rows.find((r) => r.objective)?.objective ?? "";
    const status = m?.effective_status ?? undefined;
    const endUnix = m?.adset_end_unix ?? null;
    realAds.push({
      externalId: adId,
      name: m?.name ?? adId,
      objective: mapMetaObjective(rawObjective),
      rows: rows.filter((r) => r.date >= displaySince).map(toMetricsRow), // display window: spend/ROAS/CTR/funnel shown
      baselineRows: rows.map(toMetricsRow), // full 90 days: fatigue/trend/stability read this, not the display window
      endsInDays: daysUntilEnd(endUnix, nowSec),
      adSetId: m?.adset_id ?? rows[0]?.adset_id ?? undefined,
      campaignId: m?.campaign_id ?? rows[0]?.campaign_id ?? undefined,
      adsetName: m?.adset_name ?? undefined,
      campaignName: m?.campaign_name ?? undefined,
      active: status === undefined ? undefined : status === "ACTIVE",
      thumbUrl: m?.thumb_url ?? null,
    });
  }

  // Topbar filters, applied off the store's own fields (no extra Meta call).
  if (catalog === "exclude") realAds = realAds.filter((a) => !(metaById.get(a.externalId)?.is_catalog));
  if (opts.objectives && opts.objectives.length > 0) {
    const set = new Set(opts.objectives);
    realAds = realAds.filter((a) => a.objective !== undefined && set.has(a.objective));
  }
  // Optimization-EVENT filter (topbar): keep only ads whose ad set optimizes for a selected event
  // (custom_event_type/optimization_goal). Ads with no stored event are dropped when a filter is active,
  // so "conversion + add_to_cart" shows exactly those and removes the rest, aggregates included.
  if (opts.events && opts.events.length > 0) {
    const set = new Set(opts.events);
    realAds = realAds.filter((a) => passesEventFilter(metaById.get(a.externalId)?.optimization_event, set));
  }
  if (opts.campaignIds && opts.campaignIds.length > 0) {
    const set = new Set(opts.campaignIds);
    realAds = realAds.filter((a) => a.campaignId && set.has(a.campaignId));
  }

  // Completeness gate: only trust the store when metadata covers every ad in the window. A partial sync
  // (metrics for 1000 ads, metadata for 200) would otherwise render nameless ads and mis-read catalog
  // status, which is worse than the clean live pull. Until the sync fully covers the window, fall back.
  for (const adId of rowsByAd.keys()) if (!metaById.has(adId)) return null;

  // Same source-level gate as the live path: judge only ads that spent AND are not paused/ended (stored status).
  let inputs = toCockpitInputs(realAds).filter((a) => (a.impressions ?? 0) > 0 && a.spendRs > 0 && a.active !== false);
  if (inputs.length === 0) return null; // store has rows but nothing analyzable in scope -> let the caller fall back

  // LIVENESS FIX (once and for all): the store's effective_status is only as fresh as the last ad_meta sync
  // (hours stale on the daily cron), so a recently-paused/ended ad can still read ACTIVE and wrongly get an
  // action nudge. The action queue surfaces ads by PRIORITY, not spend, so a tiny-spend paused ad can appear -
  // which a top-N-by-spend refresh would miss. So: run a CANDIDATE analysis on the stored status, take the exact
  // ads that would surface as ACTIONS (view.doThis, any spend) plus the top spenders, refresh THEIR current
  // status in ONE bounded Meta call, override `active`, and re-filter. Bounded (|doThis| + 60), best-effort:
  // no token or any failure leaves the stored status (never worse). analyzeAccount is pure, so the candidate
  // pass has no side effects.
  if (opts.token) {
    try {
      const candidate = analyzeAccount(inputs, "LIVE", weights);
      const verifyIds = new Set<string>(candidate.doThis.map((a) => a.adId)); // every ad shown as an action, regardless of spend
      const spendOf = (a: RealAd) => a.rows.reduce((s, r) => s + r.spend, 0);
      for (const a of [...realAds].sort((x, y) => spendOf(y) - spendOf(x)).slice(0, 60)) verifyIds.add(a.externalId);
      const fresh = await fetchAdStatuses(accountExternalId, [...verifyIds], opts.token); // ONE batched call: id -> current effective_status
      if (fresh.size > 0) {
        let changed = false;
        for (const ad of realAds) {
          const s = fresh.get(ad.externalId);
          if (s !== undefined) {
            const nowActive = s === "ACTIVE";
            if (ad.active !== nowActive) { ad.active = nowActive; changed = true; } // fresh status wins over the stale stored one
          }
        }
        if (changed) inputs = toCockpitInputs(realAds).filter((a) => (a.impressions ?? 0) > 0 && a.spendRs > 0 && a.active !== false);
      }
    } catch (e) {
      captureError(e, { fn: "buildCockpitFromStore.spendOf" }); // P1 observability: was a silent empty catch (fail-open preserved)
      // keep the stored status - the action queue is never worse than before
    }
  }

  const view = analyzeAccount(inputs, "LIVE", weights);

  // Account funnel (thumb-stop/hold/LP/ATC/checkout) from the real day-wise rows.
  const extRows: ExtendedMetricsRow[] = realAds.flatMap((ad) =>
    ad.rows.map((r) => ({
      date: r.date,
      spend: r.spend,
      impressions: r.impressions,
      clicks: r.clicks,
      outboundClicks: r.outboundClicks ?? 0,
      video3sViews: r.video3sViews ?? 0,
      videoThruplays: r.videoThruplays ?? 0,
      landingPageViews: r.landingPageViews ?? 0,
      addToCarts: r.addToCarts ?? 0,
      initiateCheckouts: r.initiateCheckouts ?? 0,
      purchases: r.purchases,
    })),
  );
  const funnel = windowFunnel(extRows);
  const native = opts.nativePromise ? await opts.nativePromise.catch(() => undefined) : undefined;
  const funnelLevels = levelFunnels(
    realAds.map((ad) => ({
      adSetId: ad.adSetId,
      adsetName: ad.adsetName,
      campaignId: ad.campaignId,
      campaignName: ad.campaignName,
      rows: ad.rows.map((r) => ({
        date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks,
        outboundClicks: r.outboundClicks ?? 0, video3sViews: r.video3sViews ?? 0, videoThruplays: r.videoThruplays ?? 0,
        landingPageViews: r.landingPageViews ?? 0, addToCarts: r.addToCarts ?? 0, initiateCheckouts: r.initiateCheckouts ?? 0,
        purchases: r.purchases, revenue: r.revenue ?? 0,
      })),
    })),
    8,
    native,
  );

  // Per-day aggregation. Built twice on purpose: the DISPLAY window drives the headline totals + trend
  // chart (what the selected 7/14/30/60/90/custom window shows), while the 90-day BASELINE drives marginal
  // scaling + data quality (scaling/trend reads that must not shrink with a short display window).
  const aggByDay = (rowSets: MetricsRow[][]): DailyInputRow[] => {
    const byDay = new Map<string, DailyInputRow>();
    for (const rows of rowSets)
      for (const r of rows) {
        const d = byDay.get(r.date) ?? {
          date: r.date, spend: 0, impressions: 0, clicks: 0, outboundClicks: 0, video3sViews: 0,
          videoThruplays: 0, landingPageViews: 0, addToCarts: 0, initiateCheckouts: 0, purchases: 0, revenue: 0,
        };
        d.spend += r.spend; d.impressions += r.impressions; d.clicks += r.clicks;
        d.outboundClicks += r.outboundClicks ?? 0; d.video3sViews += r.video3sViews ?? 0; d.videoThruplays += r.videoThruplays ?? 0;
        d.landingPageViews += r.landingPageViews ?? 0; d.addToCarts += r.addToCarts ?? 0; d.initiateCheckouts += r.initiateCheckouts ?? 0;
        d.purchases += r.purchases; d.revenue += r.revenue;
        byDay.set(r.date, d);
      }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  };
  const dayRows = aggByDay(realAds.map((ad) => ad.rows)); // display window: headline totals + trend chart
  const baselineDayRows = aggByDay(realAds.map((ad) => ad.baselineRows ?? ad.rows)); // 90 days: scaling + data quality
  const marginal = marginalScaling(baselineDayRows);
  const dataQuality = assessDataQuality(baselineDayRows);
  const dailySeries = buildDailySeries(dayRows);

  // Headline totals: the COMPLETE, catalog-correct account totals (realAds are already catalog-filtered),
  // so no separate scope query is needed - the store IS the whole account.
  // Prefer Meta's ACCOUNT-LEVEL total (via the caller) so headline spend/revenue match Ads Manager exactly
  // even when the ad-level store is missing the long tail of tiny-spend ads. Only fall back to summing the
  // store ads when catalog is being EXCLUDED (the account-level scope includes catalog) or no scope is
  // available (previous behavior). Best-effort - a scope failure never breaks the page.
  const scope = opts.scopePromise ? await opts.scopePromise.catch(() => null) : null;
  const useScope = scope && catalog !== "exclude";
  // §128/§130: when the account-level scope was EXPECTED (catalog not excluded, a scope promise was provided)
  // but the call failed, the headline silently falls back to the store sum, which can understate the true
  // Ads-Manager total. Flag it so the UI shows the number as degraded rather than presenting it as truth.
  // (catalog=exclude deliberately sums the catalog-free store - honest by design, NOT degraded.)
  const headlineIncomplete = !!opts.scopePromise && !scope && catalog !== "exclude";
  const sSpend = useScope ? scope!.spend : dayRows.reduce((a, d) => a + d.spend, 0);
  const sImpr = useScope ? scope!.impressions : dayRows.reduce((a, d) => a + d.impressions, 0);
  const sClicks = useScope ? scope!.clicks : dayRows.reduce((a, d) => a + d.clicks, 0);
  const sPur = useScope ? scope!.purchases : dayRows.reduce((a, d) => a + d.purchases, 0);
  const sRev = useScope ? scope!.revenue : dayRows.reduce((a, d) => a + d.revenue, 0);
  const metrics: AccountMetrics = {
    impressions: sImpr,
    clicks: sClicks,
    purchases: sPur,
    cpm: sImpr > 0 ? (sSpend / sImpr) * 1000 : null,
    ctrAll: sImpr > 0 ? (sClicks / sImpr) * 100 : null,
    cpcAll: sClicks > 0 ? sSpend / sClicks : null,
    cpa: sPur > 0 ? sSpend / sPur : null,
  };
  const scopeTotals = { spendRs: Math.round(sSpend), revenueRs: Math.round(sRev), roas: sSpend > 0 ? sRev / sSpend : null };

  // Creative diversity from the stored format + the fingerprint-once semantic decode cache (keyed by
  // content_hash the ingestion stored). Cache hits fill hook/emotion/subject/funnel-stage; the decode itself
  // runs on the live path, so the store path reads whatever has been decoded so far. Best-effort.
  let ownDiversity: DiversityRead | null = null;
  let ownStrategy: CreativeStrategy | null = null;
  // The per-ad decode records that FEED the diversity read, exposed so the Creative tab can
  // re-aggregate the DNA over just one action group (e.g. only the ads to Pause) client-side.
  let ownDiversityRecords: CreativeRecord[] = [];
  try {
    const hashes = view.leaderboard.map((ad) => semanticKey(metaById.get(ad.id))).filter((h): h is string => Boolean(h));
    const sem = await readSemanticsCache(userId, hashes);
    const records: CreativeRecord[] = view.leaderboard.map((ad) => {
      const h = semanticKey(metaById.get(ad.id));
      const s = h ? sem.get(h) : undefined;
      return {
        adId: ad.id,
        adName: ad.name,
        spendRs: ad.spendRs,
        winner: ad.winner?.overall ?? 0,
        format: (metaById.get(ad.id)?.format ?? "unknown") as CreativeFormat,
        funnelStage: s?.funnelStage ?? null,
        hookType: s?.hookType ?? null,
        emotion: s?.emotion ?? null,
        subject: s?.subject ?? null,
        sceneType: s?.sceneType ?? null,
        setting: s?.setting ?? null,
        palette: s?.palette ?? null,
        visualMood: s?.visualMood ?? null,
        delivering: ad.delivering,
        fatigued: ad.fatigueRead?.state === "fatiguing" || ad.fatigueRead?.state === "fatigued",
      };
    });
    ownDiversityRecords = records;
    ownDiversity = records.length > 0 ? assessDiversity(records) : null;
    ownStrategy = ownDiversity ? buildCreativeStrategy(records, ownDiversity) : null;
    // Populate the VISUAL decode for every account on THIS primary path (the live path rarely runs now).
    // Minimal asset from the stored thumbnail is all the vision pass needs; fingerprint-once + bounded to 10
    // per run; runs after the response so it never blocks the cockpit.
    const haveVisual = new Set([...sem.entries()].filter(([, v]) => v.sceneType).map(([h]) => h));
    const toVisual = view.leaderboard
      .map((ad) => {
        const m = metaById.get(ad.id);
        const url = m?.thumb_url ?? null;
        const key = semanticKey(m);
        if (!key || !url || haveVisual.has(key)) return null;
        const asset: CreativeAsset = { adId: ad.id, creativeId: null, imageUrl: url, videoThumbUrl: null, videoId: null, title: null, body: null, ctaType: null, isVideo: false, isCarousel: false, isCatalog: false, assetCount: 1 };
        return { contentHash: key, asset };
      })
      .filter((x): x is { contentHash: string; asset: CreativeAsset } => x !== null);
    if (toVisual.length) after(() => decodeMissingVisual(userId, toVisual, haveVisual));
  } catch {
    ownDiversity = null;
  }

  const analyzedIds = new Set(inputs.map((a) => a.id));
  const campaignSet = new Set<string>();
  const adSetSet = new Set<string>();
  for (const a of realAds) {
    if (!analyzedIds.has(a.externalId)) continue;
    if (a.campaignId) campaignSet.add(a.campaignId);
    if (a.adSetId) adSetSet.add(a.adSetId);
  }
  const processed: ProcessedCounts = { campaigns: campaignSet.size, adSets: adSetSet.size, ads: inputs.length };

  return {
    status: "connected",
    accountName,
    accountExternalId,
    adsAnalyzed: inputs.length,
    view,
    metrics,
    scopeTotals,
    processed,
    funnel,
    marginal,
    dataQuality,
    ownDiversity,
    ownDiversityRecords,
    ownStrategy,
    dailySeries,
    funnelLevels,
    headlineIncomplete,
    syncedAt: opts.syncedAt,
  };
}
