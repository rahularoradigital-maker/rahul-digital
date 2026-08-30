// Live sync: given a logged-in user, fetch their connected Meta account's real ads +
// metrics, run the brain, and return a cockpit view of REAL data. Server-only (reads the
// encrypted token via the service role). No dummy data anywhere in this path.

import { cache } from "react";
import { after } from "next/server";
import { createAdminClient } from "./supabase/admin.ts";
import { readToken } from "./oauth-store.ts";
import { LruMap } from "./lru.ts";
import { createSingleFlight } from "./single-flight.ts";
import { isRenderableShape } from "./cockpit/renderable.ts";
import { todayIn, daysAgo } from "./date-window.ts";
import { metaSource, listTopSpendingAds, fetchAdInsights, fetchScopeInsights, fetchAdMeta, fetchAdCreatives, fetchAccountTimezone, fetchLevelNative, type AdMeta, mapMetaObjective, listAllCampaignObjectives, listAdSetEnds } from "./meta-source.ts";
import { deterministicFingerprint, excludeCatalogAds, thumbUrlOf, type CreativeAsset } from "./creative/fingerprint.ts";
import { assessDiversity, type CreativeRecord, type DiversityRead } from "./creative/diversity.ts";
import { toCockpitInputs, type RealAd } from "./scoring.ts";
import { analyzeAccount, type CockpitView } from "./cockpit/analyze.ts";
import { VERDICT_WEIGHTS, type ScoreWeights } from "./rules/verdict.ts";
import type { TokenSet } from "./ad-source.ts";
import { windowFunnel, type FunnelMetrics, type ExtendedMetricsRow } from "./metrics/funnel-metrics.ts";
import { marginalScaling, type MarginalRead } from "./scoring/marginal.ts";
import { buildDailySeries, type DailyInputRow, type DailyPoint } from "./cockpit/daily-series.ts";
import { levelFunnels, type LevelFunnels } from "./cockpit/level-funnel.ts";
import { assessDataQuality, type DataQuality, type QualityRow } from "./scoring/data-quality.ts";
import { daysUntilEnd } from "./scoring/fatigue.ts";
import { buildCockpitFromStore } from "./cockpit/from-store.ts";

// The user's currently-active Meta account (most-recently connected) and its token.
// One user OAuth token works across all their ad accounts, so the account picker and
// the account-switch route both read the session here. Returns null (never throws) if
// nothing is connected or the service role / DB is unavailable.
// WARM-PATH helper: the active account's external id ONLY, for building the cockpit cache key.
// Unlike getUserMetaSession it does NOT read or AES-decrypt the OAuth token (the cold pull reads
// its own token when it actually needs it), so every cached page navigation skips a DB round-trip
// plus a decrypt. React-cached so repeated calls in one render collapse to a single query.
export const getActiveAccountExternalId = cache(async (userId: string): Promise<string | null> => {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ad_accounts")
      .select("external_id")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .eq("status", "connected")
      // ISSUE 25: the explicit is_active flag decides the active account; connected_at is only a
      // tiebreak/fallback so a row that predates the flag still resolves (never a null active).
      .order("is_active", { ascending: false })
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.external_id ?? null;
  } catch {
    return null;
  }
});

export async function getUserMetaSession(
  userId: string,
): Promise<{ token: TokenSet; activeExternalId: string; activeAccountName: string } | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ad_accounts")
      .select("id, external_id, name")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .eq("status", "connected")
      // ISSUE 25: explicit is_active flag decides the active account; connected_at is the fallback.
      .order("is_active", { ascending: false })
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const token = await readToken(data.id, userId);
    if (!token) return null;
    return { token, activeExternalId: data.external_id, activeAccountName: data.name ?? `act_${data.external_id}` };
  } catch {
    return null;
  }
}

// How many top-spending ads to analyze per load, and the default lookback. Raised from 25 to
// 100 now that the insights pull paginates - a big account's meaningful spend sits well beyond
// the top 25. The SWR cache serves instantly after the first load, so the deeper pull is paid
// once per window. ponytail: a background sync job replaces this per-request fetch at scale (ADR-0004).
// Ranking baseline = the account's top ads by spend over the 90-day window. Capped so the day-wise pull
// (ads x 90 days of rows) stays light enough to finish on demand: 90 days is ~3x the day-wise data of the
// old 30-day window, so 100 ads x 90 days overran the function budget / hit Meta throttling and the cache
// never warmed. 50 top-spending ads over 90 days is a strong self-baseline (the top spenders dominate the
// account) and roughly matches the old, reliably-fast 30-day pull's row volume.
const MAX_ADS = 50;
const LOOKBACK_DAYS = 90; // the fixed app-wide comparison/ranking window (see COMPARISON_DAYS)

// Account-level raw metrics summed from the real day-wise rows, for KPIs the Meta
// account can answer directly (impressions, clicks, CPM, CTR, CPC, CPA). Derived
// ratios are null when the denominator is zero (never a fabricated number).
export type AccountMetrics = {
  impressions: number;
  clicks: number;
  purchases: number;
  cpm: number | null;
  ctrAll: number | null;
  cpcAll: number | null;
  cpa: number | null;
};

// How many campaigns / ad sets / ads a single run actually processed (transparency:
// the user asked to see the coverage of every workflow run).
export type ProcessedCounts = { campaigns: number; adSets: number; ads: number };

// Headline totals for the KPI cards, from the true scope (all campaigns/ads of the selected
// objective), so spend / revenue / ROAS match Ads Manager - distinct from the analyzed-ads
// subset in view.totals that the leaderboard and composition break down.
export type ScopeTotals = { spendRs: number; revenueRs: number; roas: number | null };

export type LiveCockpit =
  // syncedAt/stale are freshness metadata (ISSUE 10): syncedAt is when the served numbers were pulled
  // from Meta; stale=true means a day-old cache is being shown while a background refresh runs. Optional
  // so the deep pull (fetchLiveCockpitUncached) and non-UI callers need not set them; fetchLiveCockpit
  // attaches them at the serving boundary where the fresh/stale/cold path is known.
  | { status: "connected"; accountName: string; accountExternalId: string; adsAnalyzed: number; view: CockpitView; metrics: AccountMetrics; scopeTotals: ScopeTotals; processed: ProcessedCounts; funnel: FunnelMetrics; marginal: MarginalRead; dataQuality: DataQuality; ownDiversity: DiversityRead | null; dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels; syncedAt?: string; stale?: boolean }
  | { status: "not_connected" }
  | { status: "error"; message: string };

// Resolve which campaigns to include from the active filters. undefined = no filter;
// [ids] = only these; [] = a filter that matches nothing (an objective with no active
// campaigns). The campaign picker wins; otherwise the objective picker maps to the
// account's campaigns of those objectives, so "show Conversion" selects the top ads from
// conversion campaigns instead of filtering the top-overall ads after the fact.
async function resolveCampaignIds(
  accountExternalId: string,
  token: TokenSet,
  campaignId: string | undefined,
  objectives: string[],
): Promise<string[] | undefined> {
  // campaignId is now a comma-separated list (multi-select). Split it so several campaigns can
  // be scoped at once; a single id still works (a one-element list).
  if (campaignId) return campaignId.split(",").filter(Boolean);
  if (objectives.length === 0) return undefined;
  // Resolve from ALL campaigns (every status, paginated), not the ACTIVE-only picker list:
  // a Sales campaign that spent in the window but is now paused / in review / beyond the first
  // page must still be included, or selecting its objective wrongly shows "no spend".
  const campaigns = await listAllCampaignObjectives(accountExternalId, token);
  return campaigns.filter((c) => objectives.includes(mapMetaObjective(c.objective))).map((c) => c.id);
}

// An explicit {since, until} custom range (YYYY-MM-DD) overrides lookbackDays for the pull.
export type ExplicitWindow = { since: string; until: string };

// Topbar objective filter: include catalog (dynamic product) ads in the analyzed set (default,
// current behavior) or exclude them so metrics/leaderboard/health reflect only non-catalog ads.
export type CatalogMode = "include" | "exclude";

// Opt-in perf tracing: set ADBRAIN_PERF=1 (e.g. in Vercel) to log how long each phase of a cold
// Meta pull actually takes, so the real bottleneck is measured, not guessed. Off by default (zero
// cost, no log noise). Each call returns "now" so phases chain: t = perfMark("x", t).
const PERF = process.env.ADBRAIN_PERF === "1";
function perfMark(label: string, sinceMs: number): number {
  if (PERF) console.log(`[perf] ${label}: ${Math.round(performance.now() - sinceMs)}ms`);
  return performance.now();
}

async function fetchLiveCockpitUncached(userId: string, lookbackDays: number = LOOKBACK_DAYS, campaignId?: string, objectives: string[] = [], window?: ExplicitWindow, weights: ScoreWeights = VERDICT_WEIGHTS, catalog: CatalogMode = "include"): Promise<LiveCockpit> {
  // createAdminClient throws if SUPABASE_SERVICE_ROLE_KEY is missing; a DB hiccup can
  // also throw. Either way the dashboard must render the Connect screen, never 500.
  let acct: { id: string; external_id: string; name: string | null; timezone: string | null } | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ad_accounts")
      .select("id, external_id, name, timezone")
      .eq("user_id", userId)
      .eq("platform", "meta")
      .eq("status", "connected")
      // Match getActiveAccountExternalId (the cache key): the explicit is_active flag decides the
      // active account, connected_at is only the fallback. Without this the cache key and the pull
      // could resolve DIFFERENT accounts if the two ever disagree.
      .order("is_active", { ascending: false })
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { status: "error", message: error.message };
    acct = data;
  } catch {
    return { status: "not_connected" };
  }
  if (!acct) return { status: "not_connected" };

  let token;
  try {
    token = await readToken(acct.id, userId);
  } catch {
    return { status: "not_connected" };
  }
  if (!token) return { status: "not_connected" };

  try {
    const t0 = performance.now();
    let tp = t0;
    // ISSUE 29: resolve the account's reporting timezone so date windows match Meta's calendar, not
    // server UTC. Use the stored value; if absent, fetch once and persist (fire-and-forget). A miss
    // leaves tz null and daysAgo/todayIn fall back to UTC - i.e. exactly the prior behavior, never a
    // broken window.
    let tz = acct.timezone;
    if (!tz) {
      tz = await fetchAccountTimezone(acct.external_id, token);
      if (tz) {
        const acctId = acct.id;
        const zone = tz;
        void createAdminClient().from("ad_accounts").update({ timezone: zone }).eq("id", acctId).then(undefined, (e) => console.error("[meta-sync] timezone persist failed (recoverable)", e));
      }
    }
    // A custom range wins over lookbackDays; otherwise since = N days ago, until = today - both in the
    // account timezone.
    const since = window ? window.since : daysAgo(lookbackDays, tz);
    const until = window ? window.until : todayIn(tz);

    // STAGE 2b: serve from the COMPLETE day-wise store when it has data for this account+window - every
    // spending ad, no top-N cap. Returns null when the store is empty (not yet synced), in which case we
    // fall through to the on-demand pull below, so the app is never worse than before, only more complete.
    try {
      const fromStore = await buildCockpitFromStore({
        userId,
        accountExternalId: acct.external_id,
        accountName: acct.name ?? `act_${acct.external_id}`,
        since,
        until,
        catalog,
        weights,
        objectives,
        campaignIds: campaignId ? campaignId.split(",").filter(Boolean) : undefined,
      });
      if (fromStore) {
        perfMark("from-store (complete-coverage)", tp);
        return fromStore;
      }
    } catch (e) {
      // Never let a store-read issue break the page: fall through to the live pull.
      if (PERF) console.log("[perf] store read failed, falling back to live pull", e);
    }
    // Which campaigns to include: the campaign picker, or the objective picker mapped to
    // the account's campaigns of those objectives. undefined = all; [] = matched nothing.
    const campaignIds = await resolveCampaignIds(acct.external_id, token, campaignId, objectives);
    tp = perfMark("resolveCampaignIds", tp);
    // PERF: the scope totals (true spend/revenue for the whole objective) only depend on
    // campaignIds, NOT on the per-ad pipeline below. Kick it off NOW so it runs concurrently
    // with listTopSpendingAds -> fetchAdInsights -> listAdSetEnds instead of after them; we
    // await it only where the numbers are actually used. Best-effort (null on failure).
    const scopePromise = fetchScopeInsights(acct.external_id, since, token, campaignIds, until).catch(() => null);
    // Prefer the ads that actually SPENT in the window, sorted by spend (the ones that
    // matter on a big account), scoped to the resolved campaigns.
    let ads: { externalId: string; name?: string }[] = [];
    try {
      ads = await listTopSpendingAds(acct.external_id, since, token, campaignIds, MAX_ADS, until);
    } catch {
      ads = [];
    }
    // Only fall back to listing active ads when NO filter is active. A filter that matched
    // nothing (campaignIds === []) must stay empty, not silently show unfiltered ads.
    if (ads.length === 0 && campaignIds === undefined) {
      ads = await metaSource.listAds(acct.external_id, token);
    }
    tp = perfMark("listTopSpendingAds", tp);
    // Pull daily metrics for all of these ads in ONE account-level call instead of one
    // request per ad (26 round-trips -> 2). This is the main page-speed fix.
    let top = ads.slice(0, MAX_ADS);
    // Per-ad status + campaign/ad-set names, in flight concurrently with the insights pull (both
    // only need the ad ids). Status hides paused ads from suggestions; the names make every money
    // figure traceable to a readable campaign / ad set. Best-effort.
    const metaPromise = fetchAdMeta(acct.external_id, top.map((a) => a.externalId), token).catch(() => new Map<string, AdMeta>());
    // Own-ad creative assets (for the DETERMINISTIC format-diversity read; the semantic layer needs
    // the Gemini decoder). In flight concurrently - it only needs the ad ids. Best-effort.
    const creativesPromise = fetchAdCreatives(acct.external_id, top.map((a) => a.externalId), token).catch(() => new Map<string, CreativeAsset>());
    const rowsByAd = await fetchAdInsights(acct.external_id, top.map((a) => a.externalId), since, token, until);
    tp = perfMark("fetchAdInsights", tp);
    // Topbar "exclude catalog": drop dynamic-product ads BEFORE analysis so realAds/inputs/view and
    // every metric derived from them reflect only non-catalog ads. Done here (creatives now resolvable,
    // already in flight since above) so the filter runs once at the source of the analyzed set. An ad
    // with no creative this run is not known to be catalog, so it stays.
    if (catalog === "exclude") {
      const assets = await creativesPromise;
      top = excludeCatalogAds(top, (a) => assets.get(a.externalId));
    }
    // Ad set end dates cap the fatigue half-life (a creative cannot outlive its ad set).
    const adsetIds = [...new Set([...rowsByAd.values()].map((e) => e.adsetId).filter((x): x is string => Boolean(x)))];
    let adsetEnds = new Map<string, number>();
    try {
      adsetEnds = await listAdSetEnds(acct.external_id, adsetIds, token);
    } catch {
      // end dates are optional; a failure here just means no half-life cap
    }
    tp = perfMark("listAdSetEnds", tp);
    const nowSec = Math.floor(Date.now() / 1000);
    const adMeta = await metaPromise;
    tp = perfMark("awaitAdMeta", tp);
    // Best still image per ad for the leaderboard thumbnail (image, else video thumb). creativesPromise
    // has been in flight since above; awaiting it here overlaps the rest and it is awaited again later
    // (ownDiversity) with no extra cost. Best-effort: a missing asset -> no thumbnail (never a placeholder).
    const creativeAssets = await creativesPromise;
    const realAds: RealAd[] = top.map((ad) => {
      const entry = rowsByAd.get(ad.externalId);
      const endUnix = entry?.adsetId ? adsetEnds.get(entry.adsetId) : undefined;
      const endsInDays = daysUntilEnd(endUnix, nowSec);
      // active: true only when Meta reports effective_status ACTIVE (rolls up campaign/adset/ad).
      // Unknown status (not returned) stays undefined -> treated as active downstream, so we never
      // hide a real budget leak just because a status lookup failed.
      const m = adMeta.get(ad.externalId);
      const active = m?.status === undefined ? undefined : m.status === "ACTIVE";
      const asset = creativeAssets.get(ad.externalId);
      return {
        externalId: ad.externalId,
        name: ad.name ?? ad.externalId,
        rows: entry?.rows ?? [],
        objective: mapMetaObjective(entry?.objective),
        active,
        adsetName: m?.adsetName,
        campaignName: m?.campaignName,
        endsInDays,
        adSetId: entry?.adsetId,
        campaignId: entry?.campaignId,
        thumbUrl: asset ? thumbUrlOf(asset) : null,
      };
    });
    // Only judge ads that actually spent in the window (J1 spend floor is applied deeper too).
    // Only judge/suggest on ads that CAN still be acted on: drop anything Meta reports as not ACTIVE
    // (paused / archived / ended, incl. a paused parent ad set or campaign - effective_status rolls
    // that up). A closed ad needs no "pause it" advice. active === undefined (a failed status lookup)
    // is kept so a live ad is never hidden by a flaky lookup. This is the single source-level gate, so
    // EVERY downstream surface (leaderboard, do-now, waste, fatigue) inherits it. Headline scope totals
    // come from a separate account-level pull, so they still reflect all spend in the window.
    const inputs = toCockpitInputs(realAds).filter((a) => (a.impressions ?? 0) > 0 && a.spendRs > 0 && a.active !== false);
    const view = analyzeAccount(inputs, "LIVE", weights);
    tp = perfMark("analyzeAccount", tp);
    perfMark("COLD-PULL-TOTAL", t0);

    // Own-ad creative diversity (DETERMINISTIC layer only: real creative FORMAT per ad; the
    // semantic dimensions - hook/angle/persona - stay null until the Gemini decoder runs, so
    // `coverage` honestly reports 0 there). Best-effort; null if the creative pull failed.
    let ownDiversity: DiversityRead | null = null;
    try {
      const assets = await creativesPromise;
      const records: CreativeRecord[] = view.leaderboard.map((ad) => ({
        adId: ad.id,
        adName: ad.name,
        spendRs: ad.spendRs,
        winner: ad.winner?.overall ?? 0,
        format: assets.has(ad.id) ? deterministicFingerprint(assets.get(ad.id)!).format : "unknown",
        funnelStage: null,
        hookType: null,
        emotion: null,
        subject: null,
      }));
      ownDiversity = records.length > 0 ? assessDiversity(records) : null;
    } catch {
      ownDiversity = null;
    }

    // Coverage of this run: distinct campaigns / ad sets across the ads we actually analyzed.
    const analyzedIds = new Set(inputs.map((a) => a.id));
    const campaignSet = new Set<string>();
    const adSetSet = new Set<string>();
    for (const [adId, entry] of rowsByAd) {
      if (!analyzedIds.has(adId)) continue;
      if (entry.campaignId) campaignSet.add(entry.campaignId);
      if (entry.adsetId) adSetSet.add(entry.adsetId);
    }
    const processed: ProcessedCounts = { campaigns: campaignSet.size, adSets: adSetSet.size, ads: inputs.length };

    // Account-level D2C funnel metrics (thumb-stop, hold rate, LP/ATC/checkout ratios) from the
    // real day-wise rows. Ratios are null when their denominator is 0 (e.g. no video, no ATC).
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

    // Per-level funnel (top ad sets + campaigns by spend), so the funnel card can switch Ad / Ad set /
    // Campaign. Reuses the same ExtendedMetricsRow shape, grouped per ad's parent ids. OPTIONAL on the
    // payload: older cached blobs omit it and the card falls back to the ad-level view, so no
    // CACHE_SCHEMA bump and no forced cold pull.
    // LEVEL-NATIVE metrics (reach/frequency/budget) that cannot be rolled up from ad rows - pulled from Meta
    // at level=adset/campaign, in parallel + best-effort (any failure -> empty map -> the card shows "n/a").
    const [adsetNative, campaignNative] = await Promise.all([
      fetchLevelNative(acct.external_id, token, "adset", since, until),
      fetchLevelNative(acct.external_id, token, "campaign", since, until),
    ]);
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
          purchases: r.purchases,
        })),
      })),
      8,
      { adset: adsetNative, campaign: campaignNative },
    );

    // ONE per-day aggregation feeds three things: marginal scaling, data quality, AND the day-wise
    // trend chart. DailyInputRow is a superset of QualityRow (adds the funnel fields the chart's KPIs
    // need - video/LP/ATC/checkout), so we sum every chartable field once instead of looping twice.
    const byDay = new Map<string, DailyInputRow>();
    for (const ad of realAds) {
      for (const r of ad.rows) {
        const d = byDay.get(r.date) ?? {
          date: r.date, spend: 0, impressions: 0, clicks: 0, outboundClicks: 0, video3sViews: 0,
          videoThruplays: 0, landingPageViews: 0, addToCarts: 0, initiateCheckouts: 0, purchases: 0, revenue: 0,
        };
        d.spend += r.spend;
        d.impressions += r.impressions;
        d.clicks += r.clicks;
        d.outboundClicks += r.outboundClicks ?? 0;
        d.video3sViews += r.video3sViews ?? 0;
        d.videoThruplays += r.videoThruplays ?? 0;
        d.landingPageViews += r.landingPageViews ?? 0;
        d.addToCarts += r.addToCarts ?? 0;
        d.initiateCheckouts += r.initiateCheckouts ?? 0;
        d.purchases += r.purchases;
        d.revenue += r.revenue;
        byDay.set(r.date, d);
      }
    }
    // Sort ascending by date: the spend-shock and delivery-gap detectors read the series
    // in order, and marginal scaling wants a stable chronological curve.
    const dayRows = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    const marginal = marginalScaling(dayRows);
    const dataQuality = assessDataQuality(dayRows);
    // Day-wise trend points (one per day, every KPI) for the chart. buildDailySeries reuses the funnel
    // engine and adds ROAS/CPA - it re-sorts internally, so passing dayRows (already sorted) is fine.
    const dailySeries = buildDailySeries(dayRows);

    // TRUE totals for the exact scope (all campaigns/ad sets/ads of the selected objective or
    // campaign filter), summed at campaign level across the whole account - NOT the sum of the
    // top-N analyzed ads. This is what makes the headline KPIs match Ads Manager: the leaderboard
    // deep-analyzes the top ads, but spend / revenue / ROAS / impressions must reflect everything
    // in scope. Best-effort: if it fails, fall back to the analyzed-ads sum rather than 500.
    // Already in flight since right after campaignIds resolved (see scopePromise above), so
    // this await usually returns immediately - it overlapped the whole ad pipeline.
    //
    // CATALOG HONESTY: the scope query is campaign-level and is NOT catalog-filtered (catalog is an
    // ad-level property). Under "Catalog: Excluded" the scope totals would still INCLUDE catalog spend
    // and revenue - showing catalog-inclusive ROAS/revenue under an "Excluded" label, which is dishonest
    // and skews every downstream verdict. So in exclude mode we deliberately fall back to the sum over
    // the catalog-excluded analyzed ads (realAds already had catalog dropped upstream): a genuinely
    // catalog-free total, consistent with the leaderboard/funnel/sparklines the rest of the view shows.
    // It is the top-spending non-catalog ads rather than the full account, but honest beats complete-
    // but-wrong. Include mode keeps the full Ads-Manager-matching scope totals.
    const scope = await scopePromise;
    const useScope = scope && catalog !== "exclude";
    const sSpend = useScope ? scope!.spend : realAds.reduce((a, ad) => a + ad.rows.reduce((s, r) => s + r.spend, 0), 0);
    const sImpr = useScope ? scope!.impressions : realAds.reduce((a, ad) => a + ad.rows.reduce((s, r) => s + r.impressions, 0), 0);
    const sClicks = useScope ? scope!.clicks : realAds.reduce((a, ad) => a + ad.rows.reduce((s, r) => s + r.clicks, 0), 0);
    const sPur = useScope ? scope!.purchases : realAds.reduce((a, ad) => a + ad.rows.reduce((s, r) => s + r.purchases, 0), 0);
    const sRev = useScope ? scope!.revenue : realAds.reduce((a, ad) => a + ad.rows.reduce((s, r) => s + r.revenue, 0), 0);
    const metrics: AccountMetrics = {
      impressions: sImpr,
      clicks: sClicks,
      purchases: sPur,
      cpm: sImpr > 0 ? (sSpend / sImpr) * 1000 : null,
      ctrAll: sImpr > 0 ? (sClicks / sImpr) * 100 : null,
      cpcAll: sClicks > 0 ? sSpend / sClicks : null,
      cpa: sPur > 0 ? sSpend / sPur : null,
    };
    // Headline totals for the KPI cards, from the true scope (Ads-Manager-matching). Kept
    // separate from view.totals, which is the analyzed-ads subset the leaderboard breaks down.
    const scopeTotals = { spendRs: Math.round(sSpend), revenueRs: Math.round(sRev), roas: sSpend > 0 ? sRev / sSpend : null };

    return { status: "connected", accountName: acct.name ?? `act_${acct.external_id}`, accountExternalId: acct.external_id, adsAnalyzed: inputs.length, view, metrics, scopeTotals, processed, funnel, marginal, dataQuality, ownDiversity, dailySeries, funnelLevels };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Meta sync failed" };
  }
}

// Two-level TTL cache so moving between pages reuses the computed cockpit instead of
// re-pulling the whole account (a ~9s Meta call) on every navigation. L1 is in-process
// (fast, but per serverless instance); L2 is a Supabase table shared across ALL instances,
// which is what actually fixes the "every page is slow" problem on serverless. Both are
// keyed by (userId, days, campaignId). Errors are never cached, so a failed pull retries.
// The L2 table is optional: every access is guarded, so a missing table just falls back
// to L1 + a live pull (today's behavior) rather than breaking.
type CacheEntry = { at: number; value: LiveCockpit };
// FRESH: serve straight from cache. STALE: still serve instantly, but kick off a
// background refresh so the NEXT load is fresh. Only a cache that has never been
// populated blocks on the ~9s live pull, so after the very first load a user
// effectively never waits again, on any serverless instance. The stale window is wide
// (a day) on purpose: a day-old view shown instantly while it refreshes in the
// background beats making the user watch a 9s spinner after being idle overnight.
const FRESH_MS = 300_000; // 5 minutes: serve without a background refresh
const STALE_MS = 86_400_000; // 24 hours: still serve instantly, refresh in the background
const COLD_PULL_TIMEOUT_MS = 8_000; // cap the blocking cold pull so a slow Meta pull can't 504 the page
// Cache SCHEMA version: part of the cache key. BUMP THIS whenever the LiveCockpit shape changes
// (new required field on the connected payload, e.g. scopeTotals / dataQuality / marginal).
// A cached blob written by older code lacks the new field; the newer render reads it and crashes
// on the missing property (a production 500). Bumping the version means old-shape blobs live under
// a different key and are never read again - the next load is a clean fresh pull. This is the
// permanent fix for cache/schema-mismatch crashes, not a one-off.
// v3: added view.wasteContributors / atRiskContributors + per-ad conversions/active/names to the
// cached shape. BUMP THIS on ANY LiveCockpit/view shape change so old-shape blobs are never read.
const CACHE_SCHEMA = "v6"; // v6: catalog include/exclude is part of the key (exclude analyzes a different ad set). v5: added dailySeries (day-wise trend). v4: added ownDiversity
// Bounded so a long-lived instance can't accumulate unbounded (user x account x window x filter x
// weights) permutations (ISSUE 09). 500 hot entries is far more than one instance serves between
// evictions; least-recently-used falls out first.
const COCKPIT_CACHE_MAX = 500;
const cockpitCache = new LruMap<string, CacheEntry>(COCKPIT_CACHE_MAX);

/** Clear the cockpit cache. Pass userId to also clear that user's shared L2 rows. */
export async function bustCockpitCache(userId?: string): Promise<void> {
  // Scope L1 eviction to THIS user (memKey is `${userId}:...`). A blanket .clear() would wipe every
  // other concurrently-active user's warm cache on one person's Re-scan - a multi-tenant hit at scale.
  if (!userId) {
    cockpitCache.clear(); // ops/global clear only (no user given)
    return;
  }
  const prefix = `${userId}:`;
  for (const key of cockpitCache.keys()) {
    if (key.startsWith(prefix)) cockpitCache.delete(key);
  }
  try {
    const admin = createAdminClient();
    await admin.from("cockpit_cache").delete().eq("user_id", userId);
  } catch {
    // L2 unavailable; this user's L1 is already cleared
  }
}

// Live pull, then write both cache levels. Returned to callers and also used as the
// background refresh body.
// Write the freshly-pulled value to the shared L2 cache + age out stale rows. Best-effort.
async function writeCockpitL2(userId: string, cacheKey: string, value: LiveCockpit): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("cockpit_cache")
      .upsert({ user_id: userId, cache_key: cacheKey, data: value, updated_at: new Date().toISOString() }, { onConflict: "user_id,cache_key" });
    // Bound table growth: versioning the cache key (CACHE_SCHEMA) orphans old-shape rows, and each
    // distinct filter/date permutation writes a new row. Drop this user's rows older than the stale
    // window - they are never served anyway (a >STALE_MS row always triggers a cold pull), and this
    // also ages out the orphaned old-schema rows. Scoped to this user, indexed by the PK. Best-effort.
    await admin
      .from("cockpit_cache")
      .delete()
      .eq("user_id", userId)
      .lt("updated_at", new Date(Date.now() - STALE_MS).toISOString());
  } catch {
    // L2 write/cleanup failed; L1 still holds the value for this instance
  }
}

// deferWrite=true (the cold, user-facing path): return the value immediately and persist to L2 in
// the background via after(), so the user does not wait on two extra DB round-trips AFTER the ~9s
// pull already completed. The background-refresh caller leaves it false (nothing is awaiting it).
async function pullAndStore(userId: string, lookbackDays: number, campaignId: string | undefined, objectives: string[], cacheKey: string, memKey: string, window?: ExplicitWindow, weights: ScoreWeights = VERDICT_WEIGHTS, catalog: CatalogMode = "include", deferWrite = false): Promise<LiveCockpit> {
  const value = await fetchLiveCockpitUncached(userId, lookbackDays, campaignId, objectives, window, weights, catalog);
  if (value.status !== "error") {
    cockpitCache.set(memKey, { at: Date.now(), value });
    if (deferWrite) {
      try {
        after(() => writeCockpitL2(userId, cacheKey, value));
      } catch {
        // after() unavailable outside a request scope: fall back to awaiting the write.
        await writeCockpitL2(userId, cacheKey, value);
      }
    } else {
      await writeCockpitL2(userId, cacheKey, value);
    }
  }
  return value;
}

// Single-flight the pull per cache key (ISSUE 07): concurrent cold misses and repeated stale-refresh
// triggers for the same key collapse into ONE Meta pull instead of a thundering herd.
const cockpitInflight = createSingleFlight<LiveCockpit>();
function pullAndStoreSingleFlight(userId: string, lookbackDays: number, campaignId: string | undefined, objectives: string[], cacheKey: string, memKey: string, window?: ExplicitWindow, weights: ScoreWeights = VERDICT_WEIGHTS, catalog: CatalogMode = "include", deferWrite = false): Promise<LiveCockpit> {
  return cockpitInflight(memKey, () => pullAndStore(userId, lookbackDays, campaignId, objectives, cacheKey, memKey, window, weights, catalog, deferWrite));
}

// Attach freshness metadata (ISSUE 10) at the serving boundary: syncedAt = when these numbers were
// pulled from Meta, stale = a day-old cache shown while a background refresh runs. Non-connected
// states carry no freshness and pass straight through.
function withFreshness(v: LiveCockpit, syncedAtMs: number, stale: boolean): LiveCockpit {
  return v.status === "connected" ? { ...v, syncedAt: new Date(syncedAtMs).toISOString(), stale } : v;
}

export async function fetchLiveCockpit(
  userId: string,
  lookbackDays: number = LOOKBACK_DAYS,
  campaignId?: string,
  objectives: string[] = [],
  window?: ExplicitWindow,
  weights: ScoreWeights = VERDICT_WEIGHTS,
  catalog: CatalogMode = "include",
): Promise<LiveCockpit> {
  const w0 = performance.now();
  // Key the cache by the ACTIVE account too: without this, every account shares one
  // cache entry, so switching account keeps showing the previous account's numbers.
  // Only the external id is needed here (not the token), so use the light, token-free read.
  const activeId = (await getActiveAccountExternalId(userId)) ?? "none";
  perfMark("warm:activeId", w0);
  // Include the custom range in the key so it never collides with a preset (which has no window).
  const windowKey = window ? `${window.since}_${window.until}` : "";
  // Only a non-default weight override changes the key (identity check on the default param), so the
  // vast majority of users keep the exact same cache entries as before this override existed.
  const weightKey = weights === VERDICT_WEIGHTS ? "" : `${weights.performance}-${weights.trend}-${weights.fatigue}-${weights.funnel}`;
  // catalog is part of the key: excluding catalog analyzes a different ad set, so include/exclude
  // must cache separately (default "include" keeps the exact key shape users already have).
  const cacheKey = `${CACHE_SCHEMA}:${activeId}:${lookbackDays}:${windowKey}:${campaignId ?? ""}:${[...objectives].sort().join(",")}:${weightKey}:${catalog}`;
  const memKey = `${userId}:${cacheKey}`;
  const now = Date.now();

  // L1: in-process (same instance)
  const hit = cockpitCache.get(memKey);
  if (hit && now - hit.at < FRESH_MS && isRenderableShape(hit.value)) {
    perfMark("warm:L1-HIT-total", w0);
    return withFreshness(hit.value, hit.at, false);
  }

  // L2: Supabase, shared across serverless instances
  let cached: { value: LiveCockpit; age: number } | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("cockpit_cache")
      .select("data, updated_at")
      .eq("user_id", userId)
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (data) {
      const value = data.data as LiveCockpit;
      // Ignore an old-shape cached blob (would crash the render); fall through to a fresh pull.
      if (isRenderableShape(value)) {
        cached = { value, age: now - new Date(data.updated_at as string).getTime() };
      }
    }
  } catch {
    // L2 unavailable; fall through to a live pull
  }

  if (cached) {
    cockpitCache.set(memKey, { at: now - cached.age, value: cached.value });
    if (cached.age < FRESH_MS) {
      perfMark("warm:L2-FRESH-total", w0);
      return withFreshness(cached.value, now - cached.age, false);
    }
    if (cached.age < STALE_MS) {
      // Serve stale immediately, refresh in the background so the next load is fresh.
      try {
        after(() => pullAndStoreSingleFlight(userId, lookbackDays, campaignId, objectives, cacheKey, memKey, window, weights, catalog));
      } catch {
        // after() unavailable outside a request scope; the stale value is still fine.
      }
      perfMark("warm:L2-STALE-total (bg refresh queued)", w0);
      return withFreshness(cached.value, now - cached.age, true);
    }
  }

  // Cold or too stale: block on the live pull (skeleton shows while this runs). deferWrite=true so
  // the L2 cache write happens in the background and the user gets the value as soon as it is ready.
  if (PERF) console.log("[perf] COLD pull (blocking) - no fresh/stale cache for this filter combo");
  // Cap the blocking wait: a slow cold pull would otherwise exceed Vercel's function timeout and
  // show the user a raw 504 (not catchable by the React error boundary). On timeout we return the
  // app's honest "still syncing" state. after(pull) keeps the serverless container alive until the
  // pull actually finishes even after we respond, so it still warms L1 + L2 - without it the floating
  // pull is frozen on response flush and every retry is another cold timeout (an endless spinner).
  const pull = pullAndStoreSingleFlight(userId, lookbackDays, campaignId, objectives, cacheKey, memKey, window, weights, catalog, true);
  try {
    after(pull); // survive past the response; no-op-safe if the pull rejects (Next logs it)
  } catch {
    // after() unavailable (non-request scope, e.g. cron): the caller already awaits us, so skip.
  }
  const timeout = new Promise<LiveCockpit>((resolve) =>
    setTimeout(() => resolve({ status: "error", message: "Still syncing your account - try again in a few seconds." }), COLD_PULL_TIMEOUT_MS),
  );
  const result = await Promise.race([pull, timeout]);
  return withFreshness(result, Date.now(), false); // a cold pull just synced now (error state passes through)
}

