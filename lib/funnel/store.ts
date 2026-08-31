import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapMetaObjective, listAdSetOptimizationGoals, listTopSpendingAds, fetchAdInsights } from "@/lib/meta-source";
import { getUserMetaSession } from "@/lib/meta-sync";
import { diagnoseFunnel, type FunnelAd, type FunnelReport } from "@/lib/funnel/diagnosis";
import type { ExtendedMetricsRow } from "@/lib/metrics/funnel-metrics";
import type { MetricsRow } from "@/lib/ad-source";

// Funnel diagnosis - READ PATH. Runs the deterministic engine over the user's active account. Prefers the
// stored ad_metrics (whole account, no cap) and falls back to a LIVE Meta pull when the store is empty (a
// brand whose nightly sync has not run yet) - mirroring the cockpit, so the funnel works on any connected
// brand immediately. The account is resolved via getUserMetaSession, the SAME resolver the cockpit uses, so
// the funnel always matches the brand shown in the topbar. Objective -> internal union via mapMetaObjective;
// ad-set optimization goal fetched live for higher-confidence staging (graceful: falls back to objective).
const PAGE = 1000;
const DEFAULT_LOOKBACK_DAYS = 30;
const LIVE_MAX_ADS = 200; // live-pull cap (one account-level insights call); the store path has no cap

// A source path returns the ads (optimizationGoal not yet set) plus each ad's ad-set id, so the caller can
// fetch ad-set optimization goals ONCE and apply them uniformly.
type PathResult = { ads: FunnelAd[]; adsetByAd: Map<string, string> };

type Db = {
  ad_id: string; date: string; objective: string | null; adset_id: string | null; campaign_id: string | null; spend: number; impressions: number; clicks: number;
  outbound_clicks: number; video_3s: number; video_thruplays: number; landing_page_views: number;
  add_to_carts: number; initiate_checkouts: number; purchases: number;
};

function dbToExt(r: Db): ExtendedMetricsRow {
  return {
    date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks, outboundClicks: r.outbound_clicks,
    video3sViews: r.video_3s, videoThruplays: r.video_thruplays, landingPageViews: r.landing_page_views,
    addToCarts: r.add_to_carts, initiateCheckouts: r.initiate_checkouts, purchases: r.purchases,
  };
}

function metricToExt(r: MetricsRow): ExtendedMetricsRow {
  return {
    date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks, outboundClicks: r.outboundClicks ?? 0,
    video3sViews: r.video3sViews ?? 0, videoThruplays: r.videoThruplays ?? 0, landingPageViews: r.landingPageViews ?? 0,
    addToCarts: r.addToCarts ?? 0, initiateCheckouts: r.initiateCheckouts ?? 0, purchases: r.purchases,
  };
}

export type FunnelReportBundle = { report: FunnelReport; accountName: string; accountId: string; since: string; until: string; lookbackDays: number; source: "store" | "live" } | null;

type Session = NonNullable<Awaited<ReturnType<typeof getUserMetaSession>>>;

// STORE path: every ad_metrics row for the account in-window, grouped by ad. Empty => store not populated.
async function fromStore(userId: string, accountExternalId: string, since: string, until: string): Promise<PathResult> {
  const admin = createAdminClient();
  const rows: Db[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("ad_metrics")
      .select("ad_id,date,objective,adset_id,campaign_id,spend,impressions,clicks,outbound_clicks,video_3s,video_thruplays,landing_page_views,add_to_carts,initiate_checkouts,purchases")
      .eq("user_id", userId)
      .eq("account_external_id", accountExternalId)
      .gte("date", since)
      .lte("date", until)
      .order("ad_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { ads: [], adsetByAd: new Map() };
    const page = (data ?? []) as Db[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  if (!rows.length) return { ads: [], adsetByAd: new Map() };

  const names = new Map<string, string>();
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin.from("ad_meta").select("ad_id,name").eq("user_id", userId).eq("account_external_id", accountExternalId).order("ad_id", { ascending: true }).range(from, from + PAGE - 1);
    const page = (data ?? []) as { ad_id: string; name: string | null }[];
    for (const m of page) if (m.name) names.set(m.ad_id, m.name);
    if (page.length < PAGE) break;
  }

  const byAd = new Map<string, Db[]>();
  const adsetByAd = new Map<string, string>();
  for (const r of rows) {
    const l = byAd.get(r.ad_id) ?? [];
    l.push(r);
    byAd.set(r.ad_id, l);
    if (r.adset_id && !adsetByAd.has(r.ad_id)) adsetByAd.set(r.ad_id, r.adset_id);
  }
  const ads: FunnelAd[] = [];
  for (const [adId, rs] of byAd) {
    ads.push({
      adId,
      name: names.get(adId) ?? adId,
      objective: mapMetaObjective(rs.find((r) => r.objective)?.objective ?? ""),
      optimizationGoal: null,
      adSetId: adsetByAd.get(adId) ?? null,
      campaignId: rs.find((r) => r.campaign_id)?.campaign_id ?? null,
      rows: rs.map(dbToExt),
    });
  }
  return { ads, adsetByAd };
}

// LIVE path (store empty): top spenders + one account-level insights call.
async function fromLive(session: Session, since: string, until: string): Promise<PathResult> {
  const account = session.activeExternalId;
  let top: { externalId: string; name?: string }[] = [];
  try {
    top = await listTopSpendingAds(account, since, session.token, undefined, LIVE_MAX_ADS, until);
  } catch {
    return { ads: [], adsetByAd: new Map() };
  }
  if (!top.length) return { ads: [], adsetByAd: new Map() };
  const rowsByAd = await fetchAdInsights(account, top.map((a) => a.externalId), since, session.token, until);
  const adsetByAd = new Map<string, string>();
  const ads: FunnelAd[] = top.map((ad) => {
    const entry = rowsByAd.get(ad.externalId);
    if (entry?.adsetId) adsetByAd.set(ad.externalId, entry.adsetId);
    return {
      adId: ad.externalId,
      name: ad.name ?? ad.externalId,
      objective: mapMetaObjective(entry?.objective),
      optimizationGoal: null,
      adSetId: entry?.adsetId ?? null,
      campaignId: entry?.campaignId ?? null,
      rows: (entry?.rows ?? []).map(metricToExt),
    };
  });
  return { ads, adsetByAd };
}

// Fetch ad-set optimization goals once and stamp each ad's optimizationGoal (higher-confidence staging).
// Graceful: any failure -> goals stay null -> classifier falls back to the objective.
async function applyGoals(result: PathResult, session: Session): Promise<FunnelAd[]> {
  const adsetIds = [...new Set([...result.adsetByAd.values()])];
  let goalByAdset = new Map<string, string>();
  try {
    if (adsetIds.length) goalByAdset = await listAdSetOptimizationGoals(session.activeExternalId, adsetIds, session.token);
  } catch {
    goalByAdset = new Map();
  }
  return result.ads.map((a) => {
    const adsetId = result.adsetByAd.get(a.adId);
    return adsetId ? { ...a, optimizationGoal: goalByAdset.get(adsetId) ?? null } : a;
  });
}

export async function loadFunnelReport(userId: string, opts: { lookbackDays?: number } = {}): Promise<FunnelReportBundle> {
  const session = await getUserMetaSession(userId);
  if (!session) return null; // no connected Meta account -> nothing to diagnose (page shows a connect prompt)
  const accountExternalId = session.activeExternalId;
  const accountName = session.activeAccountName ?? accountExternalId;

  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString().slice(0, 10);

  // Prefer the store (whole account, no cap); fall back to a live pull when it is empty.
  const store = await fromStore(userId, accountExternalId, since, until);
  const source: "store" | "live" = store.ads.length ? "store" : "live";
  const result = store.ads.length ? store : await fromLive(session, since, until);
  if (!result.ads.length) return null;

  const ads = await applyGoals(result, session);
  return { report: diagnoseFunnel(ads, {}), accountName, accountId: accountExternalId, since, until, lookbackDays, source };
}
